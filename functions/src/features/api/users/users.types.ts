import type { Timestamp } from 'firebase-admin/firestore';
import type { UserRole } from '../../../shared/types/roles.js';

export type UserStatus = 'active' | 'disabled';

export type UserDoc = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
};

export type CreateUserResult = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  tempPassword: string;
};
