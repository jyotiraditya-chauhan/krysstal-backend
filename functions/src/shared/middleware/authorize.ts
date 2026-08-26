import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '../types/roles.js';
import { AppError } from '../utils/appError.js';

export function authorize(...allowedRoles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, 'Insufficient permissions for this action');
    }

    next();
  };
}
