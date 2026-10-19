/**
 * Server-side Firestore access, over the REST API.
 *
 * Used only by trusted server code (the payment webhook). It authenticates as a
 * Google service account, so the security rules do not apply — which is exactly
 * why nothing here may be reachable from the browser.
 *
 * REST + Web Crypto rather than `firebase-admin` on purpose: this build targets
 * an edge runtime (Cloudflare by default), where the Node-only Admin SDK will
 * not run. The same code works under Node 20+.
 */

export type ServerEnv = Record<string, string | undefined>;

export type ServiceAccountConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/datastore";

/** Reads a variable from the platform env (Cloudflare) or `process.env` (Node). */
export function readEnv(env: ServerEnv | undefined, key: string): string | undefined {
  const fromPlatform = env?.[key];
  if (fromPlatform) return fromPlatform;

  // `process` is absent on some edge runtimes.
  const proc = (globalThis as { process?: { env?: ServerEnv } }).process;
  return proc?.env?.[key];
}

/**
 * Service-account credentials, from either a whole JSON blob
 * (`FIREBASE_SERVICE_ACCOUNT_JSON`) or the three fields separately.
 */
export function getServiceAccount(env?: ServerEnv): ServiceAccountConfig | null {
  const raw = readEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON");

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      }
    } catch {
      console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  const projectId = readEnv(env, "FIREBASE_PROJECT_ID") ?? readEnv(env, "VITE_FIREBASE_PROJECT_ID");
  const clientEmail = readEnv(env, "FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv(env, "FIREBASE_PRIVATE_KEY");

  if (!projectId || !clientEmail || !privateKey) return null;

  return { projectId, clientEmail, privateKey };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToPkcs8(pem: string): Uint8Array {
  // Hosting dashboards usually store the key with literal "\n" sequences.
  const normalised = pem.replace(/\\n/g, "\n");
  const body = normalised
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

/** Exchanges a signed JWT for an access token, cached until shortly before it expires. */
export async function getAccessToken(account: ServiceAccountConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const claims = {
    iss: account.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${encodeJson({ alg: "RS256", typ: "JWT" })}.${encodeJson(claims)}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.privateKey) as unknown as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned) as unknown as ArrayBuffer,
  );

  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Google token exchange returned no access token.");

  cachedToken = {
    token: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600),
  };

  return cachedToken.token;
}

// ── Minimal Firestore value mapping ───────────────────────────────

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export type FirestoreDocument = {
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

/** Decode an order for server-side validation, including its item list. */
export function readFirestoreData(doc: FirestoreDocument): Record<string, unknown> {
  const decode = (value: FirestoreValue): unknown => {
    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return value.doubleValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decode);
    if ("mapValue" in value) return readFirestoreData(value.mapValue);
    return null;
  };
  return Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([key, value]) => [key, decode(value)]),
  );
}

export function toFirestoreValue(value: string | number | boolean | Date | null): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: value };
}

/** Reads a scalar out of a REST document, ignoring types we don't need. */
export function readFirestoreField(doc: FirestoreDocument, field: string): string | number | null {
  const value = doc.fields?.[field];
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  return null;
}

function documentUrl(account: ServiceAccountConfig, path: string): string {
  return `https://firestore.googleapis.com/v1/projects/${account.projectId}/databases/(default)/documents/${path}`;
}

export async function getDocument(
  account: ServiceAccountConfig,
  path: string,
): Promise<FirestoreDocument | null> {
  const token = await getAccessToken(account);
  const response = await fetch(documentUrl(account, path), {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore read failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as FirestoreDocument;
}

/** Patches only the named fields, leaving the rest of the document untouched. */
export async function patchDocument(
  account: ServiceAccountConfig,
  path: string,
  fields: Record<string, string | number | boolean | Date | null>,
  updateTime: string,
): Promise<void> {
  if (!updateTime) throw new Error("A document version is required for payment settlement.");
  const token = await getAccessToken(account);

  const params = new URLSearchParams();
  for (const key of Object.keys(fields)) params.append("updateMask.fieldPaths", key);
  // A concurrent settlement or staff edit must cause a retry, never overwrite
  // a newly paid/refunded order or recreate a deleted document.
  params.set("currentDocument.updateTime", updateTime);

  const response = await fetch(`${documentUrl(account, path)}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, toFirestoreValue(value)]),
      ),
    }),
  });

  if (!response.ok) {
    throw new Error(`Firestore write failed (${response.status}): ${await response.text()}`);
  }
}
