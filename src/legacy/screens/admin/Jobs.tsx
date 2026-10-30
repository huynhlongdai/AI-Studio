import { useState } from 'react'
import { findService, personas } from '../../lib/catalog'
import { canTransition } from '../../lib/job-machine'
import { navigate } from '../../router'
import { adminLabel, canStaff, customerName, jobCap, providerName, useStore, type Order } from '../../store'
import { TIERS } from '../../lib/agents'
import { ReviewThreads } from '../../components/ReviewThreads'
import { Avatar, Btn, Icon, Modal, Page, PageHead, day, left, vnd, when } from '../../ui'
import { permissionsFor } from '@/lib/staffPermissions'

const COLS: { name: string; note: string; states: string[]; tone: string }[] = [
  { name: 'Tiếp nhận', note: 'Cọc & xếp hàng', states: ['_deposit', 'queued', 'offered', 'assigned'], tone: 'bg-idle' },
  { name: 'Sản xuất', note: 'Agent đang thực hiện', states: ['running', 'revision_requested', 'input_required', 'on_hold'], tone: 'bg-accent' },
  { name: 'Kiểm tra', note: 'QC & chuyên viên duyệt', states: ['submitted', 'qc_review', 'pending_approval'], tone: 'bg-warn' },
  { name: 'Khách duyệt', note: 'Phản hồi & thanh toán', states: ['client_review', '_final'], tone: 'bg-accent' },
  { name: 'Hoàn tất', note: 'Đã chốt & bàn giao', states: ['accepted', 'completed'], tone: 'bg-ok' },
]
const colOf = (o: Order) => o.status === 'awaiting_deposit' ? '_deposit' : o.status === 'awaiting_final' ? '_final' : o.job
type Filter = 'all' | 'attention' | 'late' | 'mine'
const needsAttention = (o: Order, now: number) => o.dueAt < now || o.capHit || ['input_required', 'on_hold', 'pending_approval', 'client_review'].includes(o.job) || o.status === 'awaiting_final'
const priority = (o: Order, now: number) => (o.dueAt < now ? -10_000_000_000 : 0) + (o.capHit ? -5_000_000_000 : 0) + (['input_required', 'pending_approval'].includes(o.job) ? -2_000_000_000 : 0) + o.dueAt

export default function Jobs({ selected }: { selected?: string }) {
  const { db } = useStore()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filter, setFilter] = useState<Filter>('all')
  const now = Date.now()
  const active = db.orders.filter((o) => o.status !== 'canceled')
  const late = active.filter((o) => o.dueAt < now && !['accepted', 'completed'].includes(o.job))
  const attention = active.filter((o) => needsAttention(o, now) && !['accepted', 'completed'].includes(o.job))
  const orders = active.filter((o) => filter === 'all' || filter === 'attention' && needsAttention(o, now) || filter === 'late' && late.includes(o) || filter === 'mine' && o.reviewer === db.session.member)
  const sel = db.orders.find((o) => o.code === selected)
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Tất cả', count: active.length },
    { id: 'attention', label: 'Cần xử lý', count: attention.length },
    { id: 'late', label: 'Quá hạn', count: late.length },
    { id: 'mine', label: 'Của tôi', count: active.filter((o) => o.reviewer === db.session.member).length },
  ]
  return (
    <Page max={1600}>
      <PageHead title="Bảng việc" sub="Theo dõi toàn bộ tiến độ sản xuất và điểm nghẽn của studio" end={
        <div role="group" className="flex p-0.5 gap-0.5 border border-line rounded-r bg-side">
          {(['board', 'list'] as const).map((v) => <Btn key={v} size="s" kind="plain" aria-pressed={view === v} onClick={() => setView(v)} className={view === v ? 'bg-white text-ink' : 'text-ink-3'}><Icon name={v === 'board' ? 'grid' : 'file'} size={14} />{v === 'board' ? 'Kanban' : 'Danh sách'}</Btn>)}
        </div>} />
      <dl className="grid grid-cols-4 max-lg:grid-cols-2 border border-line rounded-r2 overflow-hidden divide-x divide-line max-lg:divide-x-0 max-lg:[&>div:nth-child(odd)]:border-r max-lg:[&>div:nth-child(-n+2)]:border-b [&>div]:border-line">
        <div className="p-4 grid gap-1 bg-white"><dt className="text-xs text-ink-3">Đang vận hành</dt><dd className="text-2xl font-medium tabular-nums">{active.filter((o) => !['accepted', 'completed'].includes(o.job)).length}</dd><dd className="text-xs text-ink-3">trên {active.length} việc đang mở</dd></div>
        <div className="p-4 grid gap-1 bg-white"><dt className="text-xs text-ink-3">Cần xử lý</dt><dd className={`text-2xl font-medium tabular-nums ${attention.length ? 'text-accent' : ''}`}>{attention.length}</dd><dd className="text-xs text-ink-3">cần người thật can thiệp</dd></div>
        <div className="p-4 grid gap-1 bg-white"><dt className="text-xs text-ink-3">Quá hạn</dt><dd className={`text-2xl font-medium tabular-nums ${late.length ? 'text-warn' : ''}`}>{late.length}</dd><dd className="text-xs text-ink-3">{late.length ? 'ưu tiên xử lý ngay' : 'mọi việc đúng tiến độ'}</dd></div>
        <div className="p-4 grid gap-1 bg-white"><dt className="text-xs text-ink-3">Giá trị đang chạy</dt><dd className="text-2xl font-medium tabular-nums">{vnd(active.filter((o) => !['accepted', 'completed'].includes(o.job)).reduce((sum, o) => sum + o.price.total, 0))}</dd><dd className="text-xs text-ink-3">tổng giá trị đơn chưa hoàn tất</dd></div>
      </dl>
      {view === 'board' ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-3 mr-1">Lọc nhanh</span>
            {filters.map((item) => <Btn key={item.id} size="s" kind={filter === item.id ? 'primary' : 'ghost'} onClick={() => setFilter(item.id)}>{item.label}<span className={filter === item.id ? 'text-white/70 tabular-nums' : 'text-ink-3 tabular-nums'}>{item.count}</span></Btn>)}
            {filter !== 'all' && <span className="ml-auto text-xs text-ink-3">Đang hiện {orders.length}/{active.length} việc</span>}
          </div>
          <div className="grid grid-cols-5 max-xl:grid-cols-none max-xl:grid-flow-col max-xl:auto-cols-64 gap-3 overflow-x-auto pb-3 items-start">
          {COLS.map(({ name, note, states, tone }) => {
            const list = orders.filter((o) => states.includes(colOf(o))).sort((a, b) => priority(a, now) - priority(b, now))
            return (
              <section key={name} className="bg-side border border-line rounded-r2 p-2 grid gap-2 content-start min-h-64">
                <div className="px-1.5 pt-1 pb-1 flex items-start gap-2">
                  <span className={`mt-1.5 size-2 rounded-full ${tone}`} />
                  <div className="min-w-0"><p className="text-[13px] font-medium">{name}</p><p className="text-xs text-ink-3 truncate">{note}</p></div>
                  <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-white border border-line grid place-items-center text-xs tabular-nums">{list.length}</span>
                </div>
                {list.length ? list.map((o) => <Card key={o.code} o={o} now={now} />) : <div className="border border-dashed border-line rounded-r2 p-3 text-xs text-ink-3 text-center">Không có việc</div>}
              </section>
            )
          })}
          </div>
        </div>
      ) : (
        <table className="w-full text-[13px] border-collapse">
          <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:py-2 [&>th]:pr-3"><th>Mã</th><th>Dịch vụ</th><th>Agent</th><th>Trạng thái nội bộ</th><th className="text-right">Giá trị</th><th className="text-right">Đã thu</th></tr></thead>
          <tbody>{db.orders.map((o) => (
            <tr key={o.code} onClick={() => navigate(`/admin/viec/${o.code}`)} className="border-b border-line hover:bg-side cursor-pointer [&>td]:py-2.5 [&>td]:pr-3">
              <td className="font-mono text-xs">{o.code}</td><td>{findService(o.service)!.name} · {o.brand}</td><td>{personas[findService(o.service)!.agent].name}</td>
              <td>{o.status === 'awaiting_deposit' ? 'Chờ cọc' : o.status === 'canceled' ? 'Đã hủy' : adminLabel(o.job)}</td><td className="text-right tabular-nums">{vnd(o.price.total)}</td><td className="text-right tabular-nums">{vnd(o.paid)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {sel && <Detail o={sel} />}
    </Page>
  )
}

function Card({ o, now }: { o: Order; now: number }) {
  const svc = findService(o.service)!
  const { db } = useStore()
  const overdue = o.dueAt < now && !['accepted', 'completed'].includes(o.job)
  const attention = needsAttention(o, now) && !['accepted', 'completed'].includes(o.job)
  const reviewer = db.staff.find((m) => m.id === o.reviewer)
  const status = o.status === 'awaiting_deposit' ? 'Chờ cọc' : o.status === 'awaiting_final' ? 'Chờ thanh toán' : adminLabel(o.job)
  return (
    <Btn kind="ghost" onClick={() => navigate(`/admin/viec/${o.code}`)} className={`enter !h-auto !w-full !p-3 !grid !gap-2 !items-stretch !justify-stretch !whitespace-normal !text-left bg-white hover:border-ink-3 ${attention ? 'border-warn/40' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-3">{o.code}</span>
        {attention && <span className={`ml-auto inline-flex items-center gap-1 text-[11px] ${overdue ? 'text-warn' : 'text-accent'}`}><span className={`size-1.5 rounded-full ${overdue ? 'bg-warn' : 'bg-accent'}`} />{overdue ? 'Quá hạn' : 'Cần xử lý'}</span>}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-snug truncate">{o.brand}</p>
        <p className="text-xs text-ink-3 truncate">{svc.short} · {customerName(db, o.customer)}</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="px-1.5 py-0.5 rounded bg-soft text-ink-2 truncate">{status}</span>
        <span className={`ml-auto inline-flex items-center gap-1 tabular-nums ${overdue ? 'text-warn font-medium' : 'text-ink-3'}`}><Icon name="clock" size={12} />{overdue ? left(o.dueAt - now) : day(o.dueAt)}</span>
      </div>
      {['running', 'revision_requested'].includes(o.job) && <div className="grid gap-1"><div className="flex text-[11px] text-ink-3"><span>Tiến độ agent</span><span className="ml-auto tabular-nums">{o.progress}%</span></div><div className="h-1 rounded-sm bg-hover overflow-hidden"><i className="block h-full bg-accent transition-[width] duration-700" style={{ width: `${o.progress}%` }} /></div></div>}
      <div className="pt-2 border-t border-line flex items-center gap-2">
        <Avatar id={svc.agent} size={20} />
        <span className="text-xs text-ink-3 truncate">{reviewer?.name ?? personas[svc.agent].name}</span>
        <span className="ml-auto font-mono text-xs tabular-nums">{vnd(o.price.total)}</span>
      </div>
    </Btn>
  )
}

function Detail({ o }: { o: Order }) {
  const { db } = useStore()
  const { hold, resume, cancelOrder, grantRevision, extendDue } = useStore()
  const [cancel, setCancel] = useState(false)
  const svc = findService(o.service)!
  const close = () => navigate('/admin/viec')
  const canCancel = o.status === 'awaiting_deposit' || canTransition(o.job, 'cancel')
  return (
    <div className="fixed inset-0 z-[80] bg-ink/30" onClick={close}>
      <aside onClick={(e) => e.stopPropagation()} className="enter absolute right-0 top-0 h-full w-[460px] max-w-full bg-white border-l border-line overflow-auto p-5 grid gap-5 content-start" aria-label={`Chi tiết ${o.code}`}>
        <div className="flex items-start gap-2">
          <div><p className="font-mono text-xs text-ink-3">{o.code}</p><h2 className="text-base">{svc.name} · {o.brand}</h2><p className="text-[13px] text-ink-2">Trạng thái nội bộ: <b>{o.status === 'awaiting_deposit' ? 'Chờ cọc' : adminLabel(o.job)}</b></p></div>
          <button type="button" onClick={close} aria-label="Đóng" className="ml-auto size-10 grid place-items-center rounded-r hover:bg-soft text-ink-3"><Icon name="x" /></button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {o.job === 'pending_approval' && <Btn kind="primary" onClick={() => navigate(`/admin/duyet/${o.code}`)}>Mở để duyệt</Btn>}
          {canTransition(o.job, 'hold') && o.status === 'active' && <Btn onClick={() => hold(o.code)}>Tạm dừng</Btn>}
          {o.job === 'on_hold' && <Btn kind="primary" onClick={() => resume(o.code)}>Tiếp tục</Btn>}
          {o.status !== 'canceled' && o.status !== 'completed' && <>{canStaff(db, 'work.cancel') && <Btn onClick={() => grantRevision(o.code)}>Tặng 1 lượt sửa</Btn>}{canStaff(db, 'work.manage') && <Btn onClick={() => extendDue(o.code, 1)}>Gia hạn +1 ngày</Btn>}</>}
          <Btn kind="plain" onClick={() => navigate(`/admin/khach-hang/${o.customer}`)}>Hồ sơ khách</Btn>
          {canCancel && canStaff(db, 'work.cancel') && o.status !== 'canceled' && <Btn onClick={() => setCancel(true)}>Hủy việc</Btn>}
        </div>
        <dl className="grid grid-cols-2 gap-px bg-line border border-line rounded-r2 overflow-hidden text-[13px]">
          {[['Khách', customerName(db, o.customer)], ['Hạn giao', day(o.dueAt)], ['Giá trị', vnd(o.price.total)], ['Đã thu', vnd(o.paid)], ['Agent', personas[svc.agent].name], ['Tiến độ chạy', `${o.progress}%`], ['Phiên bản', `v${o.version}`], ['Lượt sửa', `${o.revisionsUsed} / ${o.includedRevisions + o.extraRevisions}`]].map(([k, v]) => <div key={k} className="bg-white p-2.5"><dt className="text-xs text-ink-3">{k}</dt><dd className="tabular-nums">{v}</dd></div>)}
        </dl>
        {o.rejectNote && <p className="text-[13px] bg-warn/10 rounded-r2 px-3 py-2">Lần trả gần nhất: {o.rejectNote}</p>}
        <AgentPanel o={o} />
        <ReviewThreads o={o} role="owner" compact />
        <section>
          <h3 className="text-sm mb-2">Timeline nội bộ</h3>
          <ol className="grid gap-2.5">
            {o.events.slice().reverse().map((e) => (
              <li key={e.id} className="grid grid-cols-[86px_1fr] gap-2 text-[13px]">
                <time className="font-mono text-xs text-ink-3 pt-px">{when(e.t)}</time>
                <p className="text-ink-2">{e.internal && <span className="font-mono text-[11px] border border-line rounded px-1 mr-1.5 text-ink-3">nội bộ</span>}<b className="text-ink">{e.actor in personas ? personas[e.actor as keyof typeof personas].name : { owner: 'Chuyên viên', client: 'Khách', system: 'Hệ thống' }[e.actor as 'owner']}</b> · {e.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="grid gap-1.5"><h3 className="text-sm">Brief (JSON gửi worker)</h3>
          <pre className="font-mono text-xs bg-side border border-line rounded-r2 p-3 overflow-auto">{JSON.stringify({ service: o.service, brand: o.brand, brief: o.style, items: o.price.items.map((i) => i.label), due: new Date(o.dueAt).toISOString().slice(0, 10), revisions: o.revisions.map((r) => ({ v: r.version, notes: [...r.annots.map((a) => a.text), r.note].filter(Boolean) })) }, null, 2)}</pre>
        </section>
      </aside>
      {cancel && (
        <Modal title={`Hủy ${o.code}?`} onClose={() => setCancel(false)}>
          <p className="text-[13px] text-ink-2">{o.paid > 0 ? `Khách đã trả ${vnd(o.paid)} — cần ghi nhận hoàn tiền thủ công qua cổng thanh toán.` : 'Đơn chưa có thanh toán.'}</p>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setCancel(false)}>Giữ lại</Btn><Btn kind="primary" onClick={() => { cancelOrder(o.code, 'Studio hủy việc', 'owner'); setCancel(false) }}>Hủy việc</Btn></div>
        </Modal>
      )}
    </div>
  )
}

function AgentPanel({ o }: { o: Order }) {
  const { db, raiseCap, answerInput, reassign, outsource } = useStore()
  const [ans, setAns] = useState('')
  const [out, setOut] = useState(false)
  const [budget, setBudget] = useState(Math.round(o.price.total * 0.5))
  const [days, setDays] = useState(2)
  const svc = findService(o.service)!
  const cfg = db.agents.find((a) => a.id === svc.agent)
  const cap = jobCap(db, o), cost = o.agentCost ?? 0, pct = cap ? Math.min(100, (cost / cap) * 100) : 0
  const tier = o.tier ?? cfg?.tier ?? 'standard'
  const canManage = canStaff(db, 'work.manage')
  const canEmergency = canStaff(db, 'agents.emergency')
  const reviewers = db.staff.filter((m) => m.active && permissionsFor(m.role, m.permissions).includes('approvals.manage') && (m.role === 'admin' || m.skills.includes(o.service)))
  const offer = db.offers.find((x) => x.id === o.offerId)
  const planTotal = o.plan?.steps.reduce((s, x) => s + x.credit, 0) ?? 0
  return (
    <section className="grid gap-3 border border-line rounded-r2 p-3.5 text-[13px]">
      <h3 className="text-sm">Agent & chi phí</h3>
      <div className="grid gap-1"><div className="flex text-xs text-ink-3"><span>Chi phí agent · tầng {TIERS[tier].label}{o.tier && ' (đã tự nâng)'}</span><span className="ml-auto font-mono">{vnd(cost)} / {vnd(cap)}</span></div><div className="h-1.5 bg-hover rounded-sm overflow-hidden"><i className={`block h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div></div>
      {o.capHit && <div className="flex items-center gap-2 bg-red-50 rounded-r px-3 py-2"><span className="flex-1 text-red-700">Đã chạm trần chi phí job — agent đang dừng.</span>{canEmergency ? <Btn size="s" kind="primary" onClick={() => raiseCap(o.code)}>Nới trần +50%</Btn> : <span className="text-xs text-ink-3">Cần người có quyền nới trần</span>}</div>}
      {o.plan && <div className="grid gap-1"><p className="text-xs text-ink-3">Kế hoạch: ước tính {vnd(planTotal)} · thực tế {vnd(cost)}{planTotal ? ` (${Math.round((cost / planTotal) * 100)}%)` : ''}</p><ol className="grid gap-0.5">{o.plan.steps.map((st, i) => { const share = planTotal ? (st.credit / planTotal) * cost : 0; return <li key={st.id} className="flex gap-2 text-xs"><span className="font-mono text-ink-3 w-4">{i + 1}</span><span className="flex-1 truncate">{st.title}</span><span className="font-mono text-ink-3">{vnd(st.credit)} → {vnd(Math.round(share))}</span></li> })}</ol></div>}
      {o.job === 'input_required' && o.input && (
        <div className="grid gap-2 bg-soft rounded-r p-3"><p><b className="text-xs">Agent hỏi khách:</b> {o.input.q}</p><p className="text-xs text-ink-3">Gửi {when(o.input.t)} · chờ khách trả lời</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ans.trim()) { answerInput(o.code, ans.trim(), 'owner'); setAns('') } }}><input value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Trả lời thay khách (đã hỏi qua điện thoại…)" className="flex-1 h-8 px-2 border border-line rounded-r bg-white outline-none focus:border-accent" /><Btn size="s" type="submit">Gửi</Btn></form></div>
      )}
      <label className="flex items-center gap-2"><span className="text-ink-3 w-24">Người duyệt</span>
        {canManage ? <select value={o.reviewer ?? ''} onChange={(e) => reassign(o.code, e.target.value)} className="h-8 px-1.5 border border-line rounded-r flex-1"><option value="">Chưa giao</option>{reviewers.map((m) => <option key={m.id} value={m.id}>{m.name}{m.role === 'admin' ? ' (admin)' : ''}</option>)}</select> : <span>{db.staff.find((m) => m.id === o.reviewer)?.name ?? 'Chưa giao'}</span>}
      </label>
      {offer ? <p>Đang ở marketplace: <a href={`#/admin/doi-tac/${offer.id}`} className="text-accent">{offer.id}</a> · {offer.status === 'open' ? `${offer.bids.length} ứng tuyển` : providerName(db, offer.provider)}</p>
        : canManage && o.status === 'active' && ['queued', 'running', 'revision_requested'].includes(o.job) && (out ? (
          <div className="grid gap-2 border-t border-line pt-2.5"><div className="flex gap-2 items-center"><span className="text-ink-3">Ngân sách</span><input inputMode="numeric" value={budget.toLocaleString('vi-VN')} onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, '')) || 0)} className="h-8 w-32 px-2 border border-line rounded-r font-mono text-right" /><span className="text-ink-3">trong</span><input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} className="h-8 w-14 px-2 border border-line rounded-r font-mono" /><span className="text-ink-3">ngày</span></div>
            <p className="text-xs text-ink-3">Đơn được tạm giữ; brief gửi đi đã ẩn thông tin liên hệ khách. Biên lợi nhuận còn {vnd(o.price.total - budget)}.</p>
            <div className="flex gap-2"><Btn size="s" kind="primary" disabled={budget < 100_000 || budget >= o.price.total} onClick={() => { outsource(o.code, budget, days); setOut(false) }}>Đăng lên marketplace</Btn><Btn size="s" kind="plain" onClick={() => setOut(false)}>Hủy</Btn></div></div>
        ) : <div><Btn size="s" onClick={() => setOut(true)}>Chuyển cho đối tác</Btn></div>)}
    </section>
  )
}
