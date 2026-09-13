import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireRole } from '../../shared/errors.js';
import { AppError } from '../../shared/utils/appError.js';
import { broadcastNotification as broadcastNotificationService, sendNotification as sendNotificationService } from './notifications.service.js';
import type { BroadcastNotificationRequest, BroadcastNotificationResponse, SendNotificationRequest, SendNotificationResponse } from './notifications.types.js';
import { broadcastNotificationSchema, sendNotificationSchema } from './notifications.validation.js';

export const sendNotification = onCall<SendNotificationRequest, Promise<SendNotificationResponse>>(async request => {
  const staffUid = await requireRole(request, 'admin', 'catalog_manager', 'support_agent');
  const parsed = sendNotificationSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues.map(issue => issue.message).join(', '));
  try {
    return await sendNotificationService(parsed.data, staffUid);
  } catch (error) {
    if (error instanceof AppError) throw new HttpsError(error.statusCode === 404 ? 'not-found' : 'failed-precondition', error.message);
    throw error;
  }
});

export const broadcastNotification = onCall<BroadcastNotificationRequest, Promise<BroadcastNotificationResponse>>(async request => {
  const staffUid = await requireRole(request, 'admin', 'catalog_manager', 'support_agent');
  const parsed = broadcastNotificationSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues.map(issue => issue.message).join(', '));
  try {
    return await broadcastNotificationService(parsed.data, staffUid);
  } catch (error) {
    if (error instanceof AppError) throw new HttpsError(error.statusCode === 404 ? 'not-found' : 'failed-precondition', error.message);
    throw error;
  }
});
