import { TIERS, type AgentCfg } from '../../lib/agents'
import { findService } from '../../lib/catalog'
import { adminLabel, useStore, type DB, type Order } from '../../store'
import { AIBadge, Avatar, Bar, Page, PageHead, vnd, when } from '../../ui'

/** Lớp AI Agent: mỗi agent đang làm gì, trên runtime nào, tốn bao nhiêu, chờ ai. Cập nhật trực tiếp theo tick. */
export default function AgentLive() {
  const { db } = useStore()
  const feed = db.orders.flatMap((o) => o.events.filter((e) => e.actor !== 'client' && e.actor !== 'owner').map((e) => ({ ...e, code: o.code }))).sort((a, b) => b.t - a.t).slice(0, 14)
  const busy = db.agents.filter((a) => tasksOf(db, a).length > 0).length
  return (
    <Page max={1280}>
      <PageHead title={<span className="inline-flex items-center gap-2">Trung tâm agent <AIBadge /></span>} sub={`${busy}/${db.agents.filter((a) => a.enabled).length} agent đang làm việc · cập nhật trực tiếp`} />
      <ul className="grid grid-cols-2 max-lg:grid-cols-1 gap-3">
        {db.agents.map((a) => <AgentCard key={a.id} a={a} db={db} />)}
      </ul>
      <section className="grid gap-2">
        <h2 className="text-sm">Hoạt động của agent</h2>
        <ol className="border border-line rounded-r2 divide-y divide-line">
          {feed.map((e) => (
            <li key={e.id} className="grid grid-cols-[72px_28px_1fr] gap-2.5 items-center px-4 py-2 text-[13px]">
              <time className="font-mono text-xs text-ink-3">{when(e.t)}</time>
              {e.actor === 'system' ? <Avatar size={22} /> : <Avatar id={e.actor} size={22} />}
              <a href={`#/admin/viec/${e.code}`} className="text-ink-2 hover:text-ink">{e.text} <span className="font-mono text-xs text-ink-3">{e.code}</span>{e.internal && <span className="text-xs text-ink-3"> · nội bộ</span>}</a>
            </li>
          ))}
        </ol>
      </section>
    </Page>
  )
}

type Task = { key: string; title: string; sub: string; pct?: number; href: string }
export function tasksOf(db: DB, a: AgentCfg): Task[] {
  const ord = (o: Order, sub: string, pct?: number): Task => ({ key: o.code, title: `${o.code} · ${findService(o.service)?.short ?? o.service} ${o.brand}`, sub, pct, href: `#/admin/viec/${o.code}` })
  const act = db.orders.filter((o) => o.status === 'active')
  switch (a.id) {
    case 'intake': return db.threads.filter((t) => !t.takeover && t.messages.length > 0 && (t.handoff || t.unread > 0 || Date.now() - (t.messages.at(-1)?.t ?? 0) < 6 * 3600_000)).map((t) => ({ key: t.id, title: `Chat với ${db.customers.find((c) => c.id === t.customer)?.name}`, sub: t.handoff ? 'Đã chuyển chuyên viên' : t.intake.service ? `Đang lấy brief · ${findService(t.intake.service)?.short}` : 'Đang tư vấn', href: `#/admin/hop-thu/${t.id}` }))
    case 'orchestrator': return act.filter((o) => o.plan?.status === 'pending' || ['queued', 'offered', 'assigned'].includes(o.job)).map((o) => ord(o, o.plan?.status === 'pending' ? 'Đã lập kế hoạch, chờ chuyên viên duyệt' : 'Đang chọn agent và giao việc'))
    case 'research': return act.filter((o) => o.service === 'landing' && o.job === 'running' && o.progress < 25).map((o) => ord(o, 'Research đối thủ và từ khóa', o.progress * 4))
    case 'lan': return act.filter((o) => ['submitted', 'qc_review'].includes(o.job)).map((o) => ord(o, `Kiểm tra bản v${o.version}`))
    case 'sales': return db.sales.filter((s) => s.status === 'live').map((s) => ({ key: s.customer, title: `Bán hàng cho ${db.customers.find((c) => c.id === s.customer)?.name}`, sub: `${s.conv.toLocaleString('vi-VN')} hội thoại · ${s.leads.filter((l) => l.status === 'new').length} lead mới`, href: '#/admin/agent-khach' }))
    default: return act.filter((o) => findService(o.service)?.agent === a.id && ['running', 'revision_requested', 'input_required'].includes(o.job)).map((o) => ord(o, o.job === 'input_required' ? 'Chờ khách trả lời câu hỏi' : db.actions.some((r) => r.orderCode === o.code && r.status === 'pending') ? 'Đang chờ chuyên viên cho phép' : o.capHit ? 'Dừng: chạm trần chi phí job' : `${adminLabel(o.job)} · bản v${o.version + 1}`, o.progress))
  }
}

function AgentCard({ a, db }: { a: AgentCfg; db: DB }) {
  const rt = db.runtimes.find((r) => r.id === a.runtime)
  const tasks = tasksOf(db, a)
  const blocked = !a.enabled ? 'Đã tắt' : rt?.status !== 'connected' ? 'Runtime đang dừng' : a.spentToday >= a.capDay ? 'Chạm trần chi phí ngày' : ''
  const pct = Math.min(100, (a.spentToday / a.capDay) * 100)
  return (
    <li className={`border rounded-r2 p-4 grid gap-3 content-start ${blocked ? 'border-red-200' : 'border-line'}`}>
      <div className="flex items-center gap-2.5">
        {['mai', 'khoa', 'minh', 'lan'].includes(a.id) ? <Avatar id={a.id} size={30} /> : <Avatar size={30} />}
        <div className="min-w-0"><h3 className="text-sm">{a.name}</h3><p className="text-xs text-ink-3 truncate">{a.role}</p></div>
        <span className="ml-auto text-xs whitespace-nowrap inline-flex items-center gap-1.5">{blocked ? <><span className="size-1.5 rounded-full bg-red-500" />{blocked}</> : tasks.length ? <><span className="size-1.5 rounded-full bg-ok live" />Đang làm {tasks.length}</> : <><span className="size-1.5 rounded-full bg-idle" />Rảnh</>}</span>
      </div>
      <p className="text-xs text-ink-3">{rt?.name} · {TIERS[a.tier].label} ({TIERS[a.tier].models[0]}) · {a.customerFacing ? 'gặp khách, sandbox' : 'nội bộ'}</p>
      {tasks.length > 0 && (
        <ul className="grid gap-2">{tasks.slice(0, 3).map((t) => (
          <li key={t.key}><a href={t.href} className="grid gap-1 text-[13px] hover:text-accent"><span className="flex gap-2"><b className="font-medium truncate">{t.title}</b>{t.pct != null && <span className="ml-auto font-mono text-xs text-ink-3">{Math.round(t.pct)}%</span>}</span><span className="text-xs text-ink-3">{t.sub}</span>{t.pct != null && <Bar pct={t.pct} />}</a></li>
        ))}{tasks.length > 3 && <li className="text-xs text-ink-3">+{tasks.length - 3} việc khác</li>}</ul>
      )}
      <div className="grid gap-1"><div className="h-1 bg-hover rounded-sm overflow-hidden"><i className={`block h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div><span className="text-xs text-ink-3 font-mono">Hôm nay {vnd(a.spentToday)} / {vnd(a.capDay)}</span></div>
    </li>
  )
}
