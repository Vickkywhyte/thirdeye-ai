import type { UserRole } from '@/types/database'

export type Permission =
  | 'investigations:read'
  | 'investigations:create'
  | 'investigations:update'
  | 'investigations:delete'
  | 'entities:read'
  | 'entities:create'
  | 'entities:update'
  | 'entities:delete'
  | 'screening:run'
  | 'screening:review'
  | 'reports:read'
  | 'reports:create'
  | 'reports:update'
  | 'reports:delete'
  | 'reports:approve'
  | 'documents:read'
  | 'documents:upload'
  | 'documents:delete'
  | 'notes:read'
  | 'notes:create'
  | 'notes:update'
  | 'notes:delete'
  | 'users:read'
  | 'users:invite'
  | 'users:update_role'
  | 'users:remove'
  | 'org:read'
  | 'org:update'
  | 'org:billing'
  | 'api_keys:read'
  | 'api_keys:manage'
  | 'audit_log:read'
  | 'settings:read'
  | 'settings:update'

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  owner: [
    'investigations:read', 'investigations:create', 'investigations:update', 'investigations:delete',
    'entities:read', 'entities:create', 'entities:update', 'entities:delete',
    'screening:run', 'screening:review',
    'reports:read', 'reports:create', 'reports:update', 'reports:delete', 'reports:approve',
    'documents:read', 'documents:upload', 'documents:delete',
    'notes:read', 'notes:create', 'notes:update', 'notes:delete',
    'users:read', 'users:invite', 'users:update_role', 'users:remove',
    'org:read', 'org:update', 'org:billing',
    'api_keys:read', 'api_keys:manage',
    'audit_log:read',
    'settings:read', 'settings:update',
  ],
  admin: [
    'investigations:read', 'investigations:create', 'investigations:update', 'investigations:delete',
    'entities:read', 'entities:create', 'entities:update', 'entities:delete',
    'screening:run', 'screening:review',
    'reports:read', 'reports:create', 'reports:update', 'reports:delete', 'reports:approve',
    'documents:read', 'documents:upload', 'documents:delete',
    'notes:read', 'notes:create', 'notes:update', 'notes:delete',
    'users:read', 'users:invite', 'users:update_role', 'users:remove',
    'org:read', 'org:update',
    'api_keys:read', 'api_keys:manage',
    'audit_log:read',
    'settings:read', 'settings:update',
  ],
  analyst: [
    'investigations:read', 'investigations:create', 'investigations:update',
    'entities:read', 'entities:create', 'entities:update',
    'screening:run', 'screening:review',
    'reports:read', 'reports:create', 'reports:update',
    'documents:read', 'documents:upload',
    'notes:read', 'notes:create', 'notes:update',
    'users:read',
    'org:read',
    'audit_log:read',
    'settings:read',
  ],
  viewer: [
    'investigations:read',
    'entities:read',
    'reports:read',
    'documents:read',
    'notes:read',
    'users:read',
    'org:read',
    'settings:read',
  ],
} as const

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission)
}

export function getPermissions(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
}

export function isRoleAtLeast(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(
      `Forbidden: role "${role}" lacks permission "${permission}"`,
    )
  }
}

export async function requirePermissionFromRequest(
  getUserRole: () => Promise<UserRole | null>,
  permission: Permission,
): Promise<UserRole> {
  const role = await getUserRole()
  if (!role) {
    throw new Error('Unauthorized: no authenticated user')
  }
  requirePermission(role, permission)
  return role
}
