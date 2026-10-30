import { APIError, type CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrAnyPermitted, ownerOrPermitted, permitted, permittedField } from '@/access/appAccess'

const workflowField = ({ req }: { req: { context?: Record<string, unknown>; user?: unknown } }) =>
  Boolean(req.context?.trustedCustomerWorkflow || req.context?.trustedPaymentSettlement) || permittedField('work.manage')({ req } as never)

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'code',
    defaultColumns: ['code', 'brand', 'status', 'jobState', 'updatedAt'],
  },
  access: {
    create: customerOrPermitted('work.manage'),
    delete: permitted('work.cancel'),
    read: ownerOrPermitted('work.read'),
    update: ownerOrAnyPermitted(['work.manage', 'finance.manage']),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        const user = req.user as { collection?: string; id?: string | number; role?: string } | null
        if (operation === 'create' && user?.collection === 'users' && user.role === 'customer') {
          data.customer = user.id
          if (!req.context?.trustedReviewMirror) {
            const quoteID = typeof data.quote === 'object' ? data.quote?.id : data.quote
            if (!quoteID) throw new APIError('Đơn hàng phải được tạo từ báo giá hợp lệ.', 400)
            const quote = await req.payload.findByID({ collection: 'quotes', id: quoteID, user: req.user, overrideAccess: false, depth: 0 })
            if (quote.status !== 'sent' && quote.status !== 'accepted') throw new APIError('Báo giá không còn hiệu lực.', 400)
            const serviceID = typeof quote.service === 'object' ? quote.service.id : quote.service
            const service = await req.payload.findByID({ collection: 'services', id: serviceID, overrideAccess: false, depth: 0 })
            data.code = req.context?.trustedOrderCode || `AIS-${Date.now().toString(36).toUpperCase()}`
            data.service = service.id
            data.brand = quote.brand
            data.brief = quote.brief
            data.status = 'awaiting_deposit'
            data.jobState = 'queued'
            data.total = quote.total
            data.paid = 0
            data.version = 0
            data.includedRevisions = quote.includedRevisions
            data.usedRevisions = 0
            data.dueAt = new Date(Date.now() + (quote.rush ? 1 : service.slaDays) * 24 * 3600_000).toISOString()
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true, access: { update: permittedField('work.manage') } },
    { name: 'customer', type: 'relationship', relationTo: 'users' as never, required: true, index: true, access: { update: permittedField('work.manage') } },
    { name: 'quote', type: 'relationship', relationTo: 'quotes', access: { update: permittedField('work.manage') } },
    { name: 'service', type: 'relationship', relationTo: 'services' as never, required: true, access: { update: permittedField('work.manage') } },
    { name: 'brand', type: 'text', required: true, access: { update: permittedField('work.manage') } },
    { name: 'brief', type: 'textarea', required: true, access: { update: permittedField('work.manage') } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'awaiting_deposit',
      options: ['awaiting_deposit', 'active', 'awaiting_final', 'completed', 'canceled'],
      access: { create: permittedField('work.manage'), update: workflowField },
    },
    {
      name: 'jobState',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      options: ['queued', 'offered', 'assigned', 'running', 'input_required', 'submitted', 'qc_review', 'pending_approval', 'client_review', 'revision_requested', 'accepted', 'completed', 'on_hold', 'stalled', 'escalated', 'canceled', 'failed'],
      access: { create: permittedField('work.manage'), update: workflowField },
    },
    { name: 'total', type: 'number', required: true, min: 0, access: { update: permittedField('work.manage') } },
    { name: 'paid', type: 'number', required: true, min: 0, defaultValue: 0, access: { create: permittedField('finance.manage'), update: permittedField('finance.manage') } },
    { name: 'version', type: 'number', required: true, min: 0, defaultValue: 0, access: { create: permittedField('work.manage'), update: permittedField('work.manage') } },
    { name: 'includedRevisions', type: 'number', required: true, min: 0, access: { update: permittedField('work.manage') } },
    { name: 'extraRevisions', type: 'number', required: true, min: 0, defaultValue: 0, access: { create: permittedField('work.manage'), update: workflowField } },
    { name: 'usedRevisions', type: 'number', required: true, min: 0, defaultValue: 0, access: { create: permittedField('work.manage'), update: permittedField('work.manage') } },
    { name: 'dueAt', type: 'date', required: true, access: { update: permittedField('work.manage') } },
    { name: 'internalNote', type: 'textarea', access: { read: permittedField('work.read'), create: permittedField('work.manage'), update: permittedField('work.manage') } },
  ],
  versions: false,
}
