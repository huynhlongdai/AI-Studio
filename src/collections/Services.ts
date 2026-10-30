import type { CollectionConfig } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import { permitted } from '@/access/appAccess'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    group: 'AI Studio',
    useAsTitle: 'name',
  },
  access: {
    create: permitted('services.manage'),
    delete: permitted('services.manage'),
    read: () => true,
    update: permitted('services.manage'),
  },
  hooks: {
    afterChange: [() => { revalidateTag('services', 'max'); revalidatePath('/') }],
    afterDelete: [() => { revalidateTag('services', 'max'); revalidatePath('/') }],
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'shortName', type: 'text', required: true },
    { name: 'description', type: 'textarea', required: true },
    { name: 'basePrice', type: 'number', required: true, min: 0 },
    { name: 'rushSurcharge', type: 'number', required: true, min: 0 },
    { name: 'includedRevisions', type: 'number', required: true, min: 0 },
    { name: 'slaDays', type: 'number', required: true, min: 1 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      name: 'deliverables',
      type: 'array',
      required: true,
      fields: [{ name: 'label', type: 'text', required: true }],
    },
    {
      name: 'options',
      type: 'array',
      fields: [
        { name: 'code', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
        { name: 'price', type: 'number', required: true, min: 0 },
      ],
    },
  ],
  versions: false,
}
