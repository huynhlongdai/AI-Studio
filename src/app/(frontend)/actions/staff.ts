'use server'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { hasStaffPermission, permissionsFor, STAFF_ROLES, type StaffPermission, type StaffRole } from '@/lib/staffPermissions'

type StaffIdentity = {
  id: string
  collection?: string
  role?: string
  permissions?: StaffPermission[] | null
  active?: boolean | null
}

export type ManagedStaff = {
  id: string
  name: string
  email: string
  role: StaffRole
  permissions?: StaffPermission[]
  active: boolean
  skills: ('logo' | 'post' | 'video' | 'landing')[]
  maxQueue: number
  createdAt: string
}

type StaffInput = Omit<ManagedStaff, 'id' | 'createdAt'> & {
  id?: string
  temporaryPassword?: string
}

const manager = async () => {
  const user = await appAuth.currentUser() as unknown as StaffIdentity | null
  return user && hasStaffPermission(user, 'team.manage') ? user : null
}

const normalize = (user: {
  id: string
  name: string
  email: string
  role?: string | null
  permissions?: string[] | null
  active?: boolean | null
  skills?: string[] | null
  maxQueue?: number | null
  createdAt: string
}): ManagedStaff => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: STAFF_ROLES.includes(user.role as StaffRole) ? user.role as StaffRole : 'specialist',
  permissions: user.permissions ? permissionsFor(user.role ?? 'specialist', user.permissions) : undefined,
  active: user.active !== false,
  skills: (user.skills ?? []).filter((skill): skill is ManagedStaff['skills'][number] => ['logo', 'post', 'video', 'landing'].includes(skill)),
  maxQueue: user.maxQueue ?? 8,
  createdAt: user.createdAt,
})

export async function listManagedStaff(): Promise<{ ok: true; staff: ManagedStaff[] } | { ok: false; error: string }> {
  const user = await manager()
  if (!user) return { ok: false, error: 'Bạn không có quyền quản lý nhân sự.' }
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'users',
    where: { role: { in: [...STAFF_ROLES] } },
    sort: 'name',
    limit: 100,
    depth: 0,
    user: user as never,
    overrideAccess: false,
  })
  return { ok: true, staff: result.docs.map((record) => normalize(record as never)) }
}

export async function saveManagedStaff(input: StaffInput): Promise<{ ok: true; staff: ManagedStaff } | { ok: false; error: string }> {
  const actor = await manager()
  if (!actor) return { ok: false, error: 'Bạn không có quyền quản lý nhân sự.' }
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !STAFF_ROLES.includes(input.role)) return { ok: false, error: 'Thông tin nhân sự chưa hợp lệ.' }
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'users',
    where: input.id ? { or: [{ id: { equals: input.id } }, { email: { equals: email } }] } : { email: { equals: email } },
    limit: 1,
    depth: 0,
    user: actor as never,
    overrideAccess: false,
  })
  const existing = found.docs[0]
  if (existing?.role === 'admin' && (input.role !== 'admin' || !input.active)) {
    const admins = await payload.count({
      collection: 'users',
      where: { and: [{ role: { equals: 'admin' } }, { active: { equals: true } }] },
      user: actor as never,
      overrideAccess: false,
    })
    if (admins.totalDocs <= 1) return { ok: false, error: 'Không thể khóa hoặc hạ quyền admin cuối cùng.' }
  }
  const data = {
    name,
    email,
    role: input.role,
    permissions: input.role === 'admin' ? null : input.permissions,
    active: input.active,
    skills: input.skills,
    maxQueue: Math.max(1, Math.min(100, input.maxQueue)),
  }
  if (existing) {
    const updated = await payload.update({ collection: 'users', id: existing.id, data, depth: 0, user: actor as never, overrideAccess: false })
    return { ok: true, staff: normalize(updated as never) }
  }
  if (!input.temporaryPassword || input.temporaryPassword.length < 12) return { ok: false, error: 'Tài khoản mới cần mật khẩu tạm ít nhất 12 ký tự.' }
  const created = await payload.create({
    collection: 'users',
    data: { ...data, password: input.temporaryPassword },
    depth: 0,
    user: actor as never,
    overrideAccess: false,
  })
  return { ok: true, staff: normalize(created as never) }
}
