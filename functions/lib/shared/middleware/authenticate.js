import { auth } from '../../config/firebase.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const authenticate = asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        throw new AppError(401, 'Missing or malformed Authorization header');
    }
    const idToken = header.slice('Bearer '.length);
    const decoded = await auth.verifyIdToken(idToken).catch(() => {
        throw new AppError(401, 'Invalid or expired token');
    });
    if (!decoded.role) {
        throw new AppError(403, 'Account has no assigned role');
    }
    req.user = {
        uid: decoded.uid,
        email: decoded.email ?? '',
        role: decoded.role,
    };
    next();
});
//# sourceMappingURL=authenticate.js.map