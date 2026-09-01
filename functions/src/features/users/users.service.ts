import { FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../../config/collections.js';
import { auth, db } from '../../config/firebase.js';
import { AppError } from '../../shared/utils/appError.js';
import { generateTempPassword } from '../../shared/utils/generatePassword.js';
import type { CreateUserResponse } from './users.types.js';
import type { CreateUserInput } from './users.validation.js';

function isFirebaseAuthError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export async function createUser(input: CreateUserInput, createdBy: string): Promise<CreateUserResponse> {
  const tempPassword = generateTempPassword();

  let uid: string;
  try {
    const userRecord = await auth.createUser({
      email: input.email,
      password: tempPassword,
      displayName: input.name,
    });
    uid = userRecord.uid;
  } catch (error) {
    if (isFirebaseAuthError(error) && error.code === 'auth/email-already-exists') {
      throw new AppError(409, `An account with email "${input.email}" already exists`);
    }
    throw error;
  }

  await auth.setCustomUserClaims(uid, { role: input.role });

  await db.collection(Collections.Admins).doc(uid).set({
    uid,
    name: input.name,
    email: input.email,
    role: input.role,
    status: 'active',
    mustChangePassword: true,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { uid, name: input.name, email: input.email, role: input.role, tempPassword };
}
