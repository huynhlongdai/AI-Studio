import { APIError, type CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrPermitted, permitted, permittedField } from '@/access/appAccess'

export const Quotes: CollectionConfig = {
  slug: 'quotes',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'code',
    defaultColumns: ['code', 'brand', 'status', 'total', 'expiresAt'],
  },
  access: {
    create: customerOrPermitted('work.manage'),
    delete: permitted('work.cancel'),
    read: ownerOrPermitted('work.read'),
    update: ownerOrPermitted('work.manage'),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const user = req.user as { collection?: string; id?: string | number; role?: string } | null
        if (operation === 'create' && user?.collection === 'users' && user.role === 'customer') {
          const serviceID = typeof data.service === 'object' ? data.service?.id : data.service
          if (!serviceID) throw new APIError('Dịch vụ không hợp lệ.', 400)
          const service = await req.payload.findByID({ collection: 'services', id: serviceID, depth: 0, overrideAccess: false })
          const requested = new Set((data.options ?? []).map((option: { code?: string }) => option.code))
          const options = (service.options ?? []).filter((option) => requested.has(option.code))
          const subtotal = service.basePrice + options.reduce((sum, option) => sum + option.price, 0)
          const total = subtotal + (data.rush ? service.rushSurcharge : 0)
          data.customer = user.id
          data.code = req.context?.trustedQuoteCode || `BG-${Date.now().toString(36).toUpperCase()}`
          data.options = options
          data.subtotal = subtotal
          data.total = total
          data.depositAmount = total < 500_000 ? total : Math.round(total * 0.5)
          data.includedRevisions = service.includedRevisions
          data.status = 'sent'
          data.expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString()
        }
        if (operation === 'update' && user?.collection === 'users' && user.role === 'customer') {
          const allowed = originalDoc?.status === 'sent' && (data.status === 'accepted' || data.status === 'rejected')
          if (!allowed) data.status = originalDoc?.status
          if (data.order) {
            const orderID = typeof data.order === 'object' ? data.order.id : data.order
            await req.payload.findByID({ collection: 'orders', id: orderID, user: req.user, overrideAccess: false, depth: 0 })
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true, access: { update: permittedField('work.manage') } },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: permittedField('work.manage') } },
    { name: 'service', type: 'relationship', relationTo: 'services', required: true, access: { update: permittedField('work.manage') } },
    { name: 'brand', type: 'text', required: true, access: { update: permittedField('work.manage') } },
    { name: 'brief', type: 'textarea', required: true, access: { update: permittedField('work.manage') } },
    {
      name: 'options',
      type: 'array',
      access: { update: permittedField('work.manage') },
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'price', type: 'number', required: true, min: 0 },
      ],
    },
    { name: 'rush', type: 'checkbox', defaultValue: false, access: { update: permittedField('work.manage') } },
    { name: 'subtotal', type: 'number', required: true, min: 0, access: { update: permittedField('work.manage') } },
    { name: 'total', type: 'number', required: true, min: 0, access: { update: permittedField('work.manage') } },
    { name: 'depositAmount', type: 'number', required: true, min: 0, access: { update: permittedField('work.manage') } },
    { name: 'includedRevisions', type: 'number', required: true, min: 0, access: { update: permittedField('work.manage') } },
    { name: 'status', type: 'select', required: true, defaultValue: 'sent', options: ['sent', 'accepted', 'expired', 'rejected'] },
    { name: 'expiresAt', type: 'date', required: true, access: { update: permittedField('work.manage') } },
    { name: 'rejectionReason', type: 'textarea' },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
  ],
  versions: false,
}
