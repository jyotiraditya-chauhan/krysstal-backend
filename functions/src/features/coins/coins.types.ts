import type { Timestamp } from 'firebase-admin/firestore';

export type CoinTransactionType = 'earned' | 'redeemed' | 'reversed';

export type CoinTransactionDoc = {
  uid: string;
  transactionType: CoinTransactionType;
  coins: number;
  reason: string;
  balanceAfter: number;
  isAdminReversed: boolean;
  adminId: string;
  adminName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AdjustCoinsRequest = {
  uid: string;
  transactionType: CoinTransactionType;
  coins: number;
  reason: string;
};

export type AdjustCoinsResponse = {
  id: string;
  balanceAfter: number;
};
