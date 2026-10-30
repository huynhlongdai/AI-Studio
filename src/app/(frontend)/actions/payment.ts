'use server'

import type { User } from '@/payload-types'
import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { hasStaffPermission } from '@/lib/staffPermissions'

type PaymentResult = { ok: true; paymentId?: string } | { ok: false; error: string }

const currentCustomer = async () => {
  const user = await appAuth.currentUser() as User | null
  return user?.collection === 'users' && user.role === 'customer' && user.active !== false ? user : null
}

const ownedOrder = async (code: string, user: User) => {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'orders',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return { payload, order: result.docs[0] }
}

const createIntent = async (
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  user: User,
  order: { id: string; code: string },
  kind: 'final' | 'revision',
  amount: number,
) => {
  const payment = await payload.create({
    collection: 'payments',
    data: {
      reference: 'pending',
      customer: user.id,
      order: order.id,
      kind,
      method: 'qr',
      amount,
      status: 'pending',
      expiresAt: new Date().toISOString(),
    },
    context: { trustedPaymentIntent: { kind, amount } },
    depth: 0,
    user,
    overrideAccess: false,
  })
  return String(payment.id)
}

export async function approveManagedDraft(code: string): Promise<PaymentResult> {
  const user = await currentCustomer()
  if (!user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  const { payload, order } = await ownedOrder(code, user)
  if (!order) return { ok: false, error: 'Không tìm thấy đơn hàng.' }
  if (order.jobState !== 'client_review') return { ok: false, error: 'Bản nháp này không ở trạng thái chờ duyệt.' }
  const remaining = Math.max(0, order.total - order.paid)
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { jobState: 'accepted', status: remaining > 0 ? 'awaiting_final' : 'active' },
    context: { trustedCustomerWorkflow: true },
    depth: 0,
    user,
    overrideAccess: false,
  })
  if (!remaining) return { ok: true }
  return { ok: true, paymentId: await createIntent(payload, user, order, 'final', remaining) }
}

export async function createManagedRevisionPayment(code: string): Promise<PaymentResult> {
  const user = await currentCustomer()
  if (!user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  const { payload, order } = await ownedOrder(code, user)
  if (!order) return { ok: false, error: 'Không tìm thấy đơn hàng.' }
  if (order.status === 'canceled' || order.status === 'completed') return { ok: false, error: 'Đơn hàng không thể mua thêm lượt sửa.' }
  return { ok: true, paymentId: await createIntent(payload, user, order, 'revision', 200_000) }
}

export async function renewManagedPayment(id: string): Promise<PaymentResult> {
  const user = await currentCustomer()
  if (!user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' }
  const payload = await getPayloadClient()
  const previous = await payload.findByID({ collection: 'payments', id, depth: 0, user, overrideAccess: false })
  const orderID = typeof previous.order === 'object' ? previous.order.id : previous.order
  const order = await payload.findByID({ collection: 'orders', id: orderID, depth: 0, user, overrideAccess: false })
  if (previous.kind === 'deposit') {
    const quoteID = typeof previous.quote === 'object' ? previous.quote?.id : previous.quote
    if (!quoteID) return { ok: false, error: 'Giao dịch không còn liên kết báo giá.' }
    const created = await payload.create({
      collection: 'payments',
      data: {
        reference: 'pending', customer: user.id, order: order.id, quote: quoteID, kind: 'deposit',
        method: 'qr', amount: previous.amount, status: 'pending', expiresAt: new Date().toISOString(),
      },
      depth: 0,
      user,
      overrideAccess: false,
    })
    return { ok: true, paymentId: String(created.id) }
  }
  if (previous.kind !== 'final' && previous.kind !== 'revision') return { ok: false, error: 'Loại giao dịch này chưa hỗ trợ tạo lại.' }
  const amount = previous.kind === 'final' ? Math.max(0, order.total - order.paid) : previous.amount
  if (!amount) return { ok: false, error: 'Giao dịch đã được thanh toán đủ.' }
  return { ok: true, paymentId: await createIntent(payload, user, order, previous.kind, amount) }
}

export async function settleManagedPayment(id: string, gatewayReference?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await appAuth.currentUser() as User | null
  if (!user || !hasStaffPermission(user, 'finance.manage')) return { ok: false, error: 'Bạn không có quyền đối soát thanh toán.' }
  const payload = await getPayloadClient()
  const payment = await payload.findByID({ collection: 'payments', id, depth: 0, user, overrideAccess: false })
  if (payment.status !== 'paid') {
    await payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: 'paid',
        paidAt: new Date().toISOString(),
        gatewayReference: gatewayReference?.trim().slice(0, 160) || `MANUAL-${Date.now()}`,
      },
      depth: 0,
      user,
      overrideAccess: false,
    })
  }
  const orderID = typeof payment.order === 'object' ? payment.order.id : payment.order
  const order = await payload.findByID({ collection: 'orders', id: orderID, depth: 0, user, overrideAccess: false })
  const paid = await payload.find({
    collection: 'payments',
    where: { and: [{ order: { equals: order.id } }, { status: { equals: 'paid' } }] },
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const paidTotal = Math.min(order.total, paid.docs.filter((item) => item.kind !== 'revision').reduce((sum, item) => sum + item.amount, 0))
  const revisionCount = paid.docs.filter((item) => item.kind === 'revision').length
  const status = payment.kind === 'final' || paidTotal >= order.total ? 'completed' : payment.kind === 'deposit' ? 'active' : order.status
  const jobState = status === 'completed' ? 'completed' : payment.kind === 'deposit' && order.jobState === 'queued' ? 'queued' : order.jobState
  await payload.update({
    collection: 'orders',
    id: order.id,
    data: { paid: paidTotal, status, jobState, extraRevisions: revisionCount },
    context: { trustedPaymentSettlement: true },
    depth: 0,
    user,
    overrideAccess: false,
  })
  return { ok: true }
}
