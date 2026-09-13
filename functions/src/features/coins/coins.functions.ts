import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireRole } from '../../shared/errors.js';
import { AppError } from '../../shared/utils/appError.js';
import { adjustCoinBalance as adjustCoinBalanceService } from './coins.service.js';
import type { AdjustCoinsRequest, AdjustCoinsResponse } from './coins.types.js';
import { adjustCoinsSchema } from './coins.validation.js';

export const adjustCoinBalance = onCall<AdjustCoinsRequest, Promise<AdjustCoinsResponse>>(async request => {
  const adminUid = await requireRole(request, 'admin');

  const parsed = adjustCoinsSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map(issue => issue.message).join(', '));
  }

  try {
    return await adjustCoinBalanceService(parsed.data, adminUid);
  } catch (error) {
    if (error instanceof AppError) {
      throw new HttpsError(error.statusCode === 404 ? 'not-found' : 'failed-precondition', error.message);
    }
    throw error;
  }
});
