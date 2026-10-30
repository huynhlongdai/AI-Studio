import { useMemo, useState } from 'react'
import { CATALOG, findService, type ServiceCode } from '../../lib/catalog'
import { navigate } from '../../router'
import { customerName, orderStatusAdmin, useStore, type Order } from '../../store'
import { Btn, Empty, Icon, Page, PageHead, day, vnd } from '../../ui'

const COST_PCT: Record<ServiceCode, number> = { logo: 0.08, post: 0.07, video: 0.16, landing: 0.1 }
type Sort = 'createdAt' | 'total' | 'margin'
const GROUPS: [string, (o: Order) => boolean][] = [
  ['Tất cả', () => true], ['Chờ cọc', (o) => o.status === 'awaiting_deposit'], ['Đang làm', (o) => o.status === 'active' && o.job !== 'completed'],
  ['Chờ thanh toán cuối', (o) => o.status === 'awaiting_final'], ['Hoàn tất', (o) => o.status === 'completed'], ['Đã hủy', (o) => o.status === 'canceled'],
]

/** A-05: bảng đơn có lọc, sắp xếp, xuất CSV. */
export default function AdminOrders() {
  const { db } = useStore()
  const [g, setG] = useState(0)
  const [svc, setSvc] = useState<'all' | ServiceCode>('all')
  const [cust, setCust] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('createdAt')
  const rows = useMemo(() => db.orders
    .filter(GROUPS[g][1]).filter((o) => svc === 'all' || o.service === svc).filter((o) => cust === 'all' || o.customer === cust)
    .filter((o) => !q || (o.code + customerName(db, o.customer) + o.brand).toLowerCase().includes(q.toLowerCase()))
    .map((o) => ({ o, margin: Math.round((1 - COST_PCT[o.service]) * 100) }))
    .sort((a, b) => sort === 'total' ? b.o.price.total - a.o.price.total : sort === 'margin' ? b.margin - a.margin : b.o.createdAt - a.o.createdAt), [db, g, svc, cust, q, sort])
  const sum = rows.reduce((s, r) => s + r.o.price.total, 0), got = rows.reduce((s, r) => s + r.o.paid, 0)

  const exportCsv = () => {
    const head = ['Mã', 'Khách', 'Dịch vụ', 'Tổng', 'Đã trả', 'Còn lại', 'Trạng thái', 'Ngày tạo']
    const lines = rows.map(({ o }) => [o.code, customerName(db, o.customer), findService(o.service)!.name, o.price.total, o.paid, o.price.total - o.paid, orderStatusAdmin(o), new Date(o.createdAt).toISOString().slice(0, 10)])
    const csv = '\ufeff' + [head, ...lines].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }
  const sel = 'h-8 max-md:h-11 px-2 border border-line rounded-r text-[13px] bg-white'

  return (
    <Page max={1280}>
      <PageHead title="Đơn hàng" sub={`${rows.length} đơn · giá trị ${vnd(sum)} · đã thu ${vnd(got)}`} end={<Btn onClick={exportCsv} disabled={!rows.length}><Icon name="file" size={14} /> Xuất CSV</Btn>} />
      <div className="grid gap-3">
        <div className="flex gap-1 flex-wrap">{GROUPS.map(([l, fn], i) => <button key={l} type="button" aria-pressed={g === i} onClick={() => setG(i)} className={`h-8 max-md:h-10 px-3 rounded-r text-[13px] ${g === i ? 'bg-hover font-medium' : 'text-ink-2 hover:bg-soft'}`}>{l} <span className="text-ink-3 font-normal">{db.orders.filter(fn).length}</span></button>)}</div>
        <div className="flex gap-2 flex-wrap">
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Tìm mã, khách…" aria-label="Tìm đơn" className={`${sel} w-56 max-sm:w-full outline-none`} />
          <select value={svc} onChange={(e) => setSvc(e.target.value as ServiceCode)} aria-label="Dịch vụ" className={sel}><option value="all">Mọi dịch vụ</option>{CATALOG.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
          <select value={cust} onChange={(e) => setCust(e.target.value)} aria-label="Khách hàng" className={sel}><option value="all">Mọi khách</option>{db.customers.map((c) => <option key={c.id} value={c.id}>{c.name || 'Khách mới'}</option>)}</select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sắp xếp" className={`${sel} ml-auto max-sm:ml-0`}><option value="createdAt">Mới nhất</option><option value="total">Giá trị cao nhất</option><option value="margin">Biên lãi cao nhất</option></select>
        </div>
        {rows.length === 0 ? <Empty text="Không có đơn nào khớp bộ lọc." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse min-w-[860px]">
              <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:py-2 [&>th]:pr-3"><th>Mã</th><th>Khách</th><th>Dịch vụ</th><th className="text-right">Tổng</th><th className="text-right">Đã trả</th><th className="text-right">Còn lại</th><th>Trạng thái</th><th className="text-right">Biên lãi</th><th className="text-right">Ngày</th></tr></thead>
              <tbody>{rows.map(({ o, margin }) => (
                <tr key={o.code} onClick={() => navigate(`/admin/viec/${o.code}`)} className="border-b border-line hover:bg-side cursor-pointer [&>td]:py-2.5 [&>td]:pr-3">
                  <td className="font-mono text-xs">{o.code}</td>
                  <td><a href={`#/admin/khach-hang/${o.customer}`} onClick={(e) => e.stopPropagation()} className="hover:underline underline-offset-4">{customerName(db, o.customer)}</a></td>
                  <td>{findService(o.service)!.name}</td>
                  <td className="text-right tabular-nums">{vnd(o.price.total)}</td><td className="text-right tabular-nums">{vnd(o.paid)}</td>
                  <td className={`text-right tabular-nums ${o.price.total - o.paid > 0 && o.status !== 'canceled' ? 'text-warn' : 'text-ink-3'}`}>{vnd(o.price.total - o.paid)}</td>
                  <td>{orderStatusAdmin(o)}</td><td className="text-right tabular-nums">{margin}%</td><td className="text-right font-mono text-xs text-ink-3">{day(o.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  )
}
