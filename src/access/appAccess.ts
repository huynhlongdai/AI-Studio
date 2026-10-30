import type { Access, FieldAccess } from 'payload'
import { hasStaffPermission, type StaffPermission } from '@/lib/staffPermissions'

type AppIdentity = {
  collection?: string
  id: number | string
  role?: 'customer' | 'specialist' | 'manager' | 'finance' | 'admin'
  permissions?: StaffPermission[] | null
  active?: boolean | null
}

const identity = (user: unknown) => user as AppIdentity | null | undefined

export const isStudioUser = (user: unknown) => {
  const current = identity(user)
  return current?.collection === 'admins' || (current?.collection === 'users' && current.role !== 'customer' && Boolean(current.role))
}

export const studioOnly: Access = ({ req }) => isStudioUser(req.user)
export const studioFieldOnly: FieldAccess = ({ req }) => isStudioUser(req.user)
export const permitted = (permission: StaffPermission): Access => ({ req }) => hasStaffPermission(identity(req.user), permission)
export const permittedField = (permission: StaffPermission): FieldAccess => ({ req }) => hasStaffPermission(identity(req.user), permission)
export const customerOrPermitted = (permission: StaffPermission): Access => ({ req }) => {
  const current = identity(req.user)
  return current?.collection === 'users' && current.role === 'customer' || hasStaffPermission(current, permission)
}
export const authenticated: Access = ({ req }) => {
  const current = identity(req.user)
  return current?.collection === 'users' || current?.collection === 'admins'
}

export const ownerOrStudio = (field = 'customer'): Access => ({ req }) => {
  if (isStudioUser(req.user)) return true
  const current = identity(req.user)
  if (current?.collection !== 'users') return false
  return { [field]: { equals: current.id } }
}

export const ownerOrPermitted = (permission: StaffPermission, field = 'customer'): Access => ({ req }) => {
  if (hasStaffPermission(identity(req.user), permission)) return true
  const current = identity(req.user)
  if (current?.collection !== 'users' || current.role !== 'customer') return false
  return { [field]: { equals: current.id } }
}

export const ownerOrAnyPermitted = (permissions: StaffPermission[], field = 'customer'): Access => ({ req }) => {
  if (permissions.some((permission) => hasStaffPermission(identity(req.user), permission))) return true
  const current = identity(req.user)
  if (current?.collection !== 'users' || current.role !== 'customer') return false
  return { [field]: { equals: current.id } }
}
