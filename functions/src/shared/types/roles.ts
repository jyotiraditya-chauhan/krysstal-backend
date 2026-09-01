export const USER_ROLES = ['admin', 'catalog_manager', 'support_agent'] as const;

export type UserRole = (typeof USER_ROLES)[number];
