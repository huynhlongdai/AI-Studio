export const STAFF_ROLES = ['admin', 'manager', 'specialist', 'finance'] as const
export type StaffRole = typeof STAFF_ROLES[number]

export const PERMISSION_GROUPS = [
  {
    label: 'Vận hành',
    permissions: [
      { id: 'dashboard.view', label: 'Xem tổng quan studio' },
      { id: 'conversations.manage', label: 'Đọc, trả lời và tiếp quản hội thoại' },
      { id: 'approvals.manage', label: 'Duyệt kế hoạch, bản nháp và hành động agent' },
      { id: 'work.read', label: 'Xem bảng việc, brief và review' },
      { id: 'work.manage', label: 'Điều phối, gia hạn và cập nhật việc' },
      { id: 'work.cancel', label: 'Hủy việc và tặng lượt sửa' },
      { id: 'orders.read', label: 'Xem đơn hàng' },
      { id: 'orders.manage', label: 'Thay đổi vòng đời đơn hàng' },
    ],
  },
  {
    label: 'Khách hàng & kinh doanh',
    permissions: [
      { id: 'customers.read', label: 'Xem hồ sơ khách hàng' },
      { id: 'customers.credit', label: 'Điều chỉnh credit khách hàng' },
      { id: 'sales.manage', label: 'Quản lý agent bán hàng và điều khoản' },
      { id: 'partners.manage', label: 'Quản lý đối tác và marketplace' },
      { id: 'partners.payout', label: 'Duyệt và thực hiện chi trả đối tác' },
    ],
  },
  {
    label: 'Tài chính & cấu hình',
    permissions: [
      { id: 'finance.read', label: 'Xem doanh thu và thanh toán' },
      { id: 'finance.manage', label: 'Đối soát và cập nhật thanh toán' },
      { id: 'reports.read', label: 'Xem và xuất báo cáo' },
      { id: 'services.manage', label: 'Quản lý dịch vụ và bảng giá' },
      { id: 'agents.read', label: 'Xem hoạt động agent và runtime' },
      { id: 'agents.manage', label: 'Cấu hình agent, model và runtime' },
      { id: 'agents.emergency', label: 'Dừng khẩn cấp hoặc nới trần chi phí' },
      { id: 'team.manage', label: 'Quản lý nhân sự và phân quyền' },
      { id: 'settings.manage', label: 'Quản lý cấu hình hệ thống' },
    ],
  },
] as const

export type StaffPermission = typeof PERMISSION_GROUPS[number]['permissions'][number]['id']
export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id)) as StaffPermission[]

const pick = (...permissions: StaffPermission[]) => permissions

export const ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  admin: ALL_PERMISSIONS,
  manager: pick(
    'dashboard.view', 'conversations.manage', 'approvals.manage', 'work.read', 'work.manage', 'work.cancel',
    'orders.read', 'orders.manage', 'customers.read', 'customers.credit', 'sales.manage', 'partners.manage',
    'finance.read', 'reports.read', 'agents.read', 'agents.manage', 'agents.emergency',
  ),
  specialist: pick(
    'dashboard.view', 'conversations.manage', 'approvals.manage', 'work.read', 'work.manage',
    'orders.read', 'customers.read', 'sales.manage', 'partners.manage', 'agents.read',
  ),
  finance: pick(
    'dashboard.view', 'orders.read', 'customers.read', 'partners.manage', 'partners.payout',
    'finance.read', 'finance.manage', 'reports.read',
  ),
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  manager: 'Điều phối',
  specialist: 'Chuyên viên',
  finance: 'Tài chính',
}

export function permissionsFor(role?: string, custom?: string[] | null): StaffPermission[] {
  if (role === 'admin') return ALL_PERMISSIONS
  if (custom) return custom.filter((permission): permission is StaffPermission => ALL_PERMISSIONS.includes(permission as StaffPermission))
  return ROLE_PERMISSIONS[STAFF_ROLES.includes(role as StaffRole) ? role as StaffRole : 'specialist']
}

export function hasStaffPermission(identity: { collection?: string; role?: string; permissions?: string[] | null; active?: boolean | null } | null | undefined, permission: StaffPermission) {
  if (identity?.collection === 'admins') return true
  if (identity?.collection !== 'users' || identity.role === 'customer' || identity.active === false) return false
  return permissionsFor(identity.role, identity.permissions).includes(permission)
}
