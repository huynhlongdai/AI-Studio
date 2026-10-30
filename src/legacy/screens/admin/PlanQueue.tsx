import { useState } from 'react'
import { TIERS, type PlanStep, type Tier } from '../../lib/agents'
import { findService } from '../../lib/catalog'
import { useStore, type Order } from '../../store'
import { AIBadge, Btn, vnd, when } from '../../ui'

/** Kế hoạch do agent điều phối lập cho việc phức tạp; chuyên viên chỉnh rồi duyệt trước khi giao việc. */
export default function PlanQueue({ mineOnly = false }: { mineOnly?: boolean }) {
  const { db } = useStore()
  const queue = db.orders.filter((o) => o.status === 'active' && o.plan?.status === 'pending' && (!mineOnly || o.reviewer === db.session.member))
  if (!queue.length) return null
  return (
    <section className="grid gap-3">
      <h2 className="text-sm inline-flex items-center gap-2">Kế hoạch chờ duyệt <span className="font-mono text-xs text-ink-3">{queue.length}</span></h2>
      {queue.map((o) => <PlanCard key={o.code} o={o} />)}
    </section>
  )
}

function PlanCard({ o }: { o: Order }) {
  const { approvePlan } = useStore()
  const [steps, setSteps] = useState<PlanStep[]>(o.plan!.steps)
  const [note, setNote] = useState('')
  const total = steps.reduce((s, x) => s + x.credit, 0)
  const set = (i: number, p: Partial<PlanStep>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...p } : s)))
  return (
    <article className="border border-accent/40 rounded-r2 p-4 grid gap-3">
      <header className="flex items-baseline gap-2 flex-wrap"><b className="text-sm">{o.code} · {o.brand}</b><span className="text-xs text-ink-3">{findService(o.service)?.name} · lập {when(o.plan!.createdAt)}</span><AIBadge /><span className="ml-auto font-mono text-xs">Ước tính {vnd(total)} · {Math.round((total / o.price.total) * 100)}% giá trị đơn</span></header>
      <ol className="grid gap-1.5">
        {steps.map((s, i) => (
          <li key={s.id} className="grid grid-cols-[24px_1fr_110px_120px_32px] max-md:grid-cols-[24px_1fr] gap-2 items-center text-[13px]">
            <span className="font-mono text-xs text-ink-3">{i + 1}</span>
            <input value={s.title} onChange={(e) => set(i, { title: e.target.value })} className="h-8 px-2 border border-line rounded-r outline-none focus:border-accent" />
            <select value={s.tier} onChange={(e) => set(i, { tier: e.target.value as Tier })} className="h-8 px-1.5 border border-line rounded-r max-md:col-start-2">{(Object.keys(TIERS) as Tier[]).map((t) => <option key={t} value={t}>{TIERS[t].label}</option>)}</select>
            <input inputMode="numeric" value={s.credit.toLocaleString('vi-VN')} onChange={(e) => set(i, { credit: Number(e.target.value.replace(/\D/g, '')) || 0 })} className="h-8 px-2 border border-line rounded-r font-mono text-right max-md:col-start-2" />
            <button type="button" aria-label="Bỏ bước" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="size-8 rounded-r text-ink-3 hover:bg-soft max-md:col-start-2">×</button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2 flex-wrap items-center">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho agent (không bắt buộc)" className="flex-1 min-w-60 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" />
        <Btn kind="primary" disabled={!steps.length} onClick={() => approvePlan(o.code, steps, note.trim())}>Duyệt & giao việc</Btn>
      </div>
    </article>
  )
}
