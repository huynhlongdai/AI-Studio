import { useEffect, useRef, useState, type ReactNode } from 'react'
import { navigate, useRoute } from './router'
import { canStaff, StoreProvider, useMine, useStore } from './store'
import { ROLE_LABELS, type StaffPermission } from '@/lib/staffPermissions'
import { Icon, when } from './ui'
import Landing from './screens/Landing'
import Dashboard from './screens/client/Dashboard'
import Chat from './screens/client/Chat'
import Quotes from './screens/client/Quotes'
import QuoteDetail from './screens/client/QuoteDetail'
import Payment from './screens/client/Payment'
import Orders from './screens/client/Orders'
import OrderDetail from './screens/client/OrderDetail'
import Revise from './screens/client/Revise'
import AdminDashboard from './screens/admin/AdminDashboard'
import Approvals from './screens/admin/Approvals'
import Jobs from './screens/admin/Jobs'
import Inbox from './screens/admin/Inbox'
import AdminOrders from './screens/admin/AdminOrders'
import Customers from './screens/admin/Customers'
import Finance from './screens/admin/Finance'
import Services from './screens/admin/Services'
import Settings from './screens/admin/Settings'
import Login from './screens/Login'
import Onboarding from './screens/client/Onboarding'
import Plans from './screens/client/Plans'
import Account from './screens/client/Account'
import SalesAgent from './screens/client/SalesAgent'
import AgentOps from './screens/admin/AgentOps'
import SalesAgents from './screens/admin/SalesAgents'
import AgentLive from './screens/admin/AgentLive'
import Partners from './screens/admin/Partners'
import Provider from './screens/Provider'
import AgentConsole from './screens/AgentConsole'
import ShopStaff from './screens/ShopStaff'
import Widget from './screens/Widget'
import SpecialistHome from './screens/admin/SpecialistHome'
import SalesAgentDetail from './screens/admin/SalesAgentDetail'
import Team from './screens/admin/Team'
import Reports from './screens/admin/Reports'

const ROUTE_PERMISSION: Record<string, StaffPermission> = {
  '': 'dashboard.view', 'hop-thu': 'conversations.manage', duyet: 'approvals.manage', viec: 'work.read',
  'trung-tam-agent': 'agents.read', 'don-hang': 'orders.read', 'khach-hang': 'customers.read',
  'tai-chinh': 'finance.read', 'bao-cao': 'reports.read', 'dich-vu': 'services.manage',
  'agent-khach': 'sales.manage', 'doi-tac': 'partners.manage', agent: 'agents.manage',
  'nhan-su': 'team.manage', 'cai-dat': 'settings.manage',
}
const staffOf = (db: { staff: { id: string; name: string; role: keyof typeof ROLE_LABELS }[]; session: { member?: string; staff: keyof typeof ROLE_LABELS } }) => {
  const m = db.staff.find((x) => x.id === db.session.member) ?? db.staff.find((x) => x.role === db.session.staff)
  const role = m?.role ?? db.session.staff
  return { name: m?.name ?? 'Studio', role: ROLE_LABELS[role], initials: (m?.name ?? 'ST').slice(0, 2).toUpperCase() }
}

export default function App() {
  return <StoreProvider><Router /></StoreProvider>
}

function NoAccess() {
  return <div className="p-10 grid gap-2 justify-items-start"><h1 className="text-xl">Bạn chưa được cấp quyền</h1><p className="text-[13px] text-ink-3">Liên hệ admin để được bổ sung quyền cho chức năng này.</p></div>
}

function NotFound() {
  return <div className="p-10 grid gap-2 justify-items-start"><h1 className="text-xl">Không tìm thấy trang</h1><a href="#/app" className="text-accent text-[13px] font-medium">Về tổng quan</a></div>
}

function Router() {
  const r = useRoute()
  const { db } = useStore()
  useEffect(() => { document.documentElement.lang = 'vi' }, [])
  if (r[0] === 'dang-nhap') return <Login />
  if (r[0] === 'nv') return <ShopStaff />
  if (r[0] === 'w' && r[1]) return <Widget customer={r[1]} />
  if (r[0] === 'doi-tac') return <Provider tab={r[1]} id={r[2]} />
  if (r[0] === 'agent') return db.session.admin ? <AgentConsole id={r[1]} /> : <Login admin />
  if (r[0] !== 'app' && r[0] !== 'admin') return <Landing />

  if (r[0] === 'admin') {
    if (r[1] === 'dang-nhap' || !db.session.admin) return <Login admin />
    const [, a, id] = r
    if (!canStaff(db, ROUTE_PERMISSION[a ?? ''] ?? 'dashboard.view')) return <Shell admin active={a ?? ''}><NoAccess /></Shell>
    const v = !a ? (db.session.staff === 'specialist' ? <SpecialistHome /> : <AdminDashboard />) : a === 'hop-thu' ? <Inbox selected={id} /> : a === 'duyet' ? <Approvals selected={id} /> : a === 'viec' ? <Jobs selected={id} />
      : a === 'don-hang' ? <AdminOrders /> : a === 'khach-hang' ? <Customers selected={id} /> : a === 'tai-chinh' ? <Finance /> : a === 'dich-vu' ? <Services /> : a === 'cai-dat' ? <Settings /> : a === 'agent' ? <AgentOps /> : a === 'agent-khach' ? (id ? <SalesAgentDetail customer={id} /> : <SalesAgents />) : a === 'nhan-su' ? <Team /> : a === 'bao-cao' ? <Reports /> : a === 'trung-tam-agent' ? <AgentLive /> : a === 'doi-tac' ? <Partners id={id} tab={id} /> : <NotFound />
    return <Shell admin active={a ?? ''} flush={a === 'hop-thu'}>{v}</Shell>
  }
  if (!db.session.client.loggedIn) return <Login />
  const [, a, id, tab] = r
  if (!db.session.client.onboarded || a === 'bat-dau') return <Shell active="">{<Onboarding />}</Shell>
  const v = !a ? <Dashboard />
    : a === 'chat' ? <Chat />
    : a === 'bao-gia' ? (id ? <QuoteDetail code={id} /> : <Quotes />)
    : a === 'thanh-toan' && id ? <Payment id={id} />
    : a === 'don-hang' ? (!id ? <Orders /> : tab === 'sua' ? <Revise code={id} /> : <OrderDetail code={id} tab={tab} />)
    : a === 'agent' ? <SalesAgent tab={id} />
    : a === 'goi' ? <Plans />
    : a === 'tai-khoan' ? <Account />
    : <NotFound />
  return <Shell active={a ?? ''}>{v}</Shell>
}

type NavItem = { id: string; href: string; label: string; short: string; icon: string; count?: number; hot?: boolean }

function Shell({ admin = false, active, flush = false, children }: { admin?: boolean; active: string; flush?: boolean; children: ReactNode }) {
  const { db } = useStore()
  const me = useMine()
  const [more, setMore] = useState(false)
  const needAction = me.orders.filter((o) => o.job === 'client_review' || o.status === 'awaiting_deposit' || o.status === 'awaiting_final').length
  const openQuotes = me.quotes.filter((q) => q.status === 'sent').length
  const pending = db.orders.filter((o) => o.job === 'pending_approval' || (o.status === 'active' && o.plan?.status === 'pending')).length
  const termsReq = db.sales.filter((a) => a.termsRequested).length
  const newLeads = me.sales?.leads.filter((l) => l.status === 'new').length ?? 0
  const running = db.orders.filter((o) => o.status === 'active' && o.job !== 'completed').length
  const inbox = db.threads.reduce((s, t) => s + t.unread, 0)

  let groups: [string, NavItem[]][] = admin
    ? [
        ['Vận hành', [
          { id: '', href: '#/admin', label: 'Tổng quan', short: 'Tổng quan', icon: 'grid' },
          { id: 'hop-thu', href: '#/admin/hop-thu', label: 'Hộp thư', short: 'Hộp thư', icon: 'chat', count: inbox, hot: inbox > 0 },
          { id: 'duyet', href: '#/admin/duyet', label: 'Hàng chờ duyệt', short: 'Duyệt', icon: 'eye', count: pending, hot: pending > 0 },
          { id: 'viec', href: '#/admin/viec', label: 'Bảng việc', short: 'Việc', icon: 'box', count: running },
          { id: 'trung-tam-agent', href: '#/admin/trung-tam-agent', label: 'Trung tâm agent', short: 'Agent', icon: 'spark' },
          { id: 'don-hang', href: '#/admin/don-hang', label: 'Đơn hàng', short: 'Đơn', icon: 'file' },
        ]],
        ['Kinh doanh', [
          { id: 'khach-hang', href: '#/admin/khach-hang', label: 'Khách hàng', short: 'Khách', icon: 'user', count: db.customers.length },
          { id: 'tai-chinh', href: '#/admin/tai-chinh', label: 'Tài chính', short: 'Tài chính', icon: 'card' },
          { id: 'bao-cao', href: '#/admin/bao-cao', label: 'Báo cáo', short: 'Báo cáo', icon: 'pulse' },
          { id: 'dich-vu', href: '#/admin/dich-vu', label: 'Dịch vụ & bảng giá', short: 'Dịch vụ', icon: 'spark' },
          { id: 'agent-khach', href: '#/admin/agent-khach', label: 'Agent bán hàng', short: 'Agent KH', icon: 'chat', count: termsReq, hot: termsReq > 0 },
          { id: 'doi-tac', href: '#/admin/doi-tac', label: 'Đối tác', short: 'Đối tác', icon: 'split', count: db.offers.filter((o) => o.status === 'delivered').length, hot: db.offers.some((o) => o.status === 'delivered') },
        ]],
        ['Hệ thống', [
          { id: 'agent', href: '#/admin/agent', label: 'Runtime & agent', short: 'Runtime', icon: 'pulse' },
          { id: 'nhan-su', href: '#/admin/nhan-su', label: 'Nhân sự & phân quyền', short: 'Nhân sự', icon: 'user' },
          { id: 'cai-dat', href: '#/admin/cai-dat', label: 'Cài đặt', short: 'Cài đặt', icon: 'shield' },
        ]],
      ]
    : [
        ['Không gian làm việc', [
          { id: '', href: '#/app', label: 'Tổng quan', short: 'Tổng quan', icon: 'grid' },
          { id: 'chat', href: '#/app/chat', label: 'Chat với trợ lý', short: 'Chat', icon: 'chat' },
          { id: 'bao-gia', href: '#/app/bao-gia', label: 'Báo giá', short: 'Báo giá', icon: 'file', count: openQuotes, hot: openQuotes > 0 },
          { id: 'don-hang', href: '#/app/don-hang', label: 'Đơn hàng', short: 'Đơn hàng', icon: 'pulse', count: needAction, hot: needAction > 0 },
          { id: 'agent', href: '#/app/agent', label: 'Agent bán hàng', short: 'Agent', icon: 'spark', count: newLeads, hot: newLeads > 0 },
        ]],
        ['Tài khoản', [
          { id: 'goi', href: '#/app/goi', label: 'Gói & credit', short: 'Gói', icon: 'card' },
          { id: 'tai-khoan', href: '#/app/tai-khoan', label: 'Cài đặt tài khoản', short: 'Tài khoản', icon: 'user' },
        ]],
      ]
  if (admin) groups = groups.map(([g, n]) => [g, n.filter((x) => canStaff(db, ROUTE_PERMISSION[x.id] ?? 'dashboard.view'))] as [string, NavItem[]]).filter(([, n]) => n.length)
  const flat = groups.flatMap(([, n]) => n)
  const tabs = admin ? flat.filter((n) => ['', 'hop-thu', 'duyet', 'viec'].includes(n.id)) : flat.slice(0, 4)
  const rest = flat.filter((n) => !tabs.includes(n))
  const navLink = (n: NavItem) => (
    <a key={n.id} href={n.href} aria-current={active === n.id ? 'page' : undefined} className={`flex items-center gap-2.5 w-full min-h-8 px-2 py-1.5 rounded-r text-[13px] transition-colors ${active === n.id ? 'bg-hover text-ink font-medium [&>svg]:text-accent' : 'text-ink-2 hover:bg-hover hover:text-ink'}`}>
      <Icon name={n.icon} />{n.label}
      {!!n.count && <span className={`ml-auto text-xs tabular-nums ${n.hot ? 'text-accent font-medium' : 'text-ink-3'}`}>{n.count}</span>}
    </a>
  )

  return (
    <div className="grid grid-cols-[232px_minmax(0,1fr)] max-md:grid-cols-1 min-h-dvh">
      <aside className="bg-side border-r border-line px-2.5 py-3.5 flex flex-col gap-0.5 sticky top-0 h-dvh max-md:hidden" aria-label="Điều hướng">
        <a href="#/" className="flex items-center gap-2.5 px-2 pt-1 pb-3.5">
          <span className="size-6 rounded-r bg-ink text-white grid place-items-center"><Icon name="spark" size={14} /></span>
          <div><p className="font-medium text-sm leading-tight">AI Studio</p><p className="text-xs text-ink-3">{admin ? `${staffOf(db).role} studio` : 'Studio sáng tạo AI'}</p></div>
        </a>
        <nav className="grid gap-0.5 overflow-auto">
          {groups.map(([g, items]) => <div key={g} className="grid gap-0.5"><p className="text-xs text-ink-3 px-2 pt-3.5 pb-1">{g}</p>{items.map(navLink)}</div>)}
        </nav>
        {!admin && <a href="#/app/chat" className="mt-3 mx-1 inline-flex items-center justify-center gap-1.5 min-h-8 rounded-r bg-accent text-white text-[13px] font-medium hover:bg-accent-ink"><Icon name="plus" size={14} /> Đặt việc mới</a>}
        <div className="flex-1" />
        <RoleSwitch admin={admin} />
        <div className="flex items-center gap-2.5 px-2 pt-3 border-t border-line">
          <span className="size-7 rounded-full bg-hover grid place-items-center text-xs font-medium text-ink-2 flex-none">{admin ? staffOf(db).initials : (me.customer.name || 'K').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase()}</span>
          <div className="min-w-0"><p className="font-medium text-[13px] leading-tight truncate">{admin ? staffOf(db).name : me.customer.name || 'Khách mới'}</p><p className="text-xs text-ink-3">{admin ? staffOf(db).role : me.credit > 0 ? `Credit ${me.credit.toLocaleString('vi-VN')}đ` : 'Khách hàng'}</p></div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="flex items-center gap-3 h-[53px] max-md:h-14 px-6 max-md:px-4 border-b border-line bg-white sticky top-0 z-30">
          <a href="#/" className="md:hidden size-7 rounded-r bg-ink text-white grid place-items-center" aria-label="Trang chủ"><Icon name="spark" size={15} /></a>
          <Search admin={admin} />
          {admin && <span className={`max-sm:hidden text-xs font-medium rounded px-2 py-1 ${db.session.staff === 'admin' ? 'bg-ink text-white' : 'bg-accent/10 text-accent'}`}>{staffOf(db).role}{db.session.staff === 'admin' ? ' · toàn quyền' : ''}</span>}
          <div className="ml-auto flex items-center gap-1">
            <div className="md:hidden"><RoleSwitch admin={admin} compact /></div>
            <Bell admin={admin} />
          </div>
        </header>
        <main className={`flex-1 ${flush ? '' : 'max-md:pb-24'}`}>{children}</main>
      </div>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 bg-white border-t border-line px-1 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))]" aria-label="Điều hướng chính">
        {tabs.map((n) => (
          <a key={n.id} href={n.href} aria-current={active === n.id ? 'page' : undefined} className={`relative grid justify-items-center gap-0.5 min-h-[52px] py-1.5 text-xs ${active === n.id ? 'text-accent font-medium' : 'text-ink-3'}`}>
            <Icon name={n.icon} size={20} />{n.short}
            {n.hot && <span className="absolute top-1.5 left-[calc(50%+8px)] size-1.5 rounded-full bg-accent" />}
          </a>
        ))}
        <button type="button" onClick={() => setMore(true)} aria-expanded={more} className={`grid justify-items-center gap-0.5 min-h-[52px] py-1.5 text-xs ${rest.some((n) => n.id === active) ? 'text-accent font-medium' : 'text-ink-3'}`}><Icon name="grid" size={20} />Thêm</button>
      </nav>
      {more && (
        <div className="md:hidden fixed inset-0 z-[60] bg-ink/40" onClick={() => setMore(false)}>
          <div className="enter absolute inset-x-0 bottom-0 bg-white rounded-t-[14px] p-3 pb-[calc(12px+env(safe-area-inset-bottom))] grid gap-1" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto w-10 h-1 rounded-full bg-line mb-2" />
            {rest.map((n) => <a key={n.id} href={n.href} onClick={() => setMore(false)} className={`flex items-center gap-3 min-h-12 px-3 rounded-r text-sm ${active === n.id ? 'bg-hover font-medium' : ''}`}><Icon name={n.icon} />{n.label}{!!n.count && <span className="ml-auto text-xs text-ink-3">{n.count}</span>}</a>)}
            {!admin && <a href="#/app/chat" onClick={() => setMore(false)} className="mt-1 flex items-center justify-center gap-2 min-h-12 rounded-r bg-accent text-white text-sm font-medium"><Icon name="plus" size={15} /> Đặt việc mới</a>}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleSwitch({ admin, compact = false }: { admin: boolean; compact?: boolean }) {
  const { db, reset, setStaffRole } = useStore()
  const [open, setOpen] = useState(false)
  const cur = location.hash.startsWith('#/agent') ? 'agent' : admin ? (db.session.staff === 'admin' ? 'admin' : db.session.member ?? 'thao') : 'client'
  const roles = [
    { id: 'client', icon: 'user', label: 'Khách hàng · Quán Mộc An', go: () => navigate('/app') },
    { id: 'agent', icon: 'spark', label: 'AI Agent · trung tâm agent', go: () => { setStaffRole(db.session.staff); navigate('/agent/mai') } },
    { id: 'thao', icon: 'eye', label: 'Chuyên viên · Thảo (logo, social)', go: () => { setStaffRole('specialist', 'thao'); navigate('/admin') } },
    { id: 'quan', icon: 'eye', label: 'Chuyên viên · Quân (video, web)', go: () => { setStaffRole('specialist', 'quan'); navigate('/admin') } },
    { id: 'linh', icon: 'box', label: 'Điều phối · Linh', go: () => { setStaffRole('manager', 'linh'); navigate('/admin') } },
    { id: 'ngan', icon: 'card', label: 'Tài chính · Ngân', go: () => { setStaffRole('finance', 'ngan'); navigate('/admin') } },
    { id: 'admin', icon: 'shield', label: 'Admin · Longca', go: () => { setStaffRole('admin'); navigate('/admin') } },
    { id: 'provider', icon: 'split', label: 'Đối tác (marketplace)', go: () => navigate('/doi-tac') },
    { id: 'shop', icon: 'user', label: 'Nhân viên shop · nhận lead', go: () => navigate('/nv') },
    { id: 'buyer', icon: 'chat', label: 'Người mua · widget Mộc An', go: () => navigate('/w/moc-an') },
  ]
  const curLabel = cur === 'client' ? 'khách hàng' : cur === 'admin' ? 'admin' : cur === 'agent' ? 'AI Agent' : `chuyên viên ${db.staff.find((m) => m.id === cur)?.name ?? ''}`
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex items-center gap-2 w-full rounded-r text-[13px] text-ink-2 hover:bg-hover ${compact ? 'size-11 justify-center' : 'min-h-8 px-2 mb-2'}`}>
        <Icon name="split" />{!compact && <>Xem như {curLabel}<Icon name="down" size={14} className="ml-auto" /></>}
      </button>
      {open && (
        <div className={`absolute z-50 w-64 bg-white border border-line rounded-r2 p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/.2)] ${compact ? 'right-0 top-12' : 'bottom-10 left-0'}`} onMouseLeave={() => setOpen(false)}>
          <p className="text-xs text-ink-3 px-2 pt-1.5 pb-1">Vai trò (prototype)</p>
          {roles.map((r) => {
            const on = r.id === cur
            return <button key={r.id} type="button" onClick={() => { r.go(); setOpen(false) }} className={`flex w-full items-center gap-2 min-h-9 px-2 rounded-r text-[13px] hover:bg-soft ${on ? 'font-medium' : ''}`}><Icon name={r.icon} size={14} /> {r.label}{on && <Icon name="check" size={14} className="ml-auto text-accent" />}</button>
          })}
          <p className="text-xs text-ink-3 px-2 pt-2.5 pb-1 border-t border-line mt-1.5">Dữ liệu</p>
          <button type="button" onClick={() => { reset(false); setOpen(false) }} className="flex w-full items-center gap-2 min-h-9 px-2 rounded-r text-[13px] hover:bg-soft">Nạp lại dữ liệu mẫu</button>
          <button type="button" onClick={() => { reset(true); setOpen(false); navigate('/dang-nhap') }} className="flex w-full items-center gap-2 min-h-9 px-2 rounded-r text-[13px] hover:bg-soft">Bắt đầu như khách mới</button>
        </div>
      )}
    </div>
  )
}

function Bell({ admin }: { admin: boolean }) {
  const { db, readNotifs } = useStore()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = db.notifs.filter((n) => (admin ? n.forAdmin : !n.forAdmin && n.customer === db.me)).slice(0, 8)
  const unread = list.filter((n) => !n.read).length
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    addEventListener('mousedown', on)
    return () => removeEventListener('mousedown', on)
  }, [open])
  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => { setOpen((o) => !o); if (unread) readNotifs(admin) }} aria-label={unread ? `Thông báo, ${unread} tin mới` : 'Thông báo'} aria-expanded={open} className="relative size-[34px] max-md:size-11 grid place-items-center rounded-r text-ink-2 hover:bg-soft">
        <Icon name="bell" />{unread > 0 && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-24px)] bg-white border border-line rounded-r2 shadow-[0_12px_32px_-12px_rgb(0_0_0/.2)] z-50 enter">
          <p className="px-4 py-3 border-b border-line text-sm font-medium">Thông báo</p>
          {list.length === 0 ? <p className="p-4 text-[13px] text-ink-3">Chưa có thông báo.</p> : (
            <ul className="max-h-96 overflow-auto">
              {list.map((n) => (
                <li key={n.id}><a href={n.href} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-2.5 hover:bg-side border-t border-line first:border-t-0">
                  <span className={`size-1.5 rounded-full mt-2 flex-none ${n.read ? 'bg-transparent' : 'bg-accent'}`} />
                  <span className="text-[13px] flex-1">{n.text}<span className="block text-xs text-ink-3">{when(n.t)}</span></span>
                </a></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Search({ admin }: { admin: boolean }) {
  const { db } = useStore()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); input.current?.focus() } }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [])
  const term = q.trim().toLowerCase()
  const hits = term ? [
    ...db.orders.filter((o) => admin || o.customer === db.me).filter((o) => (o.code + o.brand + o.service).toLowerCase().includes(term)).map((o) => ({ k: o.code, label: `${o.code} · ${o.brand}`, href: admin ? `#/admin/viec/${o.code}` : `#/app/don-hang/${o.code}` })),
    ...(admin ? db.customers.filter((c) => (c.name + c.contact).toLowerCase().includes(term)).map((c) => ({ k: c.id, label: `Khách · ${c.name}`, href: `#/admin/khach-hang/${c.id}` })) : db.quotes.filter((x) => x.customer === db.me).filter((x) => (x.code + x.brand).toLowerCase().includes(term)).map((x) => ({ k: x.code, label: `${x.code} · Báo giá ${x.brand}`, href: `#/app/bao-gia/${x.code}` }))),
  ].slice(0, 6) : []
  return (
    <div className="relative flex-1 max-w-[380px]">
      <label className="flex items-center gap-2 h-[34px] max-md:h-11 pl-2.5 pr-2 border border-line rounded-r text-ink-3 focus-within:border-[#d4d4d4]">
        <Icon name="search" />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} type="search" placeholder="Tìm mã đơn, báo giá…" aria-label="Tìm kiếm" className="flex-1 min-w-0 outline-none bg-transparent text-[13px] text-ink placeholder:text-ink-3" />
        <kbd className="font-mono text-xs px-1.5 rounded border border-line max-sm:hidden">⌘K</kbd>
      </label>
      {focus && term && (
        <ul className="absolute left-0 right-0 top-10 bg-white border border-line rounded-r2 p-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/.2)] z-50">
          {hits.length === 0 ? <li className="px-3 py-2 text-[13px] text-ink-3">Không có kết quả cho “{q}”</li> : hits.map((h) => (
            <li key={h.k}><a href={h.href} onClick={() => setQ('')} className="block px-3 py-2 rounded-r text-[13px] hover:bg-soft">{h.label}</a></li>
          ))}
        </ul>
      )}
    </div>
  )
}
