'use server'

import type { User } from '@/payload-types'
import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { hasStaffPermission } from '@/lib/staffPermissions'

type QuoteInput = {
  code: string
  serviceCode: string
  brand: string
  brief: string
  options: string[]
  rush: boolean
}

const currentCustomer = async () => {
  const user = await appAuth.currentUser() as User | null
  return user?.collection === 'users' && user.role === 'customer' ? user : null
}

export async function persistQuote(input: QuoteInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await currentCustomer()
  if (!user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  if (!input.code || !input.brand.trim() || input.brand.length > 160 || !input.brief.trim() || input.brief.length > 4000) {
    return { ok: false, error: 'Thông tin báo giá không hợp lệ.' }
  }
  const payload = await getPayloadClient()
  const existing = await payload.find({
    collection: 'quotes',
    where: { code: { equals: input.code } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  if (existing.docs[0]) return { ok: true }
  const services = await payload.find({
    collection: 'services',
    where: { code: { equals: input.serviceCode }, active: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
  })
  const service = services.docs[0]
  if (!service) return { ok: false, error: 'Dịch vụ không còn hoạt động.' }
  await payload.create({
    collection: 'quotes',
    data: {
      code: input.code,
      customer: user.id,
      service: service.id,
      brand: input.brand.trim(),
      brief: input.brief.trim(),
      options: input.options.map((code) => ({ code, label: '', price: 0 })),
      rush: input.rush,
      subtotal: 0,
      total: 0,
      depositAmount: 0,
      includedRevisions: 0,
      status: 'sent',
      expiresAt: new Date().toISOString(),
    },
    context: { trustedQuoteCode: input.code },
    user,
    overrideAccess: false,
  })
  return { ok: true }
}

export async function rejectManagedQuote(code: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const user = await currentCustomer()
  if (!user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'quotes',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const quote = result.docs[0]
  if (!quote) return { ok: false, error: 'Không tìm thấy báo giá.' }
  await payload.update({
    collection: 'quotes',
    id: quote.id,
    data: { status: 'rejected', rejectionReason: reason.trim().slice(0, 1000) },
    user,
    overrideAccess: false,
  })
  return { ok: true }
}

export async function acceptManagedQuote(code: string): Promise<{ ok: true; orderCode: string; paymentId?: string } | { ok: false; error: string }> {
  const user = await currentCustomer()
  if (!user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'quotes',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const quote = result.docs[0]
  if (!quote || quote.status === 'rejected' || quote.status === 'expired') return { ok: false, error: 'Báo giá không còn hiệu lực.' }
  const linked = await payload.find({
    collection: 'orders',
    where: { quote: { equals: quote.id } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  let order = linked.docs[0]
  if (!order) {
    const serviceID = typeof quote.service === 'object' ? quote.service.id : quote.service
    const service = await payload.findByID({ collection: 'services', id: serviceID, depth: 0, overrideAccess: false })
    const orderCode = `AIS-${Date.now().toString(36).toUpperCase()}`
    order = await payload.create({
      collection: 'orders',
      data: {
        code: orderCode,
        customer: user.id,
        quote: quote.id,
        service: service.id,
        brand: quote.brand,
        brief: quote.brief,
        status: 'awaiting_deposit',
        jobState: 'queued',
        total: quote.total,
        paid: 0,
        version: 0,
        includedRevisions: quote.includedRevisions,
        usedRevisions: 0,
        extraRevisions: 0,
        dueAt: new Date(Date.now() + (quote.rush ? 1 : service.slaDays) * 24 * 3600_000).toISOString(),
      },
      context: { trustedOrderCode: orderCode },
      user,
      overrideAccess: false,
    })
  }
  if (quote.status === 'sent') {
    await payload.update({
      collection: 'quotes',
      id: quote.id,
      data: { status: 'accepted', order: order.id },
      user,
      overrideAccess: false,
    })
  }
  const pending = await payload.find({
    collection: 'payments',
    where: { and: [{ order: { equals: order.id } }, { kind: { equals: 'deposit' } }, { status: { equals: 'pending' } }] },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  let payment = pending.docs[0]
  if (!payment) {
    payment = await payload.create({
      collection: 'payments',
      data: {
        reference: 'pending',
        customer: user.id,
        order: order.id,
        quote: quote.id,
        kind: 'deposit',
        method: 'qr',
        amount: quote.depositAmount,
        status: 'pending',
        expiresAt: new Date().toISOString(),
      },
      user,
      overrideAccess: false,
    })
  }
  return { ok: true, orderCode: order.code, paymentId: payment ? String(payment.id) : undefined }
}

export async function persistStaffQuote(input: QuoteInput & { customerID: string }): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const user = await appAuth.currentUser() as User | null
  if (!user || !hasStaffPermission(user, 'work.manage') || !hasStaffPermission(user, 'conversations.manage')) {
    return { ok: false, error: 'Bạn không có quyền gửi báo giá.' }
  }
  if (!input.code || !input.customerID || !input.brand.trim() || !input.brief.trim() || input.brief.length > 4000) {
    return { ok: false, error: 'Thông tin báo giá không hợp lệ.' }
  }
  const payload = await getPayloadClient()
  const [customer, services, conversations] = await Promise.all([
    payload.findByID({ collection: 'users', id: input.customerID, depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'services', where: { code: { equals: input.serviceCode }, active: { equals: true } }, limit: 1, depth: 0, overrideAccess: false }),
    payload.find({ collection: 'conversations', where: { customer: { equals: input.customerID } }, limit: 1, depth: 0, user, overrideAccess: false }),
  ])
  if (customer.role !== 'customer') return { ok: false, error: 'Tài khoản nhận báo giá không hợp lệ.' }
  const service = services.docs[0]
  const conversation = conversations.docs[0]
  if (!service || !conversation) return { ok: false, error: 'Không tìm thấy dịch vụ hoặc cuộc trò chuyện.' }
  const requested = new Set(input.options)
  const options = (service.options ?? []).filter((option) => requested.has(option.code))
  const subtotal = service.basePrice + options.reduce((sum, option) => sum + option.price, 0)
  const total = subtotal + (input.rush ? service.rushSurcharge : 0)
  const quote = await payload.create({
    collection: 'quotes',
    data: {
      code: input.code,
      customer: customer.id,
      service: service.id,
      brand: input.brand.trim(),
      brief: input.brief.trim(),
      options,
      rush: input.rush,
      subtotal,
      total,
      depositAmount: total < 500_000 ? total : Math.round(total * 0.5),
      includedRevisions: service.includedRevisions,
      status: 'sent',
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    },
    depth: 0,
    user,
    overrideAccess: false,
  })
  await payload.create({
    collection: 'messages',
    data: {
      conversation: conversation.id,
      customer: customer.id,
      sender: 'owner',
      text: 'Em gửi chị báo giá theo trao đổi nhé:',
      quote: quote.id,
    },
    context: { trustedSender: 'owner' },
    depth: 0,
    user,
    overrideAccess: false,
  })
  await payload.update({
    collection: 'conversations',
    id: conversation.id,
    data: { takeover: true, lastMessageAt: new Date().toISOString() },
    depth: 0,
    user,
    overrideAccess: false,
  })
  return { ok: true, code: quote.code }
}
