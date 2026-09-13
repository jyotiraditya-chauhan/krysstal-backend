import { FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../../config/collections.js';
import { db } from '../../config/firebase.js';
import { AppError } from '../../shared/utils/appError.js';
import type { AdjustCoinsResponse } from './coins.types.js';
import type { AdjustCoinsInput } from './coins.validation.js';

export async function adjustCoinBalance(
  input: AdjustCoinsInput,
  adminUid: string
): Promise<AdjustCoinsResponse> {
  const adminSnap = await db.collection(Collections.Admins).doc(adminUid).get();
  const adminName = (adminSnap.data()?.name as string | undefined) ?? 'Unknown';

  const userRef = db.collection(Collections.Users).doc(input.uid);
  const transactionRef = db.collection(Collections.CoinTransactions).doc();

  const balanceAfter = await db.runTransaction(async transaction => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new AppError(404, 'Customer not found');
    }

    const currentBalance = (userSnap.data()?.coinBalance as number | undefined) ?? 0;
    const nextBalance = currentBalance + input.coins;
    if (nextBalance < 0) {
      throw new AppError(400, 'This operation would take the customer below a zero coin balance');
    }

    transaction.set(transactionRef, {
      uid: input.uid,
      transactionType: input.transactionType,
      coins: input.coins,
      reason: input.reason,
      balanceAfter: nextBalance,
      isAdminReversed: input.transactionType === 'reversed',
      adminId: adminUid,
      adminName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(userRef, {
      coinBalance: nextBalance,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return nextBalance;
  });

  return { id: transactionRef.id, balanceAfter };
}
