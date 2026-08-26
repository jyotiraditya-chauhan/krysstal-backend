# krysstal-backend

Firebase Cloud Functions backend for the `krysstal-app` Firebase project. This repo's only purpose is to hold deployable Cloud Functions (HTTP APIs, callables, triggers, scheduled jobs) plus the Firestore rules/indexes for that project. There is no separate server process — nothing calls `.listen()`.

Structure follows the same convention used across the other backends in this workspace (`glowly-backend` in particular) so patterns transfer between projects.

## Rules

- No comments in code, in any file. Names should carry the meaning.
- No `.env` file, no service-account JSON, no credentials committed or configured locally. The Admin SDK (`functions/src/config/firebase.ts`) initializes with a bare `initializeApp()`. Application Default Credentials cover this automatically in both the deployed Functions runtime and the Firebase Emulator Suite. Never add `cert()`/service-account credentials back in.
- The client web `firebaseConfig` object (`apiKey`, `authDomain`, `storageBucket`, `messagingSenderId`, `appId`) has no place in this repo. That's for a browser/mobile client using `firebase/app`, not for this Admin SDK backend. If it ever gets pasted in again, it does not go into any file here.
- Never run `firebase emulators:start` (or anything that starts the Firestore/Auth/Functions emulators) without asking the user first and getting explicit go-ahead. Verify code changes statically instead — `npm run typecheck`, `npm run build`, reading the compiled output — unless the user has explicitly approved running the emulator for that session.

## Structure

Deployable code lives under `functions/` — a self-contained package with its own `package.json`/`tsconfig.json`, matching how `glowly-backend` and `al-hind-institute-backend` are laid out. Repo root only holds Firebase project config (`.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`) and this file.

```
functions/
├── package.json
├── tsconfig.json
├── .firebaseignore
└── src/
    ├── index.ts                setGlobalOptions + barrel re-export of every deployed function
    ├── config/
    │   ├── firebase.ts          Admin SDK init (auth, db) — bare initializeApp()
    │   └── collections.ts       Firestore collection name constants (Collections.ADMINS, etc.)
    ├── shared/                  cross-cutting code used by more than one feature
    │   ├── errors.ts             requireAuth / requireRole guards for onCall functions (throw HttpsError)
    │   ├── middleware/            authenticate, authorize, errorHandler, notFound (Express-specific)
    │   ├── types/                 express.d.ts augmentation, roles.ts
    │   └── utils/                 AppError, asyncHandler, generateTempPassword
    └── features/
        └── <featureName>/        one folder per business feature
            ├── <featureName>.functions.ts   the exported onCall/onRequest/trigger handlers (thin)
            ├── <featureName>.service.ts     real logic: Firestore/Auth/third-party calls (framework-free)
            └── <featureName>.types.ts       request/response types for that feature
```

`features/api/` is the current example — an Express app (cors, `/health`, feature routers) wrapped in a single `onRequest` function named `api`. Because it's Express-routed rather than a set of standalone callables, it additionally nests `admins/` with its own `controller.ts`/`routes.ts`/`service.ts`/`types.ts`/`validation.ts` (MVC shape, appropriate for HTTP routes under one function). That nesting is specific to Express-backed features; standalone `onCall`/`onRequest`/trigger features do not need a controller or routes file — see the pattern below.

### Two shapes of feature, pick based on what the feature actually is

1. **Express-routed feature** (like `api`/`admins`): many related HTTP endpoints sharing CORS/auth/error-handling middleware. Lives under one `onRequest(app)` function. New endpoints are new Express routes, not new Cloud Functions.
2. **Standalone function feature** (payments, shipping, etc.): each unit of work is its own `onCall` or `onRequest` Cloud Function, independently deployed/scaled. This is the shape to use for anything that isn't naturally an HTTP route tree — client-callable actions, webhooks, triggers.

### Adding a new standalone-function feature (e.g. payments, shipping)

Model this directly on `glowly-backend`'s `features/payments/` (`payments.functions.ts` / `payments.service.ts` / `payments.types.ts`):

1. Create `functions/src/features/<name>/<name>.types.ts` — request/response interfaces for each function in the feature.
2. Create `functions/src/features/<name>/<name>.service.ts` — plain async functions with the actual logic (Firestore reads/writes via `db` from `config/firebase.js`, collection names from `config/collections.ts`, any third-party client). No `firebase-functions` imports here — keep it framework-free and independently testable.
3. Create `functions/src/features/<name>/<name>.functions.ts` — thin `onCall`/`onRequest` exports. Each one calls `requireAuth(request)` or `requireRole(request, ...)` from `shared/errors.js` first, then delegates to the service function. Example shape:
   ```ts
   import { onCall } from 'firebase-functions/v2/https';
   import { requireAuth } from '../../shared/errors.js';
   import { createPaymentService } from './payments.service.js';
   import type { CreatePaymentRequest, CreatePaymentResponse } from './payments.types.js';

   export const createPayment = onCall<CreatePaymentRequest, Promise<CreatePaymentResponse>>(async (request) => {
     const uid = requireAuth(request);
     return createPaymentService(request.data, uid);
   });
   ```
4. Add any new Firestore collection names to `functions/src/config/collections.ts` rather than hardcoding strings.
5. Add one line to `functions/src/index.ts`: `export { createPayment, verifyPayment } from './features/payments/payments.functions.js';`

A `shipping` feature (e.g. a shipment-verification function) follows the identical recipe: `shipping.types.ts` / `shipping.service.ts` / `shipping.functions.ts`, exported from `functions/src/index.ts` the same way. If shipment verification is a webhook from a carrier/payment gateway rather than a client-callable, use `onRequest` instead of `onCall` in `<name>.functions.ts` and verify the payload signature inside the service function (HMAC or whatever the provider requires) before trusting it — do not trust unauthenticated webhook bodies.

## Commands

All commands run from inside `functions/` (`cd functions` first), matching `glowly-backend`/`al-hind-institute-backend`. A globally-installed `firebase` CLI is assumed (not a local devDependency).

- `npm install` — installs `functions/node_modules`.
- `npm run build` — compile TypeScript to `functions/lib/`.
- `npm run build:watch` — `tsc -w`, pair with the emulator for live reload.
- `npm run typecheck` — type-check without emitting.
- `npm run serve` — build, then start the Functions + Firestore + Auth emulators (Emulator UI included). Only run with the user's explicit go-ahead — see Rules above.
- `npm run deploy` — build, then `firebase deploy --only functions`. Requires `firebase login` first; only run when actually ready to push to the live `krysstal-app` project.
- `npm run logs` — tail deployed function logs.

Firebase project id lives in `.firebaserc` (`krysstal-app`) — do not duplicate it in code or env vars.
