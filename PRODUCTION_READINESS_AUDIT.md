# Ice Age Creamery — production readiness audit

Reviewed 18 October 2026. **Recommendation: do not launch with real customer accounts or operational orders in the current state.** The main blockers are authentication, database authorization, customer privacy, and unreliable persistence.

This review covers the supplied application: public pages, customer registration/sign-in/account, admin dashboard/orders/analytics/store, Firebase client integration, Firestore rules, SSR/error handling, dependencies, build configuration, and tests. No application fixes or production Firebase changes were made. Audit evidence is in [audit-artifacts](C:/Users/HP/Music/Ice-Age-Creamery/audit-artifacts).

The supplied source rules are demonstrably unsafe. **Their deployment to the live project has not been verified.** No live customer documents were retrieved, no real accounts were created, and no production orders were submitted. Local browser checks used deliberately invalid Firebase configuration for a fictitious `demo-audit` project. Those connection errors are expected and do not prove that the real project is offline.

## What currently exists

The site uses React, TypeScript, TanStack Start, and Tailwind. Firebase Auth and Firestore are called directly from browser code. The server entry handles SSR and errors, with CSRF middleware for server functions; there is no application business API in this checkout enforcing order prices, customer ownership, payment settlement, loyalty accounting, or staff privileges.

The public menu is a static catalog. Ordering is currently a staff-entered walk-in/telephone workflow. There is no customer cart, checkout, payment gateway, or online customer order-submission flow. That is a capability gap if online ordering is intended, rather than a defect in an existing checkout.

Useful foundations are present: route-level page components, metadata, an error boundary, an SSR error wrapper, a reusable visual system, and real-time Firestore listeners. These do not compensate for the authorization and integrity problems below.

## Confirmed release blockers

**1. Critical — database access is unrestricted in the supplied rules.**

[firestore.rules:6](C:/Users/HP/Music/Ice-Age-Creamery/firestore.rules:6), lines 12, 18, and 23 allow public writes to `orders`, `store_settings`, `menu_items`, and `customers`; all four also allow public reads. There is no authentication, ownership, staff-role, field, or type validation. If these rules are deployed, anyone can read customer/order data, alter it, or delete it through the Firebase APIs without using the website. Firebase explicitly identifies unconditional public access as an insecure configuration. [Firebase guidance](https://firebase.google.com/docs/rules/insecure-rules).

**Repair:** Verify the active rules immediately. Replace them with default-deny policies, owner-scoped customer/order access, and server-issued staff roles. Coordinate the application refactor and rules rollout: current pre-authentication profile queries and whole-order-collection listeners will fail under correct ownership rules. Firestore rules authorize queries; they do not filter unauthorized records out of a broad query. [Rules and queries](https://firebase.google.com/docs/firestore/security/rules-conditions).

**2. Critical — passwords are stored as plaintext in Firestore and localStorage.**

[customer-auth.ts:134](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/customer-auth.ts:134) writes `payload.password = password`. Registration also stores the same string as `passwordHash` at line 204; it is not hashed. An isolated registration test confirmed both copies. Combined with finding 1, deployed customer documents would expose passwords as well as contact information.

**Repair:** Let Firebase Auth manage passwords; remove all password storage and comparison from application profiles/caches. If real customers have used this code, inspect exposure and plan password resets and removal of legacy password fields, including handling retained backups. Hashing passwords in browser-managed Firestore records is not an adequate replacement for proper authentication.

**3. Critical — the password screen can impersonate Google customers.**

[customer-auth.ts:248](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/customer-auth.ts:248) rejects a password only when a Firestore profile already contains a truthy password. Google signup intentionally creates profiles without that field at line 496. Login finds the profile by email and returns before invoking Firebase Auth. The isolated reproduction signed in to a synthetic Google profile using an arbitrary wrong password; Firebase password sign-in was called **zero times**.

**Repair:** Authenticate with Firebase Auth first and only then retrieve `/customers/{auth.uid}`. Never use a readable profile document as proof of identity. Remove Firestore-first and local-password fallback login paths.

**4. High — sessions and authentication failures are treated as optional.**

[customer-auth.ts:85](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/customer-auth.ts:85) trusts a localStorage profile as the active user. The hook at line 535 does not observe Firebase authentication state. Signup ignores Auth errors other than duplicate email (line 167), and login can fall back to cached credentials after Firebase rejects it (line 302). Tests confirmed that disabled-user and invalid-credential errors can still produce a signed-in application profile, and that signup succeeds after `auth/operation-not-allowed`.

**Repair:** Derive identity from Firebase Auth, handle initialization explicitly, fail closed on credential errors, and observe sign-in/sign-out state. Use a single UID profile format; existing email, UID, and `cust_${uid}` formats need migration. Define reauthentication/revocation behavior for privileged actions. Remove demo accounts from production.

**5. High — the admin portal has no authentication or role gate.**

[admin.tsx:4](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin.tsx:4) renders `AdminLayout` without a session or staff-role check. The layout and child routes add no authorization. A fresh local browser opened the dashboard from the public footer without signing in and saw order-management navigation. `noindex` metadata is not access control.

**Repair:** Require staff authentication, protect the route, and enforce staff authorization independently in Firestore/backend operations. Issue roles through a trusted administrative process; customers must never be able to edit their own role. Use stronger sign-in protection for administrators.

**6. High — customer order history can include other customers' orders.**

[account.tsx:72](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/account.tsx:72) filters a shared all-orders list by phone suffix **or first-name substring**. `Priya Rao` matches `Priyanka Devi`. Registration only checks that phone text has at least eight characters ([register.tsx:113](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/register.tsx:113)); `abcdefgh` passes, strips to an empty digit string, and makes `includes("")` match every order with a phone. Both cases were reproduced. The whole order collection is also delivered to the browser and cached before this display filter.

**Repair:** Store immutable `customerUid` ownership, query by authenticated UID, and enforce ownership in rules. Validate phone numbers separately; names and phone fragments must not authorize access. Clear account-specific caches on logout/account change.

**7. High — concurrent staff orders can overwrite one another.**

[admin/orders.tsx:153](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/orders.tsx:153) generates an ID from `orders.length`. [firebase.ts:122](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/firebase.ts:122) uses `setDoc` on that ID, replacing an existing document. Two actual create handlers on the same empty snapshot both generated `IA-1001` in an offline reproduction. Stale snapshots, deletions, and initial loading also make the count unsafe.

**Repair:** Use unique document IDs and idempotent submissions. Allocate human-friendly receipt numbers separately with a trusted transaction when needed. Prevent accidental replacement of an existing order.

**8. High — failed cloud saves are presented as successful orders.**

[orders-store.ts:93](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/orders-store.ts:93) writes optimistic local state, catches a rejected cloud save, and resolves successfully. Status changes and deletion use the same pattern. [admin/orders.tsx:164](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/orders.tsx:164) does not await the write and immediately announces synchronization. A mocked permission-denied write still resolved and left a phantom local order.

**Repair:** Await persistence, expose pending/failed/confirmed states, propagate errors, roll back or explicitly queue failed changes, and prevent duplicate submissions. Show success only after the intended durable operation succeeds.

**9. High — order amounts, status, ownership, and loyalty lack a trusted integrity boundary.**

[firebase.ts:122](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/firebase.ts:122) accepts browser-supplied item prices, totals, status, and timestamps. [orders.ts:14](C:/Users/HP/Music/Ice-Age-Creamery/src/data/orders.ts:14) has no customer UID or payment settlement information. The supplied rules validate none of these values. The current code records a payment method; it does not verify a payment.

**Repair:** Put authoritative price calculation, permitted order transitions, loyalty updates, and any future payment verification in trusted backend operations. Validate quantities, catalog availability, integer monetary values, ownership, timestamps, and idempotency. Keep payment state separate from kitchen/order state. Staff-entered cash/UPI confirmation needs an auditable workflow even if no online gateway is planned.

## Functional defects and customer experience

| Priority | Finding and evidence                                                                                                                                                                                                                                                                                                                                | Recommended change                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | **Menu edits do not persist or affect sales.** [store.tsx:80](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/store.tsx:80), lines 172–221 change component state only. Actual price handler test changed ₹249 to ₹999, then remount restored ₹249; Firebase saves: zero. Public menu and staff order picker read static data.                  | Store validated menu documents with stable item IDs; use one shared catalog for all consumers. Confirm persistence before success messages.                                                         |
| Medium   | **Saved settings do not update public pages.** [store.tsx:120](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/store.tsx:120) is the only caller loading settings. Public contact details, banners, hours, and menu are not connected to these saved values.                                                                                    | Share a public-settings query across the storefront; distinguish saved and unsaved changes; define closed-store behavior.                                                                           |
| Medium   | **Registration can get stranded.** [customer-auth.ts:160](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/customer-auth.ts:160) creates an Auth user before the profile write; a failed profile write leaves that identity created, and retry reports duplicate email. Google signup suppresses profile-write failure at line 499.                       | Make profile provisioning idempotent and resumable; show incomplete-profile recovery and accurate save status.                                                                                      |
| Medium   | **“Forgot?” and “Remember me” do not implement their promises.** [login.tsx:258](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/login.tsx:258) only shows a toast for recovery. Checkbox state at line 64 is never passed into login.                                                                                                                | Implement Firebase reset-email flows and explicit session/local persistence selection. Use generic recovery outcomes and error handling.                                                            |
| Medium   | **Zero points turn into 100.** [customer-auth.ts:235](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/customer-auth.ts:235) and four other reads use `Number(data.points)                                                                                                                                                                                |                                                                                                                                                                                                     | 100`. Reproduced with a real zero value. | Validate numbers and preserve zero; derive balances from a trusted loyalty ledger. |
| Medium   | **Loyalty/marketing features are incomplete.** Account promises earning/redemption, but no accrual/redemption/tier workflow exists. `agreePerks` in [register.tsx:80](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/register.tsx:80) is discarded. Profile data does not subscribe to remote changes.                                               | Implement or revise the promises; store explicit marketing preference, refresh profile data, and make rewards auditable.                                                                            |
| Medium   | **Print KOT is a placeholder.** [admin/orders.tsx:173](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/orders.tsx:173) only displays a printing toast.                                                                                                                                                                                          | Implement and verify a printable kitchen ticket, including notes, quantity, order ID, and reprint identification.                                                                                   |
| Medium   | **Form accessibility is incomplete.** [login.tsx:237](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/login.tsx:237) and [register.tsx:273](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/register.tsx:273) lack input/label associations; password-toggle buttons have no names. Local browser accessibility trees confirmed unnamed fields/buttons. | Connect labels with IDs, name icon controls, expose errors, and test keyboard/screen-reader flows.                                                                                                  |
| Medium   | **Brand text contrast is too low.** [styles.css:83](C:/Users/HP/Music/Ice-Age-Creamery/src/styles.css:83) yields approximately 2.88:1 white/accent, 2.84:1 accent/background, and 2.29:1 accent/berry-soft, used for small text/actions.                                                                                                            | Darken text/action colors and measure actual rendered states; ordinary text should meet WCAG's 4.5:1 threshold. [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). |

## Analytics, Firebase health, and operations

**Analytics is not dependable for reconciliation.** [analytics.tsx:65](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/analytics.tsx:65) applies the selected period only to daily statistics; categories, top items, hours, and payment totals use all historical orders. Item share divides all-time item revenue by period revenue. Daily revenue includes pending orders, while categories only count completed orders. A single ₹100 pending order produced ₹100 daily revenue and ₹0 category revenue in the isolated check. Filter once and use documented revenue/payment definitions consistently.

**Business dates are inconsistent.** [orders.ts:70](C:/Users/HP/Music/Ice-Age-Creamery/src/data/orders.ts:70) groups UTC dates but displays local date labels. At 18 October 00:30 IST, a 17 October noon order was counted under “Sun 18” in the reproduction. “Today” filters repeat this issue. Use explicit `Asia/Kolkata` reporting boundaries, server timestamps, and midnight/range tests. The hourly helper also only includes 10:00–21:59 although the dashboard advertises opening until 22:30.

**Malformed database records can crash administration.** [firebase.ts:89](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/firebase.ts:89) trusts raw data and casts order status. [admin/orders.tsx:355](C:/Users/HP/Music/Ice-Age-Creamery/src/routes/admin/orders.tsx:355) assumes status configuration exists. A mocked record with `not-a-valid-status` crashed the actual orders component. Validate documents at read/write boundaries, enforce compatible rules, and provide safe error states for corrupt records.

**“Firebase Live” and “Cloud Synced” are unreliable claims.** [firebase.ts:32](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/firebase.ts:32) hardcodes configuration status to true, even when initialization fails. Subscription errors fall back to local cache while badges stay live. The local browser displayed “Firebase Live (demo-audit)” with deliberately invalid Firebase configuration. Separate configured, initializing, authorized, cached/offline, synchronized, and failed states. The existing connection test reads the entire order collection and does not verify Auth, write acknowledgement, or correct permissions.

**Reads and caches will grow without bounds.** [firebase.ts:81](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/firebase.ts:81) listens to every order, and [orders-store.ts:54](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/orders-store.ts:54) caches them all locally. Use scoped and limited queries, pagination, indexed date ranges, aggregates, and short-lived role-scoped caches. This affects privacy as well as read cost and browser performance.

**Operational history is missing from the application model.** Order writes do not retain actor, status-transition history, update time, payment reference, or an immutable audit trail. “Clear Orders” hard-deletes the loaded order history. Prefer cancellation/archive, restricted retention operations, append-only audit events, and verified restoration procedures.

**Error UI exists, but production monitoring needs confirmation.** [lovable-error-reporting.ts:29](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/lovable-error-reporting.ts:29) uses optional browser hooks. No independent production error destination is configured in this checkout. Hosting-side collection may exist and was not inspected. [error-capture.ts:4](C:/Users/HP/Music/Ice-Age-Creamery/src/lib/error-capture.ts:4) keeps one process-global last error, which can misattribute concurrent request failures. Add sanitized structured events, request/operation IDs, durable error collection, and alerts for failed order writes/auth anomalies. Do not log passwords or unnecessary customer data.

## Verification results and deployment

| Check                        | Result and interpretation                                                                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build             | **Pass.** Generated a Nitro `cloudflare-module` application in `.output/public` and `.output/server`. Main client chunk approximately 991 kB minified / 302 kB gzip; chart chunk approximately 401 kB / 105 kB gzip. Measure mobile performance and consider further lazy loading. |
| Existing automated tests     | **1 test passed.** It only matches the home route; it does not render/authenticate, exercise orders, or test security rules. An initial Windows sandbox temporary-file error was resolved by a permitted rerun; it was not classified as an application bug.                       |
| TypeScript                   | **Fail.** Includes Firestore index-signature accesses, nullable Google profile handling, optional-field errors, and nonexistent `MenuItem.desc`/`tag` properties. Vite building successfully does not establish type correctness.                                                  |
| ESLint                       | **Fail: 229 errors, 6 warnings.** 209 formatting errors, 19 explicit-any errors, one prefer-const error, and six Fast Refresh warnings. Formatting findings are separate from the security defects.                                                                                |
| Dependency audit             | **4 high-severity package entries**, stemming from the same transitive gRPC dependency chain, not four independent proven application exploits. See details below.                                                                                                                 |
| Authentication reproductions | **8 isolated checks passed**, confirming the reported unsafe behaviors using actual transpiled source with in-memory mocks. No live Firebase calls.                                                                                                                                |
| Admin/customer reproductions | Actual handlers/helpers confirmed ID collisions, swallowed writes, transient menu edits, malformed-status crashes, reporting errors, ownership-filter leaks, and zero-point conversion. These are targeted reproductions, not full end-to-end certification.                       |
| Browser inspection           | Home, anonymous admin dashboard, login, and registration rendered locally. Anonymous admin entry and unnamed authentication controls were verified. Real OAuth, deployed hosting, device matrix, and real Firebase authorization were not exercised.                               |

**The Firebase Hosting configuration does not match the actual build.** [firebase.json:6](C:/Users/HP/Music/Ice-Age-Creamery/firebase.json:6) expects `dist` and rewrites to `/index.html`. The successful build generates Cloudflare SSR output and no static `index.html` at that destination. [RUN-IT-YOURSELF.md](C:/Users/HP/Music/Ice-Age-Creamery/RUN-IT-YOURSELF.md) incorrectly describes uploading a static `dist` directory. Choose the intended host, deploy its compatible server/runtime output, and test direct deep links and 404s through the deployed hostname. This does not establish that the existing Lovable deployment is broken. [TanStack hosting guidance](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).

**Dependency detail:** installed `@grpc/grpc-js` is 1.9.16, pulled by `@firebase/firestore` 4.18.0 via `~1.9.0`. The current maintainer advisories describe certificate-authentication and server-error-disclosure issues. This application contains no observed gRPC server, so exploit reachability is not established. Investigate a compatible Firebase/dependency upgrade and retest; do not blindly apply the audit tool's suggested downgrade to Firebase 9.14.0. [Certificate advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j), [error-disclosure advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4).

Pin a supported Node version and one package manager/lockfile in CI. The installed Firestore package declares Node >=24.12.0, while the run instructions say any recent Node works. Keep typecheck, lint, tests, rules tests, dependency review, and build as distinct gates.

## Suggested authorization design

| Data                                    | Public/anonymous       | Signed-in customer                                       | Staff/admin                   | Trusted backend                                                  |
| --------------------------------------- | ---------------------- | -------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| Published menu/public store information | Read only              | Read only                                                | Validated authorized edits    | Publish/version changes if needed                                |
| `/customers/{uid}`                      | No access              | Read own; edit explicitly allowed personal fields        | Only permitted support access | Set protected identity/role/loyalty fields                       |
| Orders                                  | No unrestricted access | Read own UID-scoped orders; request permitted operations | Authorized operational access | Validate creation, prices, transitions, ownership, payment state |
| Loyalty ledger                          | No access              | Read own                                                 | Authorized support visibility | Append accrual/redemption/reversal entries                       |
| Audit events                            | No access              | No direct writes                                         | Scoped read access            | Append immutable actor/action/time records                       |
| Private operational settings            | No access              | No access                                                | Role-scoped access            | Validate sensitive changes                                       |

This is a target policy, not a drop-in replacement rules file. The data model, auth flow, and queries must change together. Validate field allowlists, types, bounds, ownership immutability, and authorized state transitions. Use server-issued custom claims or an equivalently protected role source; App Check complements authorization but does not replace it.

The Firebase web API key is a public client identifier rather than a service-account credential. Moving it out of source or rotating it alone will not fix these access controls. Apply appropriate key restrictions and protect any true server credentials separately. [Firebase API keys](https://firebase.google.com/docs/projects/api-keys).

## Recommended delivery order

1. **Contain exposure:** verify the live rules and affected collections, restrict unsafe access, assess whether plaintext credentials were stored, and plan account recovery/migration if necessary. Preserve diagnostic evidence securely.
2. **Fix identity and authorization:** Firebase Auth exclusively, UID profiles, staff roles, owned order queries, safe rules, and coordinated data migration. Add emulator tests before rollout.
3. **Make operations durable:** unique/idempotent order creation, validated trusted writes, visible failure handling, real catalog/settings persistence, and a recoverable order/audit history.
4. **Finish promised capabilities:** password reset, persistence preference, loyalty behavior, consent capture, print tickets, and any intended online ordering/payment flow.
5. **Prepare release:** correct analytics/timezone, accessibility, deployment configuration, environment separation, dependency updates, telemetry, backups, and CI gates.

Before release, tests should prove: anonymous access is denied where required; customer A cannot read/change B; customers cannot set roles/points/prices; revoked/disabled users cannot pass application auth; two simultaneous order submissions survive; rejected/offline writes never claim durable success; catalog changes persist and propagate; zero points stay zero; midnight/period analytics reconcile; and a backup can actually be restored.

## Live-environment checks still required

Firebase Console/deployment access was not available in this review. Verify the active project and rules version, enabled sign-in providers, authorized domains, password policy/reset templates, staff role issuance, App Check configuration, budgets/alerts, Firestore indexes, backups/PITR, and hosting headers. No Storage rules file or upload workflow exists in the supplied source; if the bucket is used outside this app, inspect its deployed rules separately. Repository absence is not proof of a public bucket.

Also verify real Google OAuth and password reset on staging, deployed deep links, HTTPS/security headers, monitoring alerts, and mobile/keyboard flows. Reloading `/login` or `/register` while signed in has a potential SSR hydration mismatch because initial localStorage identity differs from the server; this is a source-based concern, not a browser-confirmed defect here.

Detailed supporting notes: [authentication](C:/Users/HP/Music/Ice-Age-Creamery/audit-artifacts/auth-findings.md), [admin operations](C:/Users/HP/Music/Ice-Age-Creamery/audit-artifacts/admin-findings.md), [customer frontend](C:/Users/HP/Music/Ice-Age-Creamery/audit-artifacts/customer-findings.md).
