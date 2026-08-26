import type { AdminRole } from './roles.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        role: AdminRole;
      };
    }
  }
}

export {};
