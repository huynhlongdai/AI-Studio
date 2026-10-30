import { useState } from 'react'
import { TIERS, type AgentCfg } from '../lib/agents'
import { findService } from '../lib/catalog'
import { navigate } from '../router'
import { useStore, type DB } from '../store'
import { Avatar, Bar, Icon, day, vnd, when } from '../ui'
import { tasksOf } from './admin/AgentLive'
import { adapterFor } from '../lib/runtime'

/** Góc nhìn của chính agent: nhận gì, được làm gì, đã làm gì. Giao diện runtime, không phải màn cho người vận hành. */
export default function AgentConsole({ id }: { id?: string }) {
  const { db } = useStore()
  const a = db.agents.find((x) => x.id === id) ?? db.agents.find((x) => x.id === 'mai')!
  return (
    <div className="min-h-dvh grid grid-cols-[240px_minmax(0,1fr)] max-md:grid-cols-1 bg-white">
      <aside className="bg-ink text-white/80 p-3 flex flex-col gap-1 max-md:hidden sticky top-0 h-dvh">
        <div className="flex items-center gap-2 px-2 pb-3 pt-1"><span className="size-6 rounded-r bg-accent text-white grid place-items-center"><Icon name="spark" size={14} /></span><div><p className="text-sm font-medium text-white leading-tight">Agent runtime</p><p className="text-xs text-white/50 font-mono">góc nhìn agent</p></div></div>
        {db.agents.map((x) => {
          const n = tasksOf(db, x).length
          return <a key={x.id} href={`#/agent/${x.id}`} className={`flex items-center gap-2 min-h-9 px-2 rounded-r text-[13px] ${x.id === a.id ? 'bg-white/10 text-white' : 'hover:bg-white/5'}`}><span className={`size-1.5 rounded-full ${!x.enabled ? 'bg-white/30' : n ? 'bg-ok' : 'bg-white/40'}`} />{x.name}{n > 0 && <span className="ml-auto font-mono text-xs text-white/50">{n}</span>}</a>
        })}
        <div className="flex-1" />
        <button type="button" onClick={() => navigate(db.session.staff === 'admin' ? '/admin' : '/admin/trung-tam-agent')} className="text-left text-[13px] text-white/60 hover:text-white min-h-9 px-2">← Về cổng studio</button>
      </aside>
      <main className="min-w-0">
        <div className="md:hidden flex gap-1 overflow-x-auto p-2 border-b border-line no-scrollbar">{db.agents.map((x) => <a key={x.id} href={`#/agent/${x.id}`} className={`whitespace-nowrap text-[13px] px-2.5 min-h-9 inline-flex items-center rounded-r ${x.id === a.id ? 'bg-ink text-white' : 'text-ink-2'}`}>{x.name}</a>)}</div>
        <Detail a={a} db={db} />
      </main>
    </div>
  )
}

function Detail({ a, db }: { a: AgentCfg; db: DB }) {
  const [tab, setTab] = useState<'queue' | 'log' | 'perm'>('queue')
  const rt = db.runtimes.find((r) => r.id === a.runtime)
  const tasks = tasksOf(db, a)
  const blocked = !a.enabled ? 'Agent đã bị tắt bởi admin' : rt?.status !== 'connected' ? `Runtime ${rt?.name} đang dừng — mọi tool call bị từ chối` : a.spentToday >= a.capDay ? 'Đã chạm trần chi phí ngày — đang chờ admin' : ''
  return (
    <div className="max-w-[1000px] mx-auto px-6 max-md:px-4 py-6 grid gap-5">
      <header className="flex items-start gap-3">
        {['mai', 'khoa', 'minh', 'lan'].includes(a.id) ? <Avatar id={a.id} size={40} /> : <Avatar size={40} />}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl">{a.name}</h1>
          <p className="text-[13px] text-ink-3">{a.role}</p>
          <p className="font-mono text-xs text-ink-3 mt-1">agent://{a.id} · {rt?.name}{rt && ` (${adapterFor(rt).discover(rt.endpoint).protocol.toUpperCase()})`} · {TIERS[a.tier].models[0]} ({TIERS[a.tier].label}){a.autoEscalate && ' · auto-escalate'}</p>
        </div>
      </header>
      {blocked && <p className="text-[13px] bg-red-50 text-red-700 rounded-r2 px-4 py-2.5 font-mono">{blocked}</p>}
      <div className="flex gap-1 border-b border-line">
        {([['queue', `Hàng đợi (${tasks.length})`], ['log', 'Nhật ký chạy'], ['perm', 'Quyền & giới hạn']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-9 px-3 text-[13px] -mb-px border-b-2 ${tab === k ? 'border-ink text-ink font-medium' : 'border-transparent text-ink-3'}`}>{l}</button>)}
      </div>
      {tab === 'queue' && <Queue a={a} db={db} />}
      {tab === 'log' && <Log a={a} db={db} />}
      {tab === 'perm' && <Perm a={a} db={db} />}
    </div>
  )
}

/** Việc agent nhận: brief đã ẩn danh tính khách (không tên người liên hệ, SĐT, email). */
function Queue({ a, db }: { a: AgentCfg; db: DB }) {
  const { retryRun, hold, resume } = useStore()
  const tasks = tasksOf(db, a)
  if (!tasks.length) return <p className="text-[13px] text-ink-3 font-mono">idle · đang chờ việc từ agent điều phối</p>
  return (
    <ul className="grid gap-3">
      {tasks.map((t) => {
        const o = db.orders.find((x) => x.code === t.key)
        const step = o?.plan?.steps.find((s) => s.agent === a.id)
        return (
          <li key={t.key} className="border border-line rounded-r2 p-4 grid gap-2.5">
            <div className="flex items-baseline gap-2"><b className="text-sm">{t.title}</b>{t.pct != null && <span className="ml-auto font-mono text-xs">{Math.round(t.pct)}%</span>}</div>
            {t.pct != null && <Bar pct={t.pct} />}
            {o ? (
              <pre className="font-mono text-xs bg-soft rounded-r p-3 whitespace-pre-wrap leading-relaxed">{JSON.stringify({
                task: o.code, service: findService(o.service)?.name, brand: o.brand, style: o.style,
                customer: `tenant_${o.customer.slice(0, 3)}*** (đã ẩn danh)`, version: o.version + 1, revision_note: o.revisions.at(-1)?.note ?? null,
                deadline: day(o.dueAt), cost_cap: vnd(a.capJob), plan_step: step?.title ?? null, return_to: a.id === 'lan' ? 'chuyên viên duyệt' : 'lan (QC)',
              }, null, 2)}</pre>
            ) : <p className="text-[13px] text-ink-2">{t.sub}</p>}
            {o && <p className="text-xs text-ink-3">{t.sub}</p>}
            {o && o.status === 'active' && <div className="flex gap-2">{o.job === 'running' && <><button type="button" onClick={() => retryRun(o.code)} className="text-[13px] border border-line rounded-r px-2.5 min-h-8 hover:bg-soft">Chạy lại bước</button><button type="button" onClick={() => hold(o.code)} className="text-[13px] border border-line rounded-r px-2.5 min-h-8 hover:bg-soft">Tạm dừng</button></>}{o.job === 'on_hold' && <button type="button" onClick={() => resume(o.code)} className="text-[13px] border border-line rounded-r px-2.5 min-h-8 hover:bg-soft">Tiếp tục</button>}<a href={`#/admin/viec/${o.code}`} className="text-[13px] text-accent ml-auto min-h-8 inline-flex items-center">Mở trong bảng việc</a></div>}
          </li>
        )
      })}
    </ul>
  )
}

function Log({ a, db }: { a: AgentCfg; db: DB }) {
  const mine = db.orders.flatMap((o) => o.events.filter((e) => e.actor === a.id || (a.id === 'orchestrator' && e.actor === 'system')).map((e) => ({ ...e, code: o.code }))).sort((x, y) => y.t - x.t).slice(0, 30)
  const tool = (i: number) => a.tools[i % Math.max(1, a.tools.length)] ?? 'model.generate'
  if (!mine.length) return <p className="text-[13px] text-ink-3 font-mono">Chưa có lần chạy nào.</p>
  return (
    <ol className="font-mono text-xs border border-line rounded-r2 divide-y divide-line">
      {mine.map((e, i) => (
        <li key={e.id} className="grid grid-cols-[86px_1fr] gap-3 px-3 py-2">
          <time className="text-ink-3">{when(e.t)}</time>
          <span><span className="text-ink-3">{e.code}</span> {e.text}{e.actor !== 'system' && <span className="block text-ink-3">→ {tool(i)}() ok · {TIERS[a.tier].models[0]}</span>}</span>
        </li>
      ))}
    </ol>
  )
}

function Perm({ a, db }: { a: AgentCfg; db: DB }) {
  const rt = db.runtimes.find((r) => r.id === a.runtime)
  const denied = (rt?.tools ?? []).filter((t) => !a.tools.includes(t))
  const scope = { brief: 'Chỉ brief đã ẩn danh', brief_profile: 'Brief + hồ sơ khách', workspace: 'Kho kiến thức của đúng một khách' }[a.data]
  return (
    <div className="grid gap-4 text-[13px]">
      <section className="grid gap-1.5"><h2 className="text-sm">Tool được gọi</h2><div className="flex flex-wrap gap-1.5">{a.tools.map((t) => <span key={t} className="font-mono text-xs border border-ok/40 text-ink rounded px-2 py-1">✓ {t}</span>)}{denied.map((t) => <span key={t} className="font-mono text-xs border border-line text-ink-3 rounded px-2 py-1 line-through">{t}</span>)}</div></section>
      <section className="grid gap-1"><h2 className="text-sm">Dữ liệu được đọc</h2><p className="text-ink-2">{scope}{a.customerFacing && ' · chạy trong sandbox, không chạm tool sản xuất'}</p></section>
      <section className="grid gap-1"><h2 className="text-sm">Phải xin người duyệt trước khi</h2>{a.approval.length ? <ul className="list-disc pl-5 text-ink-2">{a.approval.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-ink-3">Không có hành động rủi ro nào được cấp.</p>}</section>
      <section className="grid gap-1"><h2 className="text-sm">Ngân sách</h2><p className="font-mono text-xs">mỗi job ≤ {vnd(a.capJob)} · hôm nay {vnd(a.spentToday)} / {vnd(a.capDay)}</p></section>
      <p className="text-xs text-ink-3">Agent không tự đặt giá, không tự gửi bài cho khách: mọi bản giao đi qua QC (Lan) và chuyên viên. Cấu hình do admin thay đổi ở Runtime & agent.</p>
    </div>
  )
}
