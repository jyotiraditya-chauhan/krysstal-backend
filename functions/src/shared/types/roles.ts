export const USER_ROLES = ['Admin', 'Catalog Manager', 'Support Agent'] as const;

export type UserRole = (typeof USER_ROLES)[number];
