import { z } from 'zod';

export const sendNotificationSchema = z.object({
  uid: z.string().trim().min(1, 'Customer is required'),
  type: z.string().trim().min(1, 'Notification type is required'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(1000),
  data: z.record(z.string(), z.string()).optional(),
});

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

export const broadcastNotificationSchema = z.object({
  targetUserIds: z.array(z.string().trim().min(1)).optional(),
  type: z.string().trim().min(1, 'Notification type is required'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().min(1, 'Body is required').max(1000),
  data: z.record(z.string(), z.string()).optional(),
});

export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
