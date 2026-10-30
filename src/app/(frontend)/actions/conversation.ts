'use server'

import type { User } from '@/payload-types'
import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { hasStaffPermission } from '@/lib/staffPermissions'

type ConversationTurn = {
  clientText: string
  assistantText?: string
  quoteCode?: string
  handoff?: boolean
}

export async function persistConversationTurn(input: ConversationTurn): Promise<{ ok: boolean }> {
  const user = await appAuth.currentUser() as User | null
  if (!user || user.collection !== 'users' || user.role !== 'customer') return { ok: false }
  const clientText = input.clientText.trim().slice(0, 4000)
  const assistantText = input.assistantText?.trim().slice(0, 4000)
  if (!clientText) return { ok: false }
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'conversations',
    where: { customer: { equals: user.id } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const now = new Date().toISOString()
  const conversation = found.docs[0] ?? await payload.create({
    collection: 'conversations',
    data: { subject: 'Tư vấn dịch vụ', customer: user.id, handoff: Boolean(input.handoff), lastMessageAt: now },
    user,
    overrideAccess: false,
  })
  await payload.create({
    collection: 'messages',
    data: { conversation: conversation.id, customer: user.id, sender: 'client', text: clientText },
    user,
    overrideAccess: false,
  })
  if (assistantText) {
    let quote: string | undefined
    if (input.quoteCode) {
      const quotes = await payload.find({
        collection: 'quotes',
        where: { code: { equals: input.quoteCode } },
        limit: 1,
        depth: 0,
        user,
        overrideAccess: false,
      })
      quote = quotes.docs[0]?.id
    }
    await payload.create({
      collection: 'messages',
      data: { conversation: conversation.id, customer: user.id, sender: 'assistant', text: assistantText, quote },
      context: { trustedSender: 'assistant' },
      user,
      overrideAccess: false,
    })
  }
  await payload.update({
    collection: 'conversations',
    id: conversation.id,
    data: { handoff: Boolean(input.handoff), lastMessageAt: now },
    user,
    overrideAccess: false,
  })
  return { ok: true }
}

export type StaffInboxSnapshot = {
  customers: {
    id: string; name: string; contact: string; email: string; phone: string; industry: string; taxId: string
    channel: 'email'; createdAt: number; tags: string[]; note: string
  }[]
  threads: {
    id: string; customer: string
    messages: { id: string; from: 'ai' | 'me' | 'owner'; text: string; t: number; quoteCode?: string }[]
    handoff: boolean; takeover: boolean; unread: number; note: string
  }[]
}

const staffUser = async () => {
  const user = await appAuth.currentUser() as User | null
  return user?.collection === 'users' && hasStaffPermission(user, 'conversations.manage') ? user : null
}

const relationID = (value: unknown) => String(typeof value === 'object' && value && 'id' in value ? (value as { id: string }).id : value ?? '')

export async function getStaffInbox(): Promise<{ ok: true; snapshot: StaffInboxSnapshot } | { ok: false; error: string }> {
  const user = await staffUser()
  if (!user) return { ok: false, error: 'Bạn không có quyền truy cập hộp thư.' }
  const payload = await getPayloadClient()
  const [conversations, messages, quotes, customers] = await Promise.all([
    payload.find({ collection: 'conversations', limit: 100, sort: '-lastMessageAt', depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'messages', limit: 500, sort: 'createdAt', depth: 0, user, overrideAccess: false }),
    payload.find({ collection: 'quotes', limit: 200, depth: 0, user, overrideAccess: false }),
    hasStaffPermission(user, 'customers.read')
      ? payload.find({ collection: 'users', where: { role: { equals: 'customer' } }, limit: 200, depth: 0, user, overrideAccess: false })
      : Promise.resolve({ docs: [] }),
  ])
  const customerByID = new Map(customers.docs.map((customer) => [String(customer.id), customer]))
  const quoteCodeByID = new Map(quotes.docs.map((quote) => [String(quote.id), quote.code]))
  return {
    ok: true,
    snapshot: {
      customers: customers.docs.map((customer) => ({
        id: String(customer.id),
        name: customer.businessName || customer.name,
        contact: customer.name,
        email: customer.email,
        phone: customer.phone ?? '',
        industry: '',
        taxId: '',
        channel: 'email' as const,
        createdAt: new Date(customer.createdAt).getTime(),
        tags: [],
        note: '',
      })),
      threads: conversations.docs.map((conversation) => {
        const customerID = relationID(conversation.customer)
        const customer = customerByID.get(customerID)
        const rows = messages.docs.filter((message) => relationID(message.conversation) === String(conversation.id))
        return {
          id: customerID,
          customer: customerID,
          messages: rows.map((message) => ({
            id: String(message.id),
            from: message.sender === 'client' ? 'me' as const : message.sender === 'owner' ? 'owner' as const : 'ai' as const,
            text: message.text,
            t: new Date(message.createdAt).getTime(),
            quoteCode: quoteCodeByID.get(relationID(message.quote)),
          })),
          handoff: Boolean(conversation.handoff),
          takeover: Boolean(conversation.takeover),
          unread: rows.filter((message) => message.sender === 'client' && !message.readAt).length,
          note: conversation.internalNote ?? customer?.businessName ?? '',
        }
      }),
    },
  }
}

const conversationForCustomer = async (payload: Awaited<ReturnType<typeof getPayloadClient>>, user: User, customerID: string) => {
  const result = await payload.find({
    collection: 'conversations',
    where: { customer: { equals: customerID } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return result.docs[0]
}

export async function persistStaffMessage(customerID: string, text: string, quoteCode?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await staffUser()
  const body = text.trim()
  if (!user) return { ok: false, error: 'Bạn không có quyền gửi tin nhắn.' }
  if (!body || body.length > 4000) return { ok: false, error: 'Nội dung tin nhắn không hợp lệ.' }
  const payload = await getPayloadClient()
  const conversation = await conversationForCustomer(payload, user, customerID)
  if (!conversation) return { ok: false, error: 'Không tìm thấy cuộc trò chuyện.' }
  let quote: string | undefined
  if (quoteCode) {
    const quotes = await payload.find({ collection: 'quotes', where: { code: { equals: quoteCode } }, limit: 1, depth: 0, user, overrideAccess: false })
    quote = quotes.docs[0]?.id
  }
  await payload.create({
    collection: 'messages',
    data: { conversation: conversation.id, customer: customerID, sender: 'owner', text: body, quote },
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
  return { ok: true }
}

export async function updateStaffConversation(customerID: string, patch: { takeover?: boolean; note?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await staffUser()
  if (!user) return { ok: false, error: 'Bạn không có quyền cập nhật hội thoại.' }
  const payload = await getPayloadClient()
  const conversation = await conversationForCustomer(payload, user, customerID)
  if (!conversation) return { ok: false, error: 'Không tìm thấy cuộc trò chuyện.' }
  await payload.update({
    collection: 'conversations',
    id: conversation.id,
    data: {
      ...(typeof patch.takeover === 'boolean' ? { takeover: patch.takeover, handoff: patch.takeover ? conversation.handoff : false } : {}),
      ...(patch.note !== undefined ? { internalNote: patch.note.trim().slice(0, 2000) } : {}),
    },
    depth: 0,
    user,
    overrideAccess: false,
  })
  if (patch.takeover === false) {
    await payload.create({
      collection: 'messages',
      data: {
        conversation: conversation.id,
        customer: customerID,
        sender: 'assistant',
        text: 'Em là trợ lý AI, em tiếp tục hỗ trợ chị ạ. Chị cần gì thêm cứ nhắn em nhé.',
      },
      context: { trustedSender: 'assistant' },
      depth: 0,
      user,
      overrideAccess: false,
    })
  }
  return { ok: true }
}

export async function markStaffConversationRead(customerID: string): Promise<{ ok: true } | { ok: false }> {
  const user = await staffUser()
  if (!user) return { ok: false }
  const payload = await getPayloadClient()
  const conversation = await conversationForCustomer(payload, user, customerID)
  if (!conversation) return { ok: false }
  const unread = await payload.find({
    collection: 'messages',
    where: { and: [{ conversation: { equals: conversation.id } }, { sender: { equals: 'client' } }, { or: [{ readAt: { exists: false } }, { readAt: { equals: null } }] }] },
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  })
  for (const message of unread.docs) {
    await payload.update({
      collection: 'messages',
      id: message.id,
      data: { readAt: new Date().toISOString() },
      depth: 0,
      user,
      overrideAccess: false,
    })
  }
  return { ok: true }
}
