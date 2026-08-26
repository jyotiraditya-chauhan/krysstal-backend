import type { Timestamp } from 'firebase-admin/firestore';
import type { AdminRole } from '../../../shared/types/roles.js';

export type AdminStatus = 'active' | 'disabled';

export type AdminDoc = {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  mustChangePassword: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
};

export type CreateAdminResult = {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
  tempPassword: string;
};
