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
    │   └── collections.ts       Firestore collection name constants (Collections.Admins, etc.)
    ├── shared/                  cross-cutting code used by more than one feature
    │   ├── errors.ts             requireAuth / requireRole guards for onCall functions (throw HttpsError) — the auth pattern actually in use. requireRole is async: it trusts the caller's role custom claim first, falling back to a read of their own admins/{uid} doc only when the claim is absent (e.g. an account whose claim was never set by the Admin SDK) — call it with await.
    │   ├── middleware/            errorHandler, notFound (Express-specific, used only by features/api/)
    │   ├── types/                 roles.ts
    │   └── utils/                 AppError, generateTempPassword
    └── features/
        └── <featureName>/        one folder per business feature
            ├── <featureName>.functions.ts   the exported onCall/onRequest/trigger handlers (thin)
            ├── <featureName>.service.ts     real logic: Firestore/Auth/third-party calls (framework-free)
            └── <featureName>.types.ts       request/response types for that feature
```

`features/api/` is currently just a `/health` check — an Express app (cors, error handling) wrapped in a single `onRequest` function named `api`. It's kept alive as the scaffold for a genuinely HTTP-route-tree feature if one shows up; when an Express-routed feature exists, it nests under `api/<featureName>/` with its own `controller.ts`/`routes.ts`/`service.ts`/`types.ts`/`validation.ts` (MVC shape, appropriate for HTTP routes sharing one function) — that nesting is specific to Express-backed features, not the default. `features/users/` (below) is the current example of the other, more common shape.

### Two shapes of feature, pick based on what the feature actually is

1. **Express-routed feature** (like `api`): many related HTTP endpoints sharing CORS/auth/error-handling middleware. Lives under one `onRequest(app)` function. New endpoints are new Express routes, not new Cloud Functions. Only reach for this when a feature is genuinely an HTTP route tree — most things aren't.
2. **Standalone function feature** (like `users`; also payments, shipping, etc.): each unit of work is its own `onCall` or `onRequest` Cloud Function, independently deployed/scaled. This is the shape to use for anything that isn't naturally an HTTP route tree — client-callable actions, webhooks, triggers. Default to this shape.

### Adding a new standalone-function feature (e.g. payments, shipping)

`features/users/` (`users.types.ts` / `users.service.ts` / `users.validation.ts` / `users.functions.ts`, exporting `createUser`) is the real worked example of this shape in this repo — model new features on it directly. There's deliberately no `listUsers` function: creating a user needs the Admin SDK (only available server-side), but listing them is a plain Firestore read with no privileged logic, so the admin console frontend reads the `admins` collection directly under `firestore.rules` instead of paying for a function invocation on every read. Default to a Cloud Function only for the parts of a feature that actually need server-side privilege or logic — plain reads a client can already do under rules don't need one. It also shows the `AppError` → `HttpsError` translation pattern for turning a service-layer business error (e.g. "email already exists", thrown as `AppError` so the service itself stays framework-free) into the right `onCall` error code — catch the specific `AppError` case in `<name>.functions.ts` and rethrow as `HttpsError`, letting anything unexpected propagate as-is.

Model this on `glowly-backend`'s `features/payments/` (`payments.functions.ts` / `payments.service.ts` / `payments.types.ts`) the same way:

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

## Firestore

`admins` (`Collections.Admins` in `functions/src/config/collections.ts`), doc ID = the Firebase Auth UID. It holds every staff/back-office account — Admin, Catalog Manager, Support Agent — kept deliberately separate from any future customer-facing `users` collection for the storefront, so the two never collide. Schema (`functions/src/features/users/users.types.ts`):

```
uid, name, email, role ('admin' | 'catalog_manager' | 'support_agent'), status ('active' | 'disabled'),
mustChangePassword, createdAt, updatedAt, createdBy
```

The `users/` feature folder name refers to the action (an Admin creating a user account) — it's the `admins` collection that action writes to. Don't let the two drift back apart.

`role` also gets set as a custom claim on the Firebase Auth user (`auth.setCustomUserClaims`) at creation time — that's what `authenticate` middleware reads off the verified ID token, not a Firestore lookup.

`firestore.rules` and `firestore.indexes.json` live at repo root (not inside `functions/`) — `firebase.json`'s `firestore.rules`/`firestore.indexes` fields point at them there, and `firebase deploy --only firestore` deploys them independently of functions.

- **Admin SDK (all code in this backend) always bypasses security rules entirely.** Rules only gate direct access from a client SDK (a separate frontend signed in with `firebase/auth`). Since every write in this backend goes through the Admin SDK, rules for a collection this backend owns are almost always `allow write: if false` — the write path is "not the client's problem to be allowed to do," not "the client is trusted to do it."
- **`callerRole()` lives at the top of `firestore.rules`, inside `match /databases/{database}/documents { ... }`, not nested inside any one collection's `match` block** — every collection below (`admins`, `categories`, `catalogs`, `variants`) shares this one function. Current rule for `admins`: a signed-in user may read their own `admins/{uid}` doc, and any signed-in user whose *effective role* is `'admin'` may read any doc in the collection (that's what lets the admin console list all staff directly, with no `listUsers` function). Effective role (`callerRole()`) prefers the caller's custom claim, but **falls back to a `get()` read of the caller's own `admins/{callerUid}` doc when the claim is absent** — this matters because `setCustomUserClaims` is only ever called from `users.service.ts`, so any admin account created outside that path (e.g. a manually bootstrapped first admin, set up directly in the Firebase console before any staff existed) has no claim at all and would otherwise be silently locked out of listing/editing staff even though `requireRole` (which has the identical claim-then-Firestore fallback) already lets them call `createUser`. Keep both fallbacks in sync if either changes. `create`/`delete` are fully denied — only `users.service.ts` (Admin SDK) can create a doc. `update` has two field-scoped exceptions: (1) a user may update *only* `mustChangePassword`/`updatedAt` on their own doc, so the frontend can clear the flag after a forced first-login password change; (2) a caller with effective role `'admin'` may update `name`/`role`/`status`/`updatedAt` on *any other* doc (`request.auth.uid != userId` is required — an admin cannot use this rule on their own doc), which is what lets the admin console edit/disable staff directly from the client, no Cloud Function involved. Deliberate tradeoff of that second rule: it does **not** reissue the target user's custom claim and does **not** touch their real Firebase Auth account, so a role edit doesn't change what `requireRole`-gated functions see for them, and "disable" doesn't block their sign-in at the Auth level or kill an already-active session — the admin console compensates by signing a user out client-side if their own doc's `status` is `'disabled'`. The `request.auth.uid != userId` guard is what stops a client from self-promoting or un-disabling their own role — never remove it.
- Pattern: one explicit `match /<collection>/{id} { ... }` block per collection a client is allowed to read, followed by a catch-all `match /{document=**} { allow read, write: if false; }` that denies everything not explicitly listed above it. Keep this catch-all last — it's the default-deny backstop.
- **When a new feature adds a Firestore collection** (e.g. a `payments` or `shipments` collection): add its name to `functions/src/config/collections.ts` first, then add a matching `match /<collection>/{id} { ... }` block in `firestore.rules` above the catch-all, scoped to only what a client genuinely needs to read directly (often nothing — if the feature is only ever read back through a callable function, no rule is needed at all beyond the default-deny).
- **`firestore.indexes.json`** only needs an entry when a Firestore query combines multiple `where()` clauses, or a `where()` with an `orderBy()` on a different field, that Firestore can't serve from a single-field index. Today it's empty (`{"indexes": [], "fieldOverrides": []}`) — every query against these collections (`admins`, `categories`, `catalogs`, `variants`) from the admin console is either a single-field sort or an unfiltered full-collection fetch, sorted/filtered client-side instead. If a new feature's query needs a composite index, either run it once against the emulator/production and copy the exact index definition Firestore's error message gives you, or run `firebase firestore:indexes` after deploying to pull the current set, then commit the result here.

### Catalog collections (`categories`, `catalogs`, `variants`)

Written entirely from the admin console client (`krysstal-admin`'s `catalog-store.ts`/`categories-store.ts`), gated by `firestore.rules` rather than any Cloud Function — there is no `catalog`/`categories` feature folder in this backend, unlike `admins`. All three collections share one rule each: `allow read, write: if request.auth != null && callerRole() in ['admin', 'catalog_manager']`, matching `roleMatrix.catalog` in the admin repo's `src/shared/model/roles.ts` (Admin and Catalog Manager can both manage the catalog; Support Agent can't).

- **`categories/{id}`**: `name, parent, status, createdAt, updatedAt`. `parent` is a plain category-name string (`'—'` = top-level, `'Collection'` = a curated cross-cutting group, or another category's `name`) — this is how one parent ends up with several subcategories: every child doc just sets `parent` to the same parent name. Not ID-based on purpose, to keep the admin UI's existing `parentOptions: string[]` contract (a flat list of names) unchanged. Renaming a parent doesn't cascade to its children's `parent` field — accepted tradeoff, documented in the admin repo's plan for this feature.
- **`catalogs/{uid}`**: doc id is a generated uid (also stored redundantly as the `uid` field, same pattern as `admins/{uid}`) — **not** the product's slug. `slug` is a separate, stable field computed once from the name at creation and never recomputed on rename, which is what the route (`/catalog/$slug/edit`) and all `Link`s actually key off; the two are deliberately decoupled so renaming a product (or two products slugifying to the same string) can never collide on the doc id the way it would if slug were still the key. Holds the product-level fields described in `Krysstal_Catalog_Model.pdf` (name, category, description, images, specs, packageContents, faq, warranty, status, published, displayPrice/displayMrp/variantCount as save-time snapshots) plus `categoryId` (resolved from `categories` by name at save time, best-effort — not enforced by a rule, since blocking a save over a stale category reference would be worse than a soft link) and `subCategories: string[]` (names of the picked child categories under `category`, required at save time whenever that category has any children — also a soft/name-only reference, same tradeoff as `categoryId`).
- **`variants/{id}`**: doc id is a deterministic slug of `productUid + finish + size + material` (see `variantId()` in the admin repo's `catalog-data.ts`) — a **separate top-level collection**, not a subcollection or embedded array, joined to its catalog doc purely by the `productUid` field. Per the PDF: deleting a `catalogs` doc does not cascade-delete its variants — the admin's `removeProduct()` must explicitly batch-delete every variant with that `productUid`, or they're orphaned.

### Storage (`storage.rules`, new alongside `firestore.rules`)

Product/variant images uploaded by the admin console go to Firebase Storage under `catalogs/{productUid}/{randomId}` (the catalog doc's generated uid, not its display slug), not this backend — there is no upload Cloud Function. `storage.rules` (wired into `firebase.json`'s `storage.rules` key, deployed via `firebase deploy --only storage`) allows public read (needed for eventual storefront/mobile display) and gates write on the same admin/catalog_manager effective-role check as Firestore — Storage rules can't share a `function` with `firestore.rules`, so the claim-then-`firestore.get()`-fallback logic is **duplicated** in `storage.rules`; keep both in sync if the role check ever changes.

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
