import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { authorize } from '../../../shared/middleware/authorize.js';
import { createUserHandler, listUsersHandler } from './users.controller.js';

export const usersRouter = Router();

usersRouter.use(authenticate, authorize('Admin'));

usersRouter.post('/', createUserHandler);
usersRouter.get('/', listUsersHandler);
