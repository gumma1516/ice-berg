# Deployment and store setup

Publishing source to GitHub and launching the store are separate steps. The app needs Firebase Authentication, Firestore and a TanStack Start server runtime. Online payment additionally needs a configured YouPI gateway and server credentials.

## 1. Configure Firebase

Create separate development and production projects in the [Firebase console](https://console.firebase.google.com/).

- Register a web app and copy its public configuration to the matching `VITE_FIREBASE_*` variables in `.env` locally and the host's build environment in production.
- Enable Email/Password authentication. Enable Google authentication if the Google sign-in button will be used.
- Add local and deployed domains to Authentication's authorized domains. Configure verification and password-reset email templates.
- Create Firestore in production mode. Deploy this repository's rules before using customer data.

`VITE_FIREBASE_MEASUREMENT_ID` is optional; setting it enables the app's Firebase Analytics initialization on supported browsers. Decide on your analytics and consent setup before enabling it. Firebase web configuration is public; access control comes from authentication and database rules.

## 2. Configure and deploy access rules

Set `VITE_ADMIN_OWNER_EMAIL` to the owner's real mailbox. Set the same lowercase address in `ownerEmail()` in `firestore.rules`. That address will be visible in published source and the browser configuration; it is not a password or secret.

Use the Firebase CLI with an explicit target project. Replace `YOUR_PROJECT_ID` before running:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Check the deployed rules in the console. The repository file alone does not protect the live database. Rules restrict customer profiles and order access by user ID; customers cannot grant themselves staff access, award loyalty points or mark their own orders paid. Staff permissions are enforced separately from the portal's visible navigation.

Rules can also be tested against a disposable Firebase project or the Firestore emulator. The unit test suite does not execute these deployed rules.

## 3. Set up the owner and team

Open `/admin` and use the first-time owner setup with the configured email. The account must verify its email before receiving an admin record: follow the verification email, then return and sign in again to complete setup. If the account already exists, use its existing password or reset it.

After owner setup, add people from **Admin → Team**. Send each person a password reset so they can replace the temporary password. The app keeps customer and staff sign-ins in separate Firebase client sessions. Staff sessions use browser session persistence; sign out explicitly on shared devices.

Only admins manage team records or delete orders. Managers and staff can access operational screens as permitted by the app and Firestore rules. Disabling a team record does not revoke separately issued Firebase custom claims; if you use claims, remove those privileges through your trusted administration process as well.

## 4. Review store information

Confirm the menu and prices, address, map, phone, operating hours and photography rights. Public menu/contact values live in `src/data/menu.ts`; delivery policy and checkout time slots live in `src/lib/checkout.ts`.

Current delivery defaults are a ₹199 minimum, ₹39 fee and free delivery from ₹599, limited to the pincodes listed in `DELIVERY.serviceablePincodes`. Review these with the store before launch. The store-settings portal writes to Firestore, but public pages and checkout still use source-defined values in several places.

Website orders start as `awaiting_confirmation`. Staff review them, check prices against the catalog and accept or reject them. Browser calculations are not a trusted server-side pricing authority. The payment webhook checks a signed amount against the stored order total; this does not replace the staff's catalog check before fulfillment.

## 5. Choose the runtime and build

Use Node.js 24.12 or newer for installation and builds:

```sh
npm ci
npm run check
```

### Deploying to Vercel (Free `*.vercel.app` Domain)

The repository includes a [vercel.json](file:///c:/Users/HP/Music/Ice-Age-Creamery/vercel.json) configured for `tanstack-start`. When deployed to Vercel, Nitro builds serverless functions and static assets to `.vercel/output`:

1. **Import the repository into Vercel**: Connect your GitHub repository on [vercel.com](https://vercel.com/new).
2. **Environment Variables**: Add your `VITE_FIREBASE_*` variables and `VITE_ADMIN_OWNER_EMAIL` in **Settings → Environment Variables**.
3. **Deploy**: Vercel assigns a free `https://<your-project>.vercel.app` domain.
4. **Firebase Authorized Domains**: In the [Firebase Console](https://console.firebase.google.com/) under **Authentication → Settings → Authorized domains**, add `<your-project>.vercel.app` so customer and staff login works properly.

GitHub Pages and a static directory upload alone cannot run `src/server.ts` or the payment webhook. `firebase.json` is used here to deploy Firestore rules; it is not a complete Firebase server-hosting deployment. `npm run preview` is for local verification.

Set `VITE_*` values in the build environment before building. They are compiled into the client; changing them requires a rebuild. Set private payment credentials in the deployed server's environment or secret bindings, where `readEnv()` in `src/lib/server/firestore-admin.ts` can access them. Set `NODE_ENV=production` in the runtime and keep payment simulation flags unset.

## 6. Optional online UPI payments

Leave `VITE_YOUPI_BASE_URL` and `VITE_YOUPI_MERCHANT_KEY` empty to keep online payment disabled. Pay-on-collection and pay-on-delivery do not need a gateway.

For online payments, provision and operate your YouPI gateway separately. Verify its widget and webhook contract against this integration, including signature headers and amount units, before accepting money. This repository does not deploy the gateway.

| Variable                        | Where it belongs          | Purpose                                         |
| ------------------------------- | ------------------------- | ----------------------------------------------- |
| `VITE_YOUPI_BASE_URL`           | Build environment, public | HTTPS origin serving `youpi.js`                 |
| `VITE_YOUPI_MERCHANT_KEY`       | Build environment, public | Merchant public key                             |
| `VITE_STORE_NAME`               | Build environment, public | Payment dialog name                             |
| `YOUPI_WEBHOOK_SECRET`          | Server secret             | Webhook signature verification                  |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server secret             | Service account for Firestore settlement writes |

Instead of the JSON secret, supply `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`. Use credentials for the same project as the storefront and grant only the necessary server permissions. Service-account access bypasses Firestore client rules. Never prefix a private credential with `VITE_`, include it in an issue or commit its JSON file.

Configure the gateway webhook as `https://YOUR_SITE/api/payments/youpi-webhook`. A browser widget callback leaves the payment pending; settlement is performed by the server handler. An amount mismatch is recorded for staff review.

**The online button is enabled by the public gateway configuration alone.** It does not prove that server secrets, webhook delivery or the merchant account work. Enable those public variables only after configuring the server, then verify a controlled payment and reconcile it with the merchant's actual receipt. Verify failed/cancelled payments and repeated webhook deliveries as well. Review the gateway's operating requirements, licensing and refund process separately.

### Local payment simulation

Use only a separate development Firebase project. Simulation writes payment status to that real database without transferring money.

```dotenv
VITE_PAYMENT_MODE=test
ALLOW_TEST_PAYMENTS=true
NODE_ENV=development
YOUPI_WEBHOOK_SECRET=replace_with_a_local_test_secret
# Also configure a service account for the development Firebase project.
```

Restart `npm run dev` and open it on localhost. The checkout test dialog offers success, incorrect amount and failure scenarios. The simulator requires a development/test environment, a loopback host and a matching browser Origin. It is disabled in production builds. Keep both test flags out of production build and runtime settings.

## 7. Release verification

- Run `npm run check` and review the actual result for this revision.
- Deploy the intended Firestore rules and verify customer isolation, denied privilege escalation, owner verification and staff access with disposable accounts.
- Exercise registration, password reset, Google sign-in if enabled, pickup and delivery, customer history and staff acceptance on the deployed URL.
- Confirm direct links and refreshed pages load, including `/menu`, `/account` and `/admin`. Check mobile layout and loading/error states.
- If payments are enabled, verify settlement reaches the right Firebase project and that the deployed simulator refuses requests. Keep real service-account material out of build artifacts, source control and logs.
- Review project billing alerts, backups and monitoring. App Check enforcement needs a corresponding client integration; it is not configured in this app.

Preserve the Lovable-connected branch's published history when pushing to GitHub. A source push can sync into Lovable; validate changes before pushing.
