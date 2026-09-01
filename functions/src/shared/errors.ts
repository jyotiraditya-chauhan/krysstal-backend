import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { Collections } from '../config/collections.js';
import { db } from '../config/firebase.js';
import type { UserRole } from './types/roles.js';

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required');
  }
  return request.auth.uid;
}

export async function requireRole(request: CallableRequest, ...allowedRoles: UserRole[]): Promise<string> {
  const uid = requireAuth(request);
  let role = request.auth?.token.role as UserRole | undefined;

  if (!role) {
    const snapshot = await db.collection(Collections.Admins).doc(uid).get();
    role = snapshot.data()?.role as UserRole | undefined;
  }

  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', 'Insufficient permissions for this action');
  }

  return uid;
}
