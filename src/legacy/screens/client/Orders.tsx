import { useState } from 'react'
import { navigate } from '../../router'
import { useStore, useMine, type Order } from '../../store'
import { Btn, Empty, Icon, Page, PageHead, Tabs } from '../../ui'
import { OrderTable } from './Dashboard'

type F = 'all' | 'action' | 'running' | 'done' | 'canceled'
const match: Record<F, (o: Order) => boolean> = {
  all: () => true,
  action: (o) => o.job === 'client_review' || o.status === 'awaiting_deposit' || o.status === 'awaiting_final',
  running: (o) => o.status === 'active' && o.job !== 'client_review' && o.job !== 'completed',
  done: (o) => o.status === 'completed',
  canceled: (o) => o.status === 'canceled',
}

export default function Orders() {
  const db = useMine()
  const [f, setF] = useState<F>('all')
  const [q, setQ] = useState('')
  const list = db.orders.filter(match[f]).filter((o) => !q || (o.code + o.brand).toLowerCase().includes(q.toLowerCase()))
  return (
    <Page>
      <PageHead title="Đơn hàng" sub={`${db.orders.length} đơn`} end={<Btn kind="primary" onClick={() => navigate('/app/chat')}><Icon name="plus" size={14} /> Đặt việc mới</Btn>} />
      <div className="grid gap-4">
        <div className="flex items-end gap-4 max-sm:flex-col max-sm:items-stretch">
          <div className="flex-1 min-w-0">
            <Tabs value={f} onChange={setF} items={([['all', 'Tất cả'], ['action', 'Cần bạn'], ['running', 'Đang làm'], ['done', 'Hoàn tất'], ['canceled', 'Đã hủy']] as [F, string][]).map(([id, label]) => ({ id, label: <>{label} <span className="text-ink-3 font-normal">{db.orders.filter(match[id]).length}</span></> }))} />
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Tìm theo mã đơn" aria-label="Tìm theo mã đơn" className="h-8 max-md:h-11 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-[#d4d4d4] w-56 max-sm:w-full mb-1.5" />
        </div>
        {list.length === 0 ? <Empty text={db.orders.length ? 'Không có đơn nào khớp bộ lọc.' : 'Chưa có đơn nào — chat với trợ lý để nhận báo giá trong 3 phút.'} /> : <OrderTable orders={list} />}
      </div>
    </Page>
  )
}
