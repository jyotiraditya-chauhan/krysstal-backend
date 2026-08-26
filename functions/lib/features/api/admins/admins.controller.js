import { AppError } from '../../../shared/utils/appError.js';
import { asyncHandler } from '../../../shared/utils/asyncHandler.js';
import { createAdminUser, listAdminUsers } from './admins.service.js';
import { createAdminSchema } from './admins.validation.js';
export const createAdmin = asyncHandler(async (req, res) => {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new AppError(400, parsed.error.issues.map(issue => issue.message).join(', '));
    }
    const result = await createAdminUser(parsed.data, req.user.uid);
    res.status(201).json(result);
});
export const listAdmins = asyncHandler(async (_req, res) => {
    const admins = await listAdminUsers();
    res.status(200).json(admins);
});
//# sourceMappingURL=admins.controller.js.map