import { useState } from 'react'
import { CHANNELS, type SalesAgent, type SalesTerms } from '../../lib/agents'
import { useStore } from '../../store'
import { Btn, Empty, Modal, Page, PageHead, vnd, when } from '../../ui'

const STATUS = { setup: 'Đang thiết lập', testing: 'Đang thử', live: 'Đang chạy', paused: 'Tạm dừng' }

/** Agent bán hàng theo khách: điều khoản riêng từng khách, tình trạng, mức dùng. */
export default function SalesAgents() {
  const { db, adminSetSalesStatus } = useStore()
  const [edit, setEdit] = useState<SalesAgent | null>(null)
  const name = (id: string) => db.customers.find((c) => c.id === id)?.name ?? id
  const mrr = db.sales.filter((a) => a.terms?.acceptedAt && a.status === 'live').reduce((s, a) => s + a.terms!.monthly, 0)
  return (
    <Page max={1280}>
      <PageHead title="Agent bán hàng của khách" sub={`Dịch vụ thuê dài hạn · doanh thu tháng đang chạy ${vnd(mrr)}. Phí và hạn mức thỏa thuận riêng với từng khách.`} />
      {db.sales.length === 0 ? <div className="border border-line rounded-r2"><Empty text="Chưa khách nào đăng ký agent bán hàng." /></div> : (
        <div className="overflow-x-auto border border-line rounded-r2">
          <table className="w-full text-[13px] border-collapse min-w-[900px]">
            <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:py-2.5 [&>th]:px-3"><th>Khách</th><th>Trạng thái</th><th>Kênh</th><th>Hội thoại / hạn mức</th><th>Lead</th><th>Kiến thức</th><th>Điều khoản</th><th></th></tr></thead>
            <tbody>{db.sales.map((a) => {
              const over = a.terms ? Math.max(0, a.conv - a.terms.includedConv) : 0
              return (
                <tr key={a.customer} className="border-b border-line last:border-0 [&>td]:py-2.5 [&>td]:px-3">
                  <td><a href={`#/admin/agent-khach/${a.customer}`} className="font-medium hover:text-accent">{name(a.customer)}</a>{(a.help ?? []).some((h) => h.status === 'open') && <span className="block text-xs text-accent">Đang nhờ hỗ trợ</span>}</td>
                  <td>{STATUS[a.status]}{a.test && <span className="block text-xs text-ink-3">Thi thử {a.test.score}/{a.test.total}</span>}</td>
                  <td className="text-xs text-ink-2">{a.channels.filter((c) => c.connected).map((c) => CHANNELS[c.id].name).join(', ') || '—'}</td>
                  <td className="font-mono text-xs">{a.conv.toLocaleString('vi-VN')}{a.terms && ` / ${a.terms.includedConv.toLocaleString('vi-VN')}`}{over > 0 && <span className="block text-warn">vượt {over} · {vnd(over * a.terms!.extraPerConv)}</span>}</td>
                  <td className="font-mono">{a.leads.length}</td>
                  <td className="text-xs">{a.knowledge.filter((k) => k.status === 'approved').length} đã duyệt{a.knowledge.some((k) => k.status === 'proposed') && <span className="block text-ink-3">{a.knowledge.filter((k) => k.status === 'proposed').length} chờ khách duyệt</span>}</td>
                  <td className="text-xs">{a.termsRequested ? <span className="text-accent font-medium">Cần đặt điều khoản</span> : !a.terms ? '—' : <>{vnd(a.terms.monthly)}/tháng<span className="block text-ink-3">{a.terms.acceptedAt ? `Khách chấp nhận ${when(a.terms.acceptedAt)}` : 'Chờ khách chấp nhận'}</span></>}</td>
                  <td className="text-right whitespace-nowrap"><Btn size="s" kind={a.termsRequested ? 'primary' : 'ghost'} onClick={() => setEdit(a)}>Điều khoản</Btn>{a.status === 'live' && <Btn size="s" kind="plain" onClick={() => adminSetSalesStatus(a.customer, 'paused')}>Tạm dừng</Btn>}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
      {edit && <TermsEditor a={edit} title={name(edit.customer)} onClose={() => setEdit(null)} />}
    </Page>
  )
}

function TermsEditor({ a, title, onClose }: { a: SalesAgent; title: string; onClose: () => void }) {
  const { adminSetTerms } = useStore()
  const [f, setF] = useState<SalesTerms>(a.terms ?? { monthly: 900_000, includedConv: 500, extraPerConv: 1_000, leadFee: 0, note: '' })
  const num = (k: keyof SalesTerms) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) })
  const field = (k: 'monthly' | 'includedConv' | 'extraPerConv' | 'leadFee', label: string) => (
    <label className="grid gap-1.5"><span className="text-ink-3">{label}</span><input inputMode="numeric" value={f[k].toLocaleString('vi-VN')} onChange={num(k)} className="h-9 px-2.5 border border-line rounded-r font-mono text-right outline-none focus:border-accent" /></label>
  )
  return (
    <Modal title={`Điều khoản · ${title}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        {field('monthly', 'Phí tháng (đ)')}{field('includedConv', 'Hội thoại kèm theo / tháng')}{field('extraPerConv', 'Giá mỗi hội thoại vượt (đ)')}{field('leadFee', 'Phí mỗi lead (đ, 0 = không tính)')}
        <label className="grid gap-1.5 col-span-2"><span className="text-ink-3">Ghi chú thỏa thuận</span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ví dụ: giảm 20% 3 tháng đầu" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      </div>
      <p className="text-xs text-ink-3">Lưu sẽ gửi lại cho khách để chấp nhận; agent chỉ chạy thật sau khi khách đồng ý.</p>
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={f.monthly <= 0} onClick={() => { adminSetTerms(a.customer, f); onClose() }}>Gửi điều khoản</Btn></div>
    </Modal>
  )
}
