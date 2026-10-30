'use server'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import type { StaffRole } from '@/lib/staffPermissions'

export type AppAuthResult =
  | { ok: true; email: string; name: string; role: 'customer' | StaffRole }
  | { ok: false; error: string }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function loginAppUser(input: { email: string; password: string; staff?: boolean }): Promise<AppAuthResult> {
  const email = input.email.trim().toLowerCase()
  if (!emailPattern.test(email) || input.password.length < 8) return { ok: false, error: 'Email hoặc mật khẩu chưa hợp lệ.' }
  try {
    const user = await appAuth.login(email, input.password) as unknown as { email?: string; name?: string; role?: 'customer' | StaffRole; active?: boolean } | null
    if (!user) return { ok: false, error: 'Email hoặc mật khẩu không đúng.' }
    if (user.active === false) {
      await appAuth.logout()
      return { ok: false, error: 'Tài khoản đã bị khóa. Vui lòng liên hệ admin.' }
    }
    const role = user.role ?? 'customer'
    if (input.staff && role === 'customer') {
      await appAuth.logout()
      return { ok: false, error: 'Tài khoản này không có quyền vào cổng studio.' }
    }
    return { ok: true, email: user.email ?? email, name: user.name ?? '', role }
  } catch {
    return { ok: false, error: 'Email hoặc mật khẩu không đúng.' }
  }
}

export async function registerAppUser(input: { email: string; password: string; name: string; businessName: string }): Promise<AppAuthResult> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  const businessName = input.businessName.trim()
  if (!emailPattern.test(email)) return { ok: false, error: 'Email chưa đúng định dạng.' }
  if (input.password.length < 8) return { ok: false, error: 'Mật khẩu cần ít nhất 8 ký tự.' }
  if (name.length < 2 || businessName.length < 2) return { ok: false, error: 'Vui lòng nhập tên và doanh nghiệp.' }
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'users' as never,
      data: { email, password: input.password, name, businessName } as never,
      overrideAccess: false,
    })
    const user = await appAuth.login(email, input.password) as unknown as { email?: string; name?: string; role?: 'customer' } | null
    if (!user) return { ok: false, error: 'Đã tạo tài khoản nhưng chưa thể đăng nhập.' }
    return { ok: true, email: user.email ?? email, name: user.name ?? name, role: 'customer' }
  } catch (error) {
    const message = error instanceof Error && /unique|email/i.test(error.message) ? 'Email này đã có tài khoản.' : 'Chưa thể tạo tài khoản. Vui lòng thử lại.'
    return { ok: false, error: message }
  }
}

export async function logoutAppUser() {
  await appAuth.logout()
  return { ok: true }
}

export async function updateAppProfile(input: {
  businessName: string
  contact: string
  phone?: string
  industry?: string
  taxId?: string
  channel?: 'email' | 'zalo' | 'phone'
  notifications?: { draft: boolean; payment: boolean; marketing: boolean }
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await appAuth.currentUser()
  if (!user || user.collection !== 'users' || user.role !== 'customer') return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  const businessName = input.businessName.trim().slice(0, 160)
  const contact = input.contact.trim().slice(0, 160)
  const phone = input.phone?.trim().slice(0, 30) ?? ''
  const industry = input.industry?.trim().slice(0, 160) ?? ''
  const taxId = input.taxId?.trim().slice(0, 20) ?? ''
  const channel = input.channel ?? 'email'
  if (businessName.length < 2 || contact.length < 2) return { ok: false, error: 'Vui lòng nhập tên doanh nghiệp và người liên hệ.' }
  if (taxId && !/^\d{10}(-\d{3})?$/.test(taxId)) return { ok: false, error: 'Mã số thuế chưa đúng định dạng.' }
  if (channel !== 'email' && !/^0\d{9}$/.test(phone)) return { ok: false, error: 'Số điện thoại gồm 10 số, bắt đầu bằng 0.' }
  const payload = await getPayloadClient()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      name: contact,
      businessName,
      phone,
      industry,
      taxId,
      preferredChannel: channel,
      ...(input.notifications ? {
        notificationPreferences: {
          draft: Boolean(input.notifications.draft),
          payment: Boolean(input.notifications.payment),
          marketing: Boolean(input.notifications.marketing),
        },
      } : {}),
    },
    depth: 0,
    user,
    overrideAccess: false,
  })
  return { ok: true }
}
