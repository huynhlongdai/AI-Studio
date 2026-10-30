import type { CollectionConfig } from 'payload'
import { customerOrPermitted, ownerOrPermitted } from '@/access/appAccess'

export const ReviewMedia: CollectionConfig = {
  slug: 'review-media',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'alt',
  },
  access: {
    create: customerOrPermitted('work.manage'),
    delete: ownerOrPermitted('work.manage'),
    read: ownerOrPermitted('work.read'),
    update: ownerOrPermitted('work.manage'),
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
    { name: 'alt', type: 'text', required: true },
    { name: 'customer', type: 'relationship', relationTo: 'users' as never, required: true, index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders' as never, required: true, index: true },
  ],
  upload: {
    mimeTypes: ['image/*'],
  },
  versions: false,
}
