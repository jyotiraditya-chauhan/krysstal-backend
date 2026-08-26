import type { Request, Response } from 'express';
import { AppError } from '../../../shared/utils/appError.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import { createUser, listUsers } from './users.service.js';
import { createUserSchema } from './users.validation.js';

export const createUserHandler = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues.map(issue => issue.message).join(', '));
  }

  const result = await createUser(parsed.data, req.user!.uid);
  res.status(201).json(result);
});

export const listUsersHandler = asyncHandler(async (_req: Request, res: Response) => {
  const users = await listUsers();
  res.status(200).json(users);
});
