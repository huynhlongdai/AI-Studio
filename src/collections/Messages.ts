import { APIError, type CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrPermitted, permitted, permittedField } from '@/access/appAccess'

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'text',
    defaultColumns: ['conversation', 'sender', 'createdAt'],
  },
  access: {
    create: customerOrPermitted('conversations.manage'),
    delete: permitted('conversations.manage'),
    read: ownerOrPermitted('conversations.manage'),
    update: permitted('conversations.manage'),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data
        const user = req.user as { collection?: string; id?: string | number; role?: string } | null
        if (user?.collection === 'users') {
          const conversationID = typeof data.conversation === 'object' ? data.conversation?.id : data.conversation
          if (!conversationID) throw new APIError('Cuộc trò chuyện không hợp lệ.', 400)
          const conversation = await req.payload.findByID({ collection: 'conversations', id: conversationID, user: req.user, overrideAccess: false, depth: 0 })
          data.customer = user.role === 'customer' ? user.id : typeof conversation.customer === 'object' ? conversation.customer.id : conversation.customer
          data.sender = req.context?.trustedSender || (user.role === 'customer' ? 'client' : 'owner')
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'conversation', type: 'relationship', relationTo: 'conversations', required: true, index: true, access: { update: () => false } },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, index: true, access: { update: () => false } },
    { name: 'sender', type: 'select', required: true, options: ['client', 'assistant', 'owner', 'system'], access: { update: () => false } },
    { name: 'text', type: 'textarea', required: true, access: { update: () => false } },
    { name: 'quote', type: 'relationship', relationTo: 'quotes', access: { update: () => false } },
    { name: 'readAt', type: 'date', access: { update: permittedField('conversations.manage') } },
  ],
  versions: false,
}
