import { describe, it, expect } from 'vitest'
import { hasPermission, isRoleAtLeast, requirePermission } from './rbac'

describe('hasPermission', () => {
  it('owner has all permissions', () => {
    expect(hasPermission('owner', 'investigations:read')).toBe(true)
    expect(hasPermission('owner', 'investigations:create')).toBe(true)
    expect(hasPermission('owner', 'investigations:delete')).toBe(true)
    expect(hasPermission('owner', 'users:remove')).toBe(true)
    expect(hasPermission('owner', 'org:billing')).toBe(true)
    expect(hasPermission('owner', 'settings:update')).toBe(true)
  })

  it('viewer can only read', () => {
    expect(hasPermission('viewer', 'investigations:read')).toBe(true)
    expect(hasPermission('viewer', 'entities:read')).toBe(true)
    expect(hasPermission('viewer', 'reports:read')).toBe(true)
  })

  it('viewer cannot create investigations', () => {
    expect(hasPermission('viewer', 'investigations:create')).toBe(false)
  })

  it('viewer cannot create entities', () => {
    expect(hasPermission('viewer', 'entities:create')).toBe(false)
  })

  it('analyst cannot delete investigations', () => {
    expect(hasPermission('analyst', 'investigations:delete')).toBe(false)
  })

  it('analyst can create investigations', () => {
    expect(hasPermission('analyst', 'investigations:create')).toBe(true)
  })

  it('analyst can run screening', () => {
    expect(hasPermission('analyst', 'screening:run')).toBe(true)
  })

  it('admin can manage users', () => {
    expect(hasPermission('admin', 'users:invite')).toBe(true)
    expect(hasPermission('admin', 'users:update_role')).toBe(true)
    expect(hasPermission('admin', 'users:remove')).toBe(true)
  })

  it('admin cannot access billing', () => {
    expect(hasPermission('admin', 'org:billing')).toBe(false)
  })
})

describe('isRoleAtLeast', () => {
  it('owner is at least viewer', () => {
    expect(isRoleAtLeast('owner', 'viewer')).toBe(true)
  })

  it('viewer is not at least admin', () => {
    expect(isRoleAtLeast('viewer', 'admin')).toBe(false)
  })

  it('analyst is at least analyst', () => {
    expect(isRoleAtLeast('analyst', 'analyst')).toBe(true)
  })

  it('analyst is not at least admin', () => {
    expect(isRoleAtLeast('analyst', 'admin')).toBe(false)
  })
})

describe('requirePermission', () => {
  it('does not throw when permission is held', () => {
    expect(() => requirePermission('owner', 'investigations:delete')).not.toThrow()
  })

  it('throws Error with 403-style message for insufficient role', () => {
    expect(() => requirePermission('viewer', 'investigations:create')).toThrow(
      /Forbidden.*viewer.*investigations:create/
    )
  })

  it('throws for analyst trying to delete', () => {
    expect(() => requirePermission('analyst', 'investigations:delete')).toThrow(
      /Forbidden/
    )
  })
})
