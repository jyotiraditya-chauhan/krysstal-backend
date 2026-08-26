import { AppError } from '../utils/appError.js';
export function authorize(...allowedRoles) {
    return (req, _res, next) => {
        if (!req.user) {
            throw new AppError(401, 'Not authenticated');
        }
        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError(403, 'Insufficient permissions for this action');
        }
        next();
    };
}
//# sourceMappingURL=authorize.js.map