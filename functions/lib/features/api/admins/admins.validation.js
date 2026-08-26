import { z } from 'zod';
import { ADMIN_ROLES } from '../../../shared/types/roles.js';
export const createAdminSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    role: z.enum(ADMIN_ROLES),
});
//# sourceMappingURL=admins.validation.js.map