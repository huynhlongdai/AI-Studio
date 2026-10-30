import type { CollectionConfig } from 'payload'
import { ownerOrAnyPermitted, permitted, permittedField } from '@/access/appAccess'
import { hasStaffPermission, PERMISSION_GROUPS } from '@/lib/staffPermissions'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    hidden: true,
    useAsTitle: 'name',
  },
  auth: true,
  access: {
    create: () => true,
    delete: permitted('team.manage'),
    read: ownerOrAnyPermitted(['team.manage', 'customers.read'], 'id'),
    update: ownerOrAnyPermitted(['team.manage'], 'id'),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'businessName', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'industry', type: 'text' },
    { name: 'taxId', type: 'text' },
    {
      name: 'preferredChannel',
      type: 'select',
      defaultValue: 'email',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'Zalo', value: 'zalo' },
        { label: 'Điện thoại / SMS', value: 'phone' },
      ],
    },
    {
      name: 'notificationPreferences',
      type: 'group',
      fields: [
        { name: 'draft', type: 'checkbox', defaultValue: true },
        { name: 'payment', type: 'checkbox', defaultValue: true },
        { name: 'marketing', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'customer',
      options: [
        { label: 'Khách hàng', value: 'customer' },
        { label: 'Chuyên viên', value: 'specialist' },
        { label: 'Điều phối', value: 'manager' },
        { label: 'Tài chính', value: 'finance' },
        { label: 'Admin ứng dụng', value: 'admin' },
      ],
      access: {
        create: permittedField('team.manage'),
        update: permittedField('team.manage'),
      },
    },
    {
      name: 'permissions',
      type: 'select',
      hasMany: true,
      options: PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => ({ label: `${group.label} · ${permission.label}`, value: permission.id }))),
      admin: { description: 'Để trống để dùng bộ quyền mặc định của vai trò. Admin luôn có toàn quyền.' },
      access: {
        create: permittedField('team.manage'),
        read: ({ req }) => hasStaffPermission(req.user as never, 'team.manage') || (req.user as { collection?: string; role?: string } | null)?.collection === 'users' && (req.user as { role?: string }).role !== 'customer',
        update: permittedField('team.manage'),
      },
    },
    {
      name: 'skills',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Logo & nhận diện', value: 'logo' },
        { label: 'Nội dung mạng xã hội', value: 'post' },
        { label: 'Video ngắn', value: 'video' },
        { label: 'Landing page', value: 'landing' },
      ],
      access: {
        create: permittedField('team.manage'),
        update: permittedField('team.manage'),
      },
    },
    {
      name: 'maxQueue',
      type: 'number',
      min: 1,
      max: 100,
      defaultValue: 8,
      access: {
        create: permittedField('team.manage'),
        update: permittedField('team.manage'),
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      access: {
        create: permittedField('team.manage'),
        update: permittedField('team.manage'),
      },
    },
  ],
  versions: false,
}
