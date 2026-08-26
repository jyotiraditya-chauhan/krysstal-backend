import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { AdminRole } from './types/roles.js';

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required');
  }
  return request.auth.uid;
}

export function requireRole(request: CallableRequest, ...allowedRoles: AdminRole[]): string {
  const uid = requireAuth(request);
  const role = request.auth?.token.role as AdminRole | undefined;

  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', 'Insufficient permissions for this action');
  }

  return uid;
}
