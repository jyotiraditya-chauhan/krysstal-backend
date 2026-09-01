import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireRole } from '../../shared/errors.js';
import { AppError } from '../../shared/utils/appError.js';
import { createUser as createUserService } from './users.service.js';
import type { CreateUserRequest, CreateUserResponse } from './users.types.js';
import { createUserSchema } from './users.validation.js';

export const createUser = onCall<CreateUserRequest, Promise<CreateUserResponse>>(async request => {
  const uid = requireRole(request, 'Admin');

  const parsed = createUserSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.issues.map(issue => issue.message).join(', '));
  }

  try {
    return await createUserService(parsed.data, uid);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      throw new HttpsError('already-exists', error.message);
    }
    throw error;
  }
});
