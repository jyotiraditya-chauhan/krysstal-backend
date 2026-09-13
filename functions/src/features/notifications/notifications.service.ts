import { FieldValue } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { Collections } from '../../config/collections.js';
import { db, messaging } from '../../config/firebase.js';
import { AppError } from '../../shared/utils/appError.js';
import type { BroadcastNotificationResponse, DeviceToken, SendNotificationResponse } from './notifications.types.js';
import type { BroadcastNotificationInput, SendNotificationInput } from './notifications.validation.js';

const FCM_TOKEN_BATCH_SIZE = 500;
const USER_PAGE_SIZE = 500;
const BULK_NOTIFICATION_TO = 'bulk';

type UserToken = { uid: string; token: string };

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isInvalidTokenErrorCode(code: string): boolean {
  return code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered';
}

async function dispatchToTokens(
  userTokens: UserToken[],
  notification: { title: string; body: string },
  data: Record<string, string>,
): Promise<{ delivered: number; failed: number; invalidTokensByUid: Map<string, Set<string>> }> {
  let delivered = 0;
  let failed = 0;
  const invalidTokensByUid = new Map<string, Set<string>>();

  for (const batch of chunk(userTokens, FCM_TOKEN_BATCH_SIZE)) {
    let response;
    try {
      response = await messaging.sendEachForMulticast({
        tokens: batch.map(entry => entry.token),
        notification,
        ...(Object.keys(data).length > 0 ? { data } : {}),
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch {
      failed += batch.length;
      continue;
    }

    delivered += response.successCount;
    failed += response.failureCount;
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const entry = batch[index];
      const errorCode = result.error?.code;
      if (entry && errorCode && isInvalidTokenErrorCode(errorCode)) {
        const invalidTokens = invalidTokensByUid.get(entry.uid) ?? new Set<string>();
        invalidTokens.add(entry.token);
        invalidTokensByUid.set(entry.uid, invalidTokens);
      }
    });
  }

  return { delivered, failed, invalidTokensByUid };
}

async function pruneUserTokens(uid: string, invalidTokens: Set<string>): Promise<void> {
  const userRef = db.collection(Collections.Users).doc(uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) return;
  const currentTokens = (snapshot.data()?.tokens as DeviceToken[] | undefined) ?? [];
  const nextTokens = currentTokens.filter(deviceToken => !invalidTokens.has(deviceToken.token));
  if (nextTokens.length === currentTokens.length) return;
  await userRef.update({ tokens: nextTokens, updatedAt: FieldValue.serverTimestamp() });
}

async function pruneInvalidTokens(invalidTokensByUid: Map<string, Set<string>>): Promise<void> {
  await Promise.all(
    Array.from(invalidTokensByUid.entries()).map(([uid, invalidTokens]) => pruneUserTokens(uid, invalidTokens)),
  );
}

export async function sendNotification(input: SendNotificationInput, from: string): Promise<SendNotificationResponse> {
  const userSnap = await db.collection(Collections.Users).doc(input.uid).get();
  if (!userSnap.exists) throw new AppError(404, 'Customer not found');

  const deviceTokens = (userSnap.data()?.tokens as DeviceToken[] | undefined) ?? [];
  const userTokens = deviceTokens.map(deviceToken => ({ uid: input.uid, token: deviceToken.token }));

  const notificationRef = db.collection(Collections.Notifications).doc();
  const fcmData = { ...(input.data ?? {}), type: input.type, notificationId: notificationRef.id };

  const { delivered, failed, invalidTokensByUid } = await dispatchToTokens(
    userTokens,
    { title: input.title, body: input.body },
    fcmData,
  );

  await notificationRef.set({
    to: input.uid,
    from,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (invalidTokensByUid.size > 0) await pruneInvalidTokens(invalidTokensByUid);

  return { id: notificationRef.id, delivered, failed };
}

async function collectAllUserTokens(): Promise<{ userCount: number; userTokens: UserToken[] }> {
  let userCount = 0;
  const userTokens: UserToken[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = db.collection(Collections.Users).orderBy('__name__').limit(USER_PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const doc of snapshot.docs) {
      userCount += 1;
      const deviceTokens = (doc.data()?.tokens as DeviceToken[] | undefined) ?? [];
      for (const deviceToken of deviceTokens) userTokens.push({ uid: doc.id, token: deviceToken.token });
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < USER_PAGE_SIZE) break;
  }
  return { userCount, userTokens };
}

async function collectUserTokensById(userIds: string[]): Promise<{ userCount: number; userTokens: UserToken[] }> {
  if (userIds.length === 0) return { userCount: 0, userTokens: [] };
  const refs = userIds.map(uid => db.collection(Collections.Users).doc(uid));
  const snapshots = await db.getAll(...refs);
  let userCount = 0;
  const userTokens: UserToken[] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    userCount += 1;
    const deviceTokens = (snapshot.data()?.tokens as DeviceToken[] | undefined) ?? [];
    for (const deviceToken of deviceTokens) userTokens.push({ uid: snapshot.id, token: deviceToken.token });
  }
  return { userCount, userTokens };
}

export async function broadcastNotification(
  input: BroadcastNotificationInput,
  from: string,
): Promise<BroadcastNotificationResponse> {
  const { userCount, userTokens } =
    input.targetUserIds !== undefined ? await collectUserTokensById(input.targetUserIds) : await collectAllUserTokens();

  const fcmData = { ...(input.data ?? {}), type: input.type };
  const { delivered, failed, invalidTokensByUid } = await dispatchToTokens(
    userTokens,
    { title: input.title, body: input.body },
    fcmData,
  );

  const notificationRef = db.collection(Collections.Notifications).doc();
  await notificationRef.set({
    to: BULK_NOTIFICATION_TO,
    from,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (invalidTokensByUid.size > 0) await pruneInvalidTokens(invalidTokensByUid);

  return { id: notificationRef.id, usersNotified: userCount, delivered, failed };
}
