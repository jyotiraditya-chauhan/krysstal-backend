export const ADMIN_ROLES = ['Admin', 'Catalog Manager', 'Support Agent'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
