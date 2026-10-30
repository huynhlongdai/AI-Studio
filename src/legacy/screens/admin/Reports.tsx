import { useState } from 'react'
import { CATALOG } from '../../lib/catalog'
import { useStore } from '../../store'
import { Btn, Icon, Page, PageHead, vnd } from '../../ui'

// Tỷ lệ chi phí model ước tính theo dịch vụ (cùng giả định với Tổng quan).
const COST_PCT: Record<string, number> = { logo: 0.08, post: 0.07, video: 0.16, landing: 0.1 }

/** Báo cáo vận hành: chất lượng, đúng hạn, chi phí agent, agent bán hàng. */
export default function Reports() {
  const { db } = useStore()
  const [period, setPeriod] = useState<7 | 30 | 90 | 0>(30)
  const since = period ? Date.now() - period * 86_400_000 : 0
  const rows = CATALOG.map((s) => {
    const os = db.orders.filter((o) => o.service === s.code && o.createdAt >= since && o.status !== 'canceled' && o.status !== 'awaiting_deposit')
    const done = os.filter((o) => o.job === 'completed' || o.job === 'accepted')
    const onTime = done.filter((o) => (o.events.at(-1)?.t ?? 0) <= o.dueAt).length
    const rejected = os.filter((o) => o.rejectNote).length
    const rev = os.length ? os.reduce((n, o) => n + o.revisionsUsed, 0) / os.length : 0
    const value = os.reduce((n, o) => n + o.price.total, 0)
    return { s, n: os.length, done: done.length, onTime, rejected, rev, value, cost: Math.round(value * (COST_PCT[s.code] ?? 0.1)) }
  })
  const tot = rows.reduce((t, r) => ({ n: t.n + r.n, value: t.value + r.value, cost: t.cost + r.cost, rejected: t.rejected + r.rejected }), { n: 0, value: 0, cost: 0, rejected: 0 })
  const leads = db.sales.flatMap((a) => a.leads).filter((l) => l.t >= since)
  const won = leads.filter((l) => l.status === 'won').length
  const mrr = db.sales.filter((a) => a.status === 'live' && a.terms?.acceptedAt).reduce((n, a) => n + a.terms!.monthly, 0)
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
  const maxValue = Math.max(...rows.map((r) => r.value), 1)
  const exportCsv = () => {
    const head = ['Dịch vụ', 'Đơn', 'Hoàn tất', 'Đúng hạn', 'Bị trả lại', 'Lượt sửa TB', 'Giá trị', 'Chi phí agent']
    const body = rows.map((r) => [r.s.name, r.n, r.done, pct(r.onTime, r.done), r.rejected, r.rev.toFixed(1), r.value, r.cost])
    const csv = [head, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bao-cao-ai-studio-${period || 'toan-bo'}-ngay.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Page max={1180}>
      <PageHead title="Báo cáo" sub={`Số liệu ${period ? `${period} ngày gần nhất` : 'toàn bộ thời gian'}; chi phí model là ước tính.`} end={<Btn onClick={exportCsv}><Icon name="file" size={14} /> Xuất CSV</Btn>} />
      <div className="flex items-center gap-1 border border-line rounded-r p-1 self-start" role="group" aria-label="Khoảng thời gian báo cáo">
        {([7, 30, 90, 0] as const).map((d) => <button key={d} type="button" aria-pressed={period === d} onClick={() => setPeriod(d)} className={`min-h-8 px-3 rounded-r text-[13px] ${period === d ? 'bg-ink text-white font-medium' : 'text-ink-2 hover:bg-soft'}`}>{d ? `${d} ngày` : 'Toàn bộ'}</button>)}
      </div>
      <dl className="grid grid-cols-4 max-lg:grid-cols-2 border border-line rounded-r2 divide-x divide-line max-lg:divide-x-0 [&>div]:p-4">
        <div><dt className="text-xs text-ink-3">Giá trị đơn</dt><dd className="text-xl font-mono">{vnd(tot.value)}</dd></div>
        <div><dt className="text-xs text-ink-3">Chi phí agent ước tính</dt><dd className="text-xl font-mono">{vnd(tot.cost)}</dd><dd className="text-xs text-ink-3">{pct(tot.cost, tot.value)} giá trị</dd></div>
        <div><dt className="text-xs text-ink-3">Tỷ lệ bị trả lại khi duyệt</dt><dd className="text-xl font-mono">{pct(tot.rejected, tot.n)}</dd></div>
        <div><dt className="text-xs text-ink-3">Agent bán hàng · doanh thu tháng</dt><dd className="text-xl font-mono">{vnd(mrr)}</dd></div>
      </dl>
      <section className="grid gap-3 border border-line rounded-r2 p-4">
        <div className="flex items-baseline gap-2"><h2 className="text-sm">Giá trị theo dịch vụ</h2><span className="text-xs text-ink-3">Tổng {vnd(tot.value)}</span></div>
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.s.code} className="grid grid-cols-[120px_minmax(0,1fr)_110px] max-sm:grid-cols-[88px_minmax(0,1fr)] items-center gap-3 text-[13px]">
              <span className="truncate">{r.s.name}</span>
              <span className="h-2 rounded-full bg-soft overflow-hidden"><i className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(r.value / maxValue) * 100}%` }} /></span>
              <span className="font-mono text-right max-sm:col-span-2">{vnd(r.value)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm">Theo dịch vụ</h2>
        <div className="overflow-x-auto border border-line rounded-r2">
          <table className="w-full text-[13px] min-w-[760px]">
            <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:p-2.5"><th>Dịch vụ</th><th>Đơn</th><th>Hoàn tất</th><th>Đúng hạn</th><th>Bị trả lại</th><th>Lượt sửa TB</th><th className="text-right">Giá trị</th><th className="text-right">Chi phí agent</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.s.code} className="border-b border-line last:border-0 [&>td]:p-2.5 tabular-nums"><td className="font-medium">{r.s.name}</td><td>{r.n}</td><td>{r.done}</td><td>{pct(r.onTime, r.done)}</td><td>{r.rejected}</td><td>{r.rev.toFixed(1)}</td><td className="text-right font-mono">{vnd(r.value)}</td><td className="text-right font-mono">{vnd(r.cost)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm">Agent bán hàng</h2>
        <dl className="grid grid-cols-4 max-md:grid-cols-2 gap-3 [&>div]:border [&>div]:border-line [&>div]:rounded-r2 [&>div]:p-3 text-[13px]">
          <div><dt className="text-xs text-ink-3">Hội thoại</dt><dd className="font-mono">{db.sales.reduce((n, a) => n + a.conv, 0).toLocaleString('vi-VN')}</dd></div>
          <div><dt className="text-xs text-ink-3">Lead</dt><dd className="font-mono">{leads.length}</dd></div>
          <div><dt className="text-xs text-ink-3">Chốt được</dt><dd className="font-mono">{won} ({pct(won, leads.length)})</dd></div>
          <div><dt className="text-xs text-ink-3">Yêu cầu hỗ trợ mở</dt><dd className="font-mono">{db.sales.flatMap((a) => a.help ?? []).filter((h) => h.status === 'open').length}</dd></div>
        </dl>
        <p className="text-xs text-ink-3">Doanh thu tháng là MRR đang hoạt động; hội thoại và lead tuân theo khoảng thời gian đã chọn.</p>
      </section>
    </Page>
  )
}
