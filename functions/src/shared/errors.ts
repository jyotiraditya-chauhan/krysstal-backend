import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { UserRole } from './types/roles.js';

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required');
  }
  return request.auth.uid;
}

export function requireRole(request: CallableRequest, ...allowedRoles: UserRole[]): string {
  const uid = requireAuth(request);
  const role = request.auth?.token.role as UserRole | undefined;

  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', 'Insufficient permissions for this action');
  }

  return uid;
}
