import { useEffect, useState, useTransition } from 'react'
import { listManagedStaff, saveManagedStaff } from '@/app/(frontend)/actions/staff'
import { CATALOG, type ServiceCode } from '../../lib/catalog'
import { useStore, type Member } from '../../store'
import { Btn, Icon, Modal, Page, PageHead, when } from '../../ui'
import { ALL_PERMISSIONS, PERMISSION_GROUPS, permissionsFor, ROLE_LABELS, ROLE_PERMISSIONS, STAFF_ROLES, type StaffPermission, type StaffRole } from '@/lib/staffPermissions'

/** Nhân sự studio và phân quyền (admin). */
export default function Team() {
  const { db, hydrateStaff, saveMember } = useStore()
  const [edit, setEdit] = useState<Member | null>(null)
  const [syncError, setSyncError] = useState('')
  const [syncing, startSync] = useTransition()
  const load = (m: Member) => db.orders.filter((o) => o.status === 'active' && o.job === 'pending_approval' && m.skills.includes(o.service)).length
  useEffect(() => {
    startSync(async () => {
      const result = await listManagedStaff()
      if (!result.ok) { setSyncError(result.error); return }
      hydrateStaff(result.staff.map((member) => ({ ...member, createdAt: new Date(member.createdAt).getTime() })))
    })
  }, [])
  return (
    <Page max={1080}>
      <PageHead title="Nhân sự & phân quyền" sub="Quyền theo vai trò, có thể tinh chỉnh riêng từng thành viên. Admin luôn có toàn quyền." end={<Btn kind="primary" onClick={() => setEdit({ id: 'm' + Date.now().toString(36), name: '', email: '', role: 'specialist', active: true, skills: ['post'], maxQueue: 8, createdAt: Date.now() })}><Icon name="plus" size={14} />Mời thành viên</Btn>} />
      {(syncing || syncError) && <p className={`text-xs rounded-r px-3 py-2 ${syncError ? 'bg-warn/10 text-warn' : 'bg-soft text-ink-3'}`}>{syncError || 'Đang đồng bộ danh sách nhân sự từ Payload…'}</p>}
      <dl className="grid grid-cols-4 max-md:grid-cols-2 border border-line rounded-r2 divide-x divide-line max-md:divide-x-0 max-md:[&>div:nth-child(odd)]:border-r max-md:[&>div:nth-child(-n+2)]:border-b [&>div]:border-line">
        {STAFF_ROLES.map((role) => <div key={role} className="p-3.5"><dt className="text-xs text-ink-3">{ROLE_LABELS[role]}</dt><dd className="text-xl font-medium tabular-nums">{db.staff.filter((member) => member.role === role && member.active).length}</dd><dd className="text-xs text-ink-3">{ROLE_PERMISSIONS[role].length}/{ALL_PERMISSIONS.length} quyền mặc định</dd></div>)}
      </dl>
      <ul className="border border-line rounded-r2 divide-y divide-line">
        {db.staff.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-4 max-md:flex-wrap">
            <span className="size-8 rounded-full bg-hover grid place-items-center text-xs font-medium">{m.name.slice(0, 2).toUpperCase()}</span>
            <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">{m.name} {!m.active && <span className="text-xs text-red-600">· đã khóa</span>}</p><p className="text-xs text-ink-3">{m.email} · tham gia {when(m.createdAt)}</p></div>
            <span className={`text-xs rounded px-2 py-0.5 ${m.role === 'admin' ? 'bg-ink text-white' : 'bg-accent/10 text-accent'}`}>{ROLE_LABELS[m.role]}</span>
            <span className="text-xs text-ink-3 w-44">{m.skills.map((s) => CATALOG.find((c) => c.code === s)?.short).join(', ')}</span>
            <span className="text-xs font-mono w-24 text-right">{permissionsFor(m.role, m.permissions).length} quyền</span>
            <span className="text-xs font-mono w-20 text-right">{load(m)}/{m.maxQueue} việc</span>
            <Btn size="s" onClick={() => setEdit(m)}>Sửa</Btn>
          </li>
        ))}
      </ul>
      <section className="grid gap-3">
        <div><h2 className="text-sm">Ma trận quyền mặc định</h2><p className="text-xs text-ink-3 mt-0.5">Quyền tùy chỉnh của từng người được cấu hình trong hồ sơ thành viên.</p></div>
        <div className="border border-line rounded-r2 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px] border-separate border-spacing-0">
            <thead><tr className="text-xs text-ink-3 bg-side [&>th]:font-normal [&>th]:p-2.5 [&>th]:text-left"><th>Nhóm / quyền</th>{STAFF_ROLES.map((role) => <th key={role} className="w-28 text-center">{ROLE_LABELS[role]}</th>)}</tr></thead>
            <tbody>{PERMISSION_GROUPS.flatMap((group) => [
              <tr key={group.label} className="bg-soft"><td colSpan={5} className="px-2.5 py-1.5 text-xs font-medium text-ink-2 border-t border-line">{group.label}</td></tr>,
              ...group.permissions.map((permission) => <tr key={permission.id} className="[&>td]:p-2.5 [&>td]:border-t [&>td]:border-line"><td>{permission.label}<span className="block font-mono text-[11px] text-ink-3">{permission.id}</span></td>{STAFF_ROLES.map((role) => { const allowed = ROLE_PERMISSIONS[role].includes(permission.id); return <td key={role} className={`text-center ${allowed ? 'text-ok' : 'text-ink-3'}`}>{allowed ? <Icon name="check" size={15} className="mx-auto" /> : '—'}</td> })}</tr>),
            ])}</tbody>
          </table>
        </div>
      </section>
      {edit && <Editor m={edit} onClose={() => setEdit(null)} onSave={async (member, temporaryPassword) => {
        const result = await saveManagedStaff({
          id: member.id, name: member.name, email: member.email, role: member.role, permissions: member.permissions,
          active: member.active, skills: member.skills, maxQueue: member.maxQueue, temporaryPassword,
        })
        if (!result.ok) return result.error
        saveMember({ ...result.staff, createdAt: new Date(result.staff.createdAt).getTime() })
        setEdit(null)
      }} isLast={edit.role === 'admin' && db.staff.filter((x) => x.role === 'admin' && x.active).length <= 1} />}
    </Page>
  )
}

function Editor({ m, onClose, onSave, isLast }: { m: Member; onClose: () => void; onSave: (m: Member, temporaryPassword?: string) => Promise<string | undefined>; isLast: boolean }) {
  const [f, setF] = useState(m)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const custom = f.permissions !== undefined
  const effective = permissionsFor(f.role, f.permissions)
  const ok = f.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && f.skills.length > 0 && !(isLast && (f.role !== 'admin' || !f.active))
  const setRole = (role: StaffRole) => setF({ ...f, role, permissions: undefined })
  const togglePermission = (permission: StaffPermission) => {
    const current = f.permissions ?? permissionsFor(f.role)
    setF({ ...f, permissions: current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission] })
  }
  return (
    <Modal title={m.name ? `Sửa ${m.name}` : 'Mời thành viên'} onClose={onClose}>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Tên</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Email</span><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Mật khẩu tạm <span className="font-normal">(chỉ cần khi tạo tài khoản mới)</span></span><input type="password" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} placeholder="Tối thiểu 12 ký tự" autoComplete="new-password" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <div className="grid grid-cols-2 gap-2">{STAFF_ROLES.map((role) => <Btn key={role} onClick={() => setRole(role)} className={`!h-auto !p-2.5 !justify-start ${f.role === role ? 'border-accent bg-accent/5' : ''}`}><span className="grid text-left"><b>{ROLE_LABELS[role]}</b><span className="text-xs text-ink-3 font-normal">{ROLE_PERMISSIONS[role].length} quyền mặc định</span></span></Btn>)}</div>
      <fieldset className="text-[13px] grid gap-1"><legend className="text-ink-3 mb-1">Kỹ năng duyệt</legend><div className="flex flex-wrap gap-1.5">{CATALOG.map((c) => <label key={c.code} className={`border rounded px-2 py-1 cursor-pointer ${f.skills.includes(c.code) ? 'border-accent text-accent' : 'border-line text-ink-3'}`}><input type="checkbox" className="sr-only" checked={f.skills.includes(c.code)} onChange={() => setF({ ...f, skills: f.skills.includes(c.code) ? f.skills.filter((x) => x !== c.code) : [...f.skills, c.code as ServiceCode] })} />{c.short}</label>)}</div></fieldset>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Tối đa việc chờ duyệt cùng lúc</span><input type="number" min={1} value={f.maxQueue} onChange={(e) => setF({ ...f, maxQueue: Math.max(1, Number(e.target.value)) })} className="h-9 px-2.5 border border-line rounded-r w-28 font-mono" /></label>
      {f.role !== 'admin' && <section className="grid gap-2 border border-line rounded-r2 p-3">
        <div className="flex items-center gap-2"><div className="flex-1"><p className="text-[13px] font-medium">Quyền riêng thành viên</p><p className="text-xs text-ink-3">{custom ? `${effective.length}/${ALL_PERMISSIONS.length} quyền đang bật` : `Đang dùng quyền mặc định của ${ROLE_LABELS[f.role]}`}</p></div><Btn size="s" onClick={() => setF({ ...f, permissions: custom ? undefined : [...permissionsFor(f.role)] })}>{custom ? 'Dùng mặc định' : 'Tùy chỉnh'}</Btn></div>
        {custom && <div className="grid gap-3 max-h-64 overflow-auto border-t border-line pt-2">{PERMISSION_GROUPS.map((group) => <fieldset key={group.label} className="grid gap-1"><legend className="text-xs font-medium mb-1">{group.label}</legend>{group.permissions.map((permission) => <label key={permission.id} className="flex gap-2 items-start text-xs py-1"><input type="checkbox" checked={effective.includes(permission.id)} onChange={() => togglePermission(permission.id)} className="mt-0.5 accent-accent" /><span>{permission.label}<span className="block font-mono text-[11px] text-ink-3">{permission.id}</span></span></label>)}</fieldset>)}</div>}
      </section>}
      <label className="flex gap-2 items-center text-[13px]"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-accent" />Đang hoạt động</label>
      {isLast && <p className="text-xs text-warn">Đây là admin cuối cùng — không thể hạ quyền hoặc khóa.</p>}
      {error && <p role="alert" className="text-xs text-warn bg-warn/10 rounded-r px-3 py-2">{error}</p>}
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={!ok || saving} onClick={() => startSaving(async () => { setError(''); const message = await onSave({ ...f, name: f.name.trim(), email: f.email.trim() }, temporaryPassword || undefined); if (message) setError(message) })}>{saving ? 'Đang lưu…' : 'Lưu'}</Btn></div>
    </Modal>
  )
}
