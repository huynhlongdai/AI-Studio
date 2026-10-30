import { APIError, type CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrPermitted, permitted, permittedField } from '@/access/appAccess'

export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'kind', 'amount', 'status', 'updatedAt'],
  },
  access: {
    create: customerOrPermitted('finance.manage'),
    delete: permitted('finance.manage'),
    read: ownerOrPermitted('finance.read'),
    update: permitted('finance.manage'),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        const user = req.user as { collection?: string; id?: string | number; role?: string } | null
        if (user?.collection === 'users' && user.role === 'customer') {
          const orderID = typeof data.order === 'object' ? data.order?.id : data.order
          if (!orderID) throw new APIError('Thiếu đơn hàng.', 400)
          const order = await req.payload.findByID({ collection: 'orders', id: orderID, user: req.user, overrideAccess: false, depth: 0 })
          const trusted = req.context?.trustedPaymentIntent as { kind?: 'deposit' | 'final' | 'revision'; amount?: number } | undefined
          data.customer = user.id
          data.reference = `AIS${order.code.replace(/\D/g, '')}${Date.now().toString().slice(-6)}`
          data.method = 'qr'
          data.status = 'pending'
          data.expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()
          if (trusted?.kind === 'final' || trusted?.kind === 'revision') {
            if (!trusted.amount || trusted.amount <= 0) throw new APIError('Số tiền thanh toán không hợp lệ.', 400)
            data.kind = trusted.kind
            data.amount = Math.round(trusted.amount)
          } else {
            const quoteID = typeof data.quote === 'object' ? data.quote?.id : data.quote
            if (!quoteID) throw new APIError('Thiếu báo giá.', 400)
            const quote = await req.payload.findByID({ collection: 'quotes', id: quoteID, user: req.user, overrideAccess: false, depth: 0 })
            data.kind = 'deposit'
            data.amount = quote.depositAmount
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, index: true, access: { update: permittedField('finance.manage') } },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: permittedField('finance.manage') } },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true, access: { update: permittedField('finance.manage') } },
    { name: 'quote', type: 'relationship', relationTo: 'quotes', access: { update: permittedField('finance.manage') } },
    { name: 'kind', type: 'select', required: true, options: ['deposit', 'final', 'revision', 'plan'], access: { update: permittedField('finance.manage') } },
    { name: 'method', type: 'select', required: true, options: ['qr', 'credit', 'mixed'], access: { update: permittedField('finance.manage') } },
    { name: 'amount', type: 'number', required: true, min: 0, access: { update: permittedField('finance.manage') } },
    { name: 'status', type: 'select', required: true, defaultValue: 'pending', options: ['pending', 'paid', 'expired', 'failed'], access: { create: permittedField('finance.manage'), update: permittedField('finance.manage') } },
    { name: 'expiresAt', type: 'date', required: true, access: { update: permittedField('finance.manage') } },
    { name: 'paidAt', type: 'date', access: { create: permittedField('finance.manage'), update: permittedField('finance.manage') } },
    { name: 'gatewayReference', type: 'text', access: { create: permittedField('finance.manage'), update: permittedField('finance.manage') } },
  ],
  versions: false,
}
