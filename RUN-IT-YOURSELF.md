# Run Ice Age Creamery locally

1. Install Node.js 24.12 or newer, which includes npm.
2. Open a terminal in this project folder and run `npm ci`.
3. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` on macOS/Linux).
4. Fill in the Firebase web-app values from your development project's settings. Enable Email/Password authentication and create Firestore. See [DEPLOYMENT.md](DEPLOYMENT.md) for security rules and staff setup.
5. Run `npm run dev` and open the address printed in the terminal. Stop it with Ctrl+C.

Use a separate development Firebase project. Local development connects to whichever project you configure; it does not use an emulator automatically. Restart the server after changing `.env`.

Leave the YouPI variables empty to use pay-on-collection or pay-on-delivery. Server credentials are needed only for payment settlement and simulation, not ordinary browsing or customer sign-in. Do not paste real credentials into source files or commit `.env`.

## Common edits

| Change                                         | File                            |
| ---------------------------------------------- | ------------------------------- |
| Menu names, prices, phone and address          | `src/data/menu.ts`              |
| Delivery fee, minimum and serviceable pincodes | `src/lib/checkout.ts`           |
| Home page                                      | `src/routes/index.tsx`          |
| Menu page                                      | `src/routes/menu.tsx`           |
| Visit page                                     | `src/routes/visit.tsx`          |
| Header and footer                              | `src/components/SiteChrome.tsx` |
| Colors and shared styling                      | `src/styles.css`                |
| Dessert photos                                 | `src/assets/`                   |

These source files control the public storefront. Saving settings in the staff portal does not currently update all of these values.

## Verify a change

Run `npm run check` for types, lint, tests and a production build. Use `npm run test:watch` while developing. After a build, `npm run preview` previews the built app locally; it does not publish anything.

Also try the changed page in a browser, including a narrow mobile viewport. For ordering changes, use test accounts to check sign-in, cart quantities, pickup/delivery validation, the resulting staff order and customer order history.

If sign-in fails, check the Firebase config, enabled providers and authorized domains. If Firestore reports insufficient permissions, confirm the rules were deployed to the same project selected in `.env`. Never solve a permissions error by opening the database to everyone.
