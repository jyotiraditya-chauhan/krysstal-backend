# Notifications

How the `notifications` feature works and how to call it, for anyone integrating the admin
console, the Flutter app, or a future backend feature (orders, payments, etc.) against it.

## What this is

Two Cloud Functions plus a Firestore collection:

- `sendNotification` — one customer gets a push notification and an inbox entry.
- `broadcastNotification` — many/all customers get a push notification and share one inbox
  entry.
- `notifications/{id}` — the Firestore collection both functions write to. The Flutter app reads
  this collection directly (client SDK) to render an in-app notification inbox; it does not call
  a Cloud Function to *read* notifications, only staff call functions to *send* them.

Source: `functions/src/features/notifications/`. Rules: `firestore.rules` (`match
/notifications/{id}`). Index: `firestore.indexes.json` (`notifications` collection group).

## Data model

### `notifications/{id}` document

```ts
{
  to: string;        // a customer's uid, or the literal string 'bulk' for a broadcast
  from: string;       // the staff uid who sent it, or a synthetic value like 'system'
  type: string;       // see "Notification types" below — any non-empty string is accepted
  title: string;
  body: string;
  data: Record<string, string>;  // arbitrary key/value payload, e.g. { orderId: '123' }
  isRead: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

There is **one document per `sendNotification` call** (`to` = that customer's uid) and **one
document per `broadcastNotification` call**, shared by everyone who was targeted (`to ==
'bulk'`) — broadcasts do not fan out into one doc per recipient. That keeps writes cheap for a
"notify everyone" blast, but it means `isRead` on a bulk doc is a single shared flag, not a
per-user read receipt (see "Known limitations" below).

### `users/{uid}.tokens`

Both functions read device push tokens off the existing customer doc (written by the Flutter
app's `AuthService`, not by this backend):

```ts
tokens: Array<{ language: string; token: string; addedAt: Timestamp }>
```

A user with an empty `tokens` array (no push token registered, e.g. web-only or just installed)
still gets a `notifications` doc — they'll see it next time they open the inbox, they just won't
get a push.

## Notification types

`type` is a free-form, non-empty string — **not** a strict enum — so a future feature can
introduce a new type value without touching this feature's code. `NOTIFICATION_TYPES` in
`notifications.types.ts` lists the currently-known values for autocomplete/documentation
purposes only:

```
order_placed, order_confirmed, order_shipped, order_out_for_delivery, order_delivered,
order_cancelled, order_returned, payment_success, payment_failed, refund_processed,
coins_earned, coins_redeemed, coins_reversed, gst_added, gst_updated,
wishlist_item_back_in_stock, wishlist_price_drop, staff_message, broadcast
```

None of the order/payment ones are wired to a real feature yet (this backend has no
orders/payments feature today) — they're here so the Flutter app's inbox UI can start
branching/iconography on `type` now, ahead of those features shipping.

## Calling the Cloud Functions

Both are `onCall` functions, gated by `requireRole(request, 'admin', 'catalog_manager',
'support_agent')` — any signed-in staff member (from the `admins` collection) can call either
one. A plain customer cannot call them.

### `sendNotification` — one customer

Request:

```ts
{
  uid: string;              // required — target customer's Firebase Auth uid
  type: string;             // required — e.g. 'order_shipped'
  title: string;            // required, max 200 chars
  body: string;             // required, max 1000 chars
  data?: Record<string, string>;  // optional extra payload, also included in the FCM data message
}
```

Response:

```ts
{ id: string; delivered: number; failed: number; }
```

`id` is the new `notifications/{id}` doc id. `delivered`/`failed` count FCM sends across that
user's device tokens (0/0 if they have none registered — still succeeds, still creates the doc).

Errors: `unauthenticated` (no caller), `permission-denied` (caller isn't staff),
`invalid-argument` (bad payload), `not-found` (no `users/{uid}` doc for that uid).

Example call from the admin console (JS/TS, `firebase/functions`):

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';

const sendNotification = httpsCallable(getFunctions(), 'sendNotification');
await sendNotification({
  uid: 'abc123',
  type: 'order_shipped',
  title: 'Your order has shipped',
  body: 'Order #4821 is on its way.',
  data: { orderId: '4821' },
});
```

### `broadcastNotification` — many or all customers

Request:

```ts
{
  targetUserIds?: string[]; // omit for "every user in the users collection"; [] for "nobody"
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
```

Response:

```ts
{ id: string; usersNotified: number; delivered: number; failed: number; }
```

`usersNotified` is however many of the target users actually exist (unknown/stale ids in
`targetUserIds` are silently skipped, not an error). `id` is the single shared
`notifications/{id}` doc (`to: 'bulk'`) every targeted customer will see in their inbox.

Same error set as `sendNotification`, minus `not-found` (a missing/stale uid in `targetUserIds`
is skipped, not fatal).

Example — announce to everyone:

```ts
const broadcastNotification = httpsCallable(getFunctions(), 'broadcastNotification');
await broadcastNotification({
  type: 'broadcast',
  title: 'App update available',
  body: 'Update to the latest version for a smoother checkout.',
});
```

Example — a targeted subset:

```ts
await broadcastNotification({
  targetUserIds: ['uid1', 'uid2', 'uid3'],
  type: 'wishlist_price_drop',
  title: 'Price drop on your wishlist',
  body: 'An item you saved just got cheaper.',
});
```

## Reading the inbox (Flutter app, client SDK — no Cloud Function involved)

Query "my notifications, newest first":

```dart
FirebaseFirestore.instance
  .collection('notifications')
  .where('to', whereIn: [myUid, 'bulk'])
  .orderBy('createdAt', descending: true)
```

This is exactly the query the `notifications` composite index in `firestore.indexes.json`
supports. Marking one read (only works for a personal notification, `to == myUid` — see
limitation below):

```dart
FirebaseFirestore.instance.collection('notifications').doc(id).update({
  'isRead': true,
  'updatedAt': FieldValue.serverTimestamp(),
});
```

`firestore.rules` enforces that a customer can only touch `isRead`/`updatedAt` on their own doc,
nothing else — trying to edit `title`, `body`, `type`, etc. is rejected.

## Firing a notification from another backend feature (no HTTP call, no role check)

The actual send logic lives in plain, framework-free functions in `notifications.service.ts`
that take an explicit `from` string instead of pulling it off `request.auth`:

```ts
import { sendNotification } from '../notifications/notifications.service.js';

await sendNotification(
  { uid, type: 'gst_added', title: 'GST details added', body: 'Your GST details were saved.' },
  'system',
);
```

This is how a future feature (e.g. a Firestore trigger on `users/{uid}` watching for a `gst`
field change, or an orders feature marking a shipment) should fire a notification — import the
service function directly and call it with a synthetic `from`. It does not go through
`requireRole` or the `onCall` wrapper at all, so there's no "staff member" concept involved; the
caller is just trusted backend code.

## FCM delivery details

- Sends go through `messaging.sendEachForMulticast`, batched at 500 tokens per call (the FCM
  hard limit) — one network round trip per 500 devices, not one call per device.
- Every push includes `android: { priority: 'high' }` and an APNs default sound.
- A token that comes back `messaging/invalid-registration-token` or
  `messaging/registration-token-not-registered` is automatically removed from that user's
  `users/{uid}.tokens` array. This happens as a best-effort side effect after the notification
  doc is written — it never blocks or fails the call.
- If the entire FCM call throws (network/auth-level failure, not a per-token error), that batch
  counts as fully failed but the notification doc is still written — the in-app inbox stays
  correct even if push delivery is down.

## Known limitations (accepted tradeoffs, not bugs)

- **No translations.** Whatever `title`/`body` you send goes out as-is to every device,
  regardless of that device's `language` field on its `DeviceToken`.
- **Bulk `isRead` is shared, not per-user.** Since a broadcast is one document read by everyone,
  there's no way for one customer to mark it "read" without affecting what every other customer
  sees — so `firestore.rules` simply doesn't let customers update a `to == 'bulk'` doc at all. If
  a per-user read receipt on broadcasts is ever needed, that requires a different storage shape
  (e.g. a `reads` subcollection) — deliberately not built now.
- **No notification preferences / opt-out.** `KrysstalUser` has no such field today; every
  notification is sent regardless of category.
- **No orders/payments feature exists yet.** The order/payment `type` values are placeholders for
  when those features ship — nothing calls `sendNotification` with them today.

## Deployment

This feature deploys like any other function/rules change in this repo:

```bash
cd functions
npm run deploy          # builds, then `firebase deploy --only functions` (all functions)
```

```bash
firebase deploy --only firestore   # from repo root — pushes firestore.rules + firestore.indexes.json
```

The composite index for `notifications` builds asynchronously in the background after the rules
deploy — check the Firebase console's Firestore → Indexes tab if the Flutter app's inbox query
errors with a "requires an index" message right after a fresh deploy; it typically finishes
within a few minutes.
