import type { CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrPermitted, permitted, permittedField } from '@/access/appAccess'

export const ReviewComments: CollectionConfig = {
  slug: 'review-comments',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'text',
    defaultColumns: ['order', 'assetLabel', 'status', 'updatedAt'],
  },
  access: {
    create: customerOrPermitted('work.manage'),
    delete: permitted('work.manage'),
    read: ownerOrPermitted('work.read'),
    update: ownerOrPermitted('work.manage'),
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        const user = req.user as { collection?: string; id?: string | number; role?: string } | null
        if (operation === 'create' && user?.collection === 'users' && user.role === 'customer') {
          data.customer = user.id
          data.authorRole = 'client'
          data.status = 'open'
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders' as never, required: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'users' as never, required: true, index: true },
    { name: 'version', type: 'number', required: true, min: 1 },
    { name: 'assetKey', type: 'text', required: true },
    { name: 'assetLabel', type: 'text', required: true },
    { name: 'viewport', type: 'select', required: true, options: ['desktop', 'tablet', 'mobile'] },
    { name: 'kind', type: 'select', required: true, options: ['pin', 'region'] },
    { name: 'x', type: 'number', required: true, min: 0, max: 100 },
    { name: 'y', type: 'number', required: true, min: 0, max: 100 },
    {
      name: 'region',
      type: 'group',
      fields: [
        { name: 'width', type: 'number', min: 0, max: 100 },
        { name: 'height', type: 'number', min: 0, max: 100 },
      ],
    },
    { name: 'text', type: 'textarea', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: ['open', 'in_progress', 'fixed', 'confirming', 'resolved'],
      access: { create: permittedField('work.manage'), update: permittedField('work.manage') },
    },
    { name: 'capture', type: 'upload', relationTo: 'review-media' as never },
    {
      name: 'authorRole',
      type: 'select',
      required: true,
      defaultValue: 'client',
      options: ['client', 'owner'],
      access: { create: permittedField('work.manage'), update: permittedField('work.manage') },
    },
    {
      name: 'replies',
      type: 'array',
      fields: [
        { name: 'from', type: 'select', required: true, options: ['client', 'owner'] },
        { name: 'text', type: 'textarea', required: true },
        { name: 'sentAt', type: 'date', required: true },
      ],
    },
  ],
  versions: false,
}
