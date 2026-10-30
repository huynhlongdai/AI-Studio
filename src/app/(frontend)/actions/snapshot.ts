'use server'

import type { User } from '@/payload-types'
import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import type { StaffRole } from '@/lib/staffPermissions'

type SnapshotPrice = {
  items: { label: string; quantity: number; unitPrice: number; amount: number }[]
  subtotal: number
  discount: number
  total: number
  depositPct: number
  depositAmount: number
}

export type CustomerSnapshot = {
  authenticated: true
  kind: 'customer'
  user: { id: string; email: string; name: string; businessName: string; phone: string }
  customer: {
    id: string; name: string; contact: string; email: string; phone: string; industry: string; taxId: string
    channel: 'email' | 'zalo' | 'phone'; createdAt: number; tags: string[]; note: string
  }
  quotes: {
    code: string; customer: string; service: 'logo' | 'post' | 'video' | 'landing'; brand: string; style: string
    options: string[]; rush: boolean; price: SnapshotPrice; includedRevisions: number
    status: 'sent' | 'accepted' | 'expired' | 'rejected'; createdAt: number; expiresAt: number
    orderCode?: string; rejectReason?: string
  }[]
  orders: {
    code: string; customer: string; quoteCode: string; service: 'logo' | 'post' | 'video' | 'landing'; brand: string; style: string
    price: SnapshotPrice; paid: number; status: 'awaiting_deposit' | 'active' | 'awaiting_final' | 'completed' | 'canceled'
    job: 'queued' | 'offered' | 'assigned' | 'running' | 'input_required' | 'submitted' | 'qc_review' | 'pending_approval' | 'client_review' | 'revision_requested' | 'accepted' | 'completed' | 'on_hold' | 'stalled' | 'escalated' | 'canceled' | 'failed'
    progress: number; version: number; includedRevisions: number; revisionsUsed: number; extraRevisions: number
    revisions: []; createdAt: number; dueAt: number; lastStep: number; events: []
  }[]
  payments: {
    id: string; customer: string; orderCode?: string; kind: 'deposit' | 'final' | 'revision' | 'plan'
    method: 'qr' | 'credit'; amount: number; ref: string; status: 'pending' | 'paid' | 'expired'
    createdAt: number; expiresAt: number; paidAt?: number
  }[]
  thread: {
    id: string; customer: string
    messages: { id: string; from: 'ai' | 'me' | 'owner'; text: string; t: number; quoteCode?: string }[]
    handoff: boolean; takeover: boolean; unread: number; note: string
  }
}

export type AppSnapshot =
  | { authenticated: false }
  | { authenticated: true; kind: 'staff'; user: { id: string; email: string; name: string; role: StaffRole } }
  | CustomerSnapshot

const relationID = (value: unknown) => String(typeof value === 'object' && value && 'id' in value ? (value as { id: string }).id : value ?? '')
const time = (value: string | null | undefined) => value ? new Date(value).getTime() : Date.now()
const serviceCode = (code?: string): CustomerSnapshot['quotes'][number]['service'] => ['logo', 'post', 'video', 'landing'].includes(code ?? '') ? code as CustomerSnapshot['quotes'][number]['service'] : 'post'

export async function getAppSnapshot(): Promise<AppSnapshot> {
  const user = await appAuth.currentUser() as User | null
  if (!user || user.collection !== 'users' || user.active === false) return { authenticated: false }
  if (user.role !== 'customer') {
    return {
      authenticated: true,
      kind: 'staff',
      user: { id: user.id, email: user.email, name: user.name, role: user.role as StaffRole },
    }
  }

  const payload = await getPayloadClient()
  const [servicesResult, quotesResult, ordersResult, paymentsResult, conversationsResult, messagesResult] = await Promise.all([
    payload.find({ collection: 'services', limit: 100, depth: 0, overrideAccess: false }),
    payload.find({ collection: 'quotes', limit: 100, sort: '-createdAt', depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'orders', limit: 100, sort: '-createdAt', depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'payments', limit: 100, sort: '-createdAt', depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'conversations', limit: 1, depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'messages', limit: 200, sort: 'createdAt', depth: 0, user, overrideAccess: false }),
  ])

  const serviceByID = new Map(servicesResult.docs.map((service) => [String(service.id), service]))
  const quoteByID = new Map(quotesResult.docs.map((quote) => [String(quote.id), quote]))
  const orderByID = new Map(ordersResult.docs.map((order) => [String(order.id), order]))
  const priceOf = (quote: (typeof quotesResult.docs)[number]): SnapshotPrice => {
    const service = serviceByID.get(relationID(quote.service))
    const base = service?.basePrice ?? Math.max(0, quote.subtotal - (quote.options ?? []).reduce((sum, option) => sum + option.price, 0))
    const items = [
      { label: service?.name ?? 'Dịch vụ', quantity: 1, unitPrice: base, amount: base },
      ...(quote.options ?? []).map((option) => ({ label: option.label, quantity: 1, unitPrice: option.price, amount: option.price })),
    ]
    const rushAmount = Math.max(0, quote.total - quote.subtotal)
    if (rushAmount) items.push({ label: 'Giao gấp', quantity: 1, unitPrice: rushAmount, amount: rushAmount })
    return {
      items,
      subtotal: quote.total,
      discount: 0,
      total: quote.total,
      depositPct: quote.total ? Math.round((quote.depositAmount / quote.total) * 100) : 0,
      depositAmount: quote.depositAmount,
    }
  }
  const fallbackPrice = (total: number, label: string): SnapshotPrice => ({
    items: [{ label, quantity: 1, unitPrice: total, amount: total }],
    subtotal: total, discount: 0, total, depositPct: total < 500_000 ? 100 : 50,
    depositAmount: total < 500_000 ? total : Math.round(total * 0.5),
  })

  const orders = ordersResult.docs.map((order) => {
    const quote = quoteByID.get(relationID(order.quote))
    const service = serviceByID.get(relationID(order.service))
    return {
      code: order.code,
      customer: user.id,
      quoteCode: quote?.code ?? '',
      service: serviceCode(service?.code),
      brand: order.brand,
      style: order.brief,
      price: quote ? priceOf(quote) : fallbackPrice(order.total, service?.name ?? 'Dịch vụ'),
      paid: order.paid,
      status: order.status,
      job: order.jobState,
      progress: ['submitted', 'qc_review', 'pending_approval', 'client_review', 'accepted', 'completed'].includes(order.jobState) ? 100 : order.jobState === 'running' ? 50 : 0,
      version: order.version,
      includedRevisions: order.includedRevisions,
      revisionsUsed: order.usedRevisions,
      extraRevisions: order.extraRevisions,
      revisions: [] as [],
      createdAt: time(order.createdAt),
      dueAt: time(order.dueAt),
      lastStep: time(order.updatedAt),
      events: [] as [],
    }
  })
  const orderCodeByID = new Map(ordersResult.docs.map((order) => [String(order.id), order.code]))
  const quotes = quotesResult.docs.map((quote) => {
    const service = serviceByID.get(relationID(quote.service))
    const orderCode = orderCodeByID.get(relationID(quote.order))
    return {
      code: quote.code,
      customer: user.id,
      service: serviceCode(service?.code),
      brand: quote.brand,
      style: quote.brief,
      options: (quote.options ?? []).map((option) => option.code),
      rush: Boolean(quote.rush),
      price: priceOf(quote),
      includedRevisions: quote.includedRevisions,
      status: quote.status,
      createdAt: time(quote.createdAt),
      expiresAt: time(quote.expiresAt),
      orderCode,
      rejectReason: quote.rejectionReason ?? undefined,
    }
  })
  const quoteCodeByID = new Map(quotesResult.docs.map((quote) => [String(quote.id), quote.code]))
  const payments = paymentsResult.docs.map((payment) => ({
    id: String(payment.id),
    customer: user.id,
    orderCode: orderCodeByID.get(relationID(payment.order)),
    kind: payment.kind,
    method: payment.method === 'credit' ? 'credit' as const : 'qr' as const,
    amount: payment.amount,
    ref: payment.reference,
    status: payment.status === 'failed' ? 'expired' as const : payment.status,
    createdAt: time(payment.createdAt),
    expiresAt: time(payment.expiresAt),
    paidAt: payment.paidAt ? time(payment.paidAt) : undefined,
  }))
  const conversation = conversationsResult.docs[0]
  const messages = messagesResult.docs
    .filter((message) => !conversation || relationID(message.conversation) === String(conversation.id))
    .map((message) => ({
      id: String(message.id),
      from: message.sender === 'client' ? 'me' as const : message.sender === 'owner' ? 'owner' as const : 'ai' as const,
      text: message.text,
      t: time(message.createdAt),
      quoteCode: quoteCodeByID.get(relationID(message.quote)),
    }))

  return {
    authenticated: true,
    kind: 'customer',
    user: { id: user.id, email: user.email, name: user.name, businessName: user.businessName ?? '', phone: user.phone ?? '' },
    customer: {
      id: user.id, name: user.businessName || user.name, contact: user.name, email: user.email, phone: user.phone ?? '',
      industry: user.industry ?? '', taxId: user.taxId ?? '', channel: user.preferredChannel ?? 'email', createdAt: time(user.createdAt), tags: [], note: '',
    },
    quotes,
    orders,
    payments,
    thread: {
      id: user.id,
      customer: user.id,
      messages,
      handoff: Boolean(conversation?.handoff),
      takeover: Boolean(conversation?.takeover),
      unread: messagesResult.docs.filter((message) => message.sender !== 'client' && !message.readAt).length,
      note: '',
    },
  }
}
