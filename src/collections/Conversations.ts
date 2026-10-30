import type { CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrPermitted, permitted, permittedField } from '@/access/appAccess'

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'customer', 'handoff', 'updatedAt'],
  },
  access: {
    create: customerOrPermitted('conversations.manage'),
    delete: permitted('conversations.manage'),
    read: ownerOrPermitted('conversations.manage'),
    update: ownerOrPermitted('conversations.manage'),
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        const user = req.user as { collection?: string; id?: string | number; role?: string } | null
        if (operation === 'create' && user?.collection === 'users' && user.role === 'customer') data.customer = user.id
        return data
      },
    ],
  },
  fields: [
    { name: 'subject', type: 'text', required: true, defaultValue: 'Tư vấn dịch vụ' },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, unique: true, index: true },
    { name: 'handoff', type: 'checkbox', defaultValue: false },
    { name: 'takeover', type: 'checkbox', defaultValue: false, access: { create: permittedField('conversations.manage'), update: permittedField('conversations.manage') } },
    { name: 'internalNote', type: 'textarea', access: { read: permittedField('conversations.manage'), create: permittedField('conversations.manage'), update: permittedField('conversations.manage') } },
    { name: 'lastMessageAt', type: 'date' },
  ],
  versions: false,
}
