import { HttpsError } from 'firebase-functions/v2/https';
export function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign-in required');
    }
    return request.auth.uid;
}
export function requireRole(request, ...allowedRoles) {
    const uid = requireAuth(request);
    const role = request.auth?.token.role;
    if (!role || !allowedRoles.includes(role)) {
        throw new HttpsError('permission-denied', 'Insufficient permissions for this action');
    }
    return uid;
}
//# sourceMappingURL=errors.js.map