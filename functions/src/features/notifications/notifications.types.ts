import type { Timestamp } from 'firebase-admin/firestore';

export const NOTIFICATION_TYPES = [
  'order_placed',
  'order_confirmed',
  'order_shipped',
  'order_out_for_delivery',
  'order_delivered',
  'order_cancelled',
  'order_returned',
  'payment_success',
  'payment_failed',
  'refund_processed',
  'coins_earned',
  'coins_redeemed',
  'coins_reversed',
  'gst_added',
  'gst_updated',
  'wishlist_item_back_in_stock',
  'wishlist_price_drop',
  'staff_message',
  'broadcast',
] as const;

export type KnownNotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationType = KnownNotificationType | (string & {});

export type DeviceToken = {
  language: string;
  token: string;
  addedAt: Timestamp;
};

export type NotificationDoc = {
  to: string;
  from: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  isRead: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SendNotificationRequest = {
  uid: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type SendNotificationResponse = {
  id: string;
  delivered: number;
  failed: number;
};

export type BroadcastNotificationRequest = {
  targetUserIds?: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type BroadcastNotificationResponse = {
  id: string;
  usersNotified: number;
  delivered: number;
  failed: number;
};
