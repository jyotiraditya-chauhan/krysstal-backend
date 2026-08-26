import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { authorize } from '../../../shared/middleware/authorize.js';
import { createAdmin, listAdmins } from './admins.controller.js';
export const adminsRouter = Router();
adminsRouter.use(authenticate, authorize('Admin'));
adminsRouter.post('/', createAdmin);
adminsRouter.get('/', listAdmins);
//# sourceMappingURL=admins.routes.js.map