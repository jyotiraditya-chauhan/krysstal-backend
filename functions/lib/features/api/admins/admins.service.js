import { FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../../../config/collections.js';
import { auth, db } from '../../../config/firebase.js';
import { AppError } from '../../../shared/utils/appError.js';
import { generateTempPassword } from '../../../shared/utils/generatePassword.js';
function isFirebaseAuthError(error) {
    return typeof error === 'object' && error !== null && 'code' in error;
}
export async function createAdminUser(input, createdBy) {
    const tempPassword = generateTempPassword();
    let uid;
    try {
        const userRecord = await auth.createUser({
            email: input.email,
            password: tempPassword,
            displayName: input.name,
        });
        uid = userRecord.uid;
    }
    catch (error) {
        if (isFirebaseAuthError(error) && error.code === 'auth/email-already-exists') {
            throw new AppError(409, `An account with email "${input.email}" already exists`);
        }
        throw error;
    }
    await auth.setCustomUserClaims(uid, { role: input.role });
    await db.collection(Collections.ADMINS).doc(uid).set({
        uid,
        name: input.name,
        email: input.email,
        role: input.role,
        status: 'active',
        mustChangePassword: true,
        createdBy,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return { uid, name: input.name, email: input.email, role: input.role, tempPassword };
}
export async function listAdminUsers() {
    const snapshot = await db.collection(Collections.ADMINS).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => doc.data());
}
//# sourceMappingURL=admins.service.js.map