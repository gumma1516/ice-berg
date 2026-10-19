# Ice Age Creamery

A dessert storefront with customer accounts, pickup and delivery checkout, order history, and a staff portal for orders and team management.

Built with React 19, TypeScript, TanStack Start, Tailwind CSS, Firebase Authentication and Firestore. Optional YouPI payments settle through a server webhook.

## Run locally

Use Node.js 24.12 or newer and npm. Install the versions recorded in `package-lock.json`:

```sh
npm ci
```

Copy `.env.example` to `.env` and enter your Firebase web configuration. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env`. Then start the app:

```sh
npm run dev
```

Open the URL printed by Vite. Firebase-backed sign-in and orders require a configured Firebase project and deployed security rules. Use a separate Firebase project for development; there is no automatic emulator connection.

See [RUN-IT-YOURSELF.md](RUN-IT-YOURSELF.md) for local setup and [DEPLOYMENT.md](DEPLOYMENT.md) for Firebase, staff access and production deployment.

## Checks

```sh
npm run check
```

This runs TypeScript, ESLint, Vitest and the production build. Individual commands are `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Tests use local assertions and mocks; a passing suite does not verify deployed Firebase rules or a live payment gateway.

## Project map

| Path                  | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `src/routes/`         | Customer pages and staff portal routes           |
| `src/components/`     | Shared interface components                      |
| `src/data/menu.ts`    | Public menu, prices and store contact details    |
| `src/lib/checkout.ts` | Delivery rules and checkout calculations         |
| `src/lib/firebase.ts` | Firebase clients and database operations         |
| `src/lib/server/`     | Payment webhook and server-only Firestore access |
| `src/server.ts`       | Server entry and payment endpoint routing        |
| `src/test/`           | Automated tests                                  |
| `src/assets/`         | Dessert photography                              |
| `firestore.rules`     | Database access rules; deploy separately         |

The public catalog and delivery rules currently come from the source files above. Changes saved in the staff store-settings screen are not automatically reflected in every public page or checkout calculation.

## Before publishing to GitHub

- Keep `.env`, local environment overrides, service-account JSON files and private keys out of commits. `.env.example` contains configuration names only. Every `VITE_` value is public in the browser bundle.
- Review the owner email in `firestore.rules`, store contact information and image rights before making the repository public. Choose a license if you intend to grant reuse rights; this repository does not currently include one.
- Run `npm run check` and inspect the staged files before committing. Commit source, documentation and `package-lock.json`; dependency folders and generated build output stay local.
- This project is connected to Lovable. Preserve its existing Git history and connected branch: do not force-push, rebase, amend or squash commits that were already pushed. If working from a downloaded folder without `.git`, obtain the connected repository before trying to sync changes back.

GitHub stores the source. The full application needs a server runtime for TanStack Start and the payment endpoint; GitHub Pages is not a deployment target for this configuration.
