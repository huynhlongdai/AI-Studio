import { useEffect, useState } from 'react'
import { findService, QC_CHECKS } from '../../lib/catalog'
import { navigate } from '../../router'
import { useStore } from '../../store'
import { Artwork } from '../../components/Artwork'
import PlanQueue from './PlanQueue'
import ActionQueue from './ActionQueue'
import { Avatar, Btn, Empty, Icon, Modal, Page, PageHead, vnd, when } from '../../ui'

const REJECT = ['Chưa đúng brief', 'Lỗi chính tả / dấu', 'Chất lượng hình ảnh chưa đạt', 'Không phù hợp thương hiệu']

export default function Approvals({ selected }: { selected?: string }) {
  const { db, ownerApprove, ownerReject } = useStore()
  const [all, setAll] = useState(false)
  const mineOnly = db.session.staff === 'specialist' && !all
  const queue = db.orders.filter((o) => o.job === 'pending_approval' && (!mineOnly || o.reviewer === db.session.member))
  const o = queue.find((x) => x.code === selected) ?? queue[0]
  const [rej, setRej] = useState(false)
  const [reason, setReason] = useState(REJECT[0])
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!o) return
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea') || rej) return
      const i = queue.indexOf(o)
      if (e.key === 'a') { ownerApprove(o.code); setDone(`Đã duyệt ${o.code} và gửi khách`) }
      if (e.key === 'r') setRej(true)
      if (e.key === 'j' && queue[i + 1]) navigate(`/admin/duyet/${queue[i + 1].code}`)
      if (e.key === 'k' && queue[i - 1]) navigate(`/admin/duyet/${queue[i - 1].code}`)
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [o, queue, rej, ownerApprove])
  useEffect(() => { if (done) { const t = setTimeout(() => setDone(null), 2400); return () => clearTimeout(t) } }, [done])

  return (
    <Page max={1280}>
      <PageHead title="Hàng chờ duyệt" sub={<>Mọi bản nháp phải qua chuyên viên trước khi tới khách · phím tắt <kbd className="font-mono text-xs border border-line rounded px-1">A</kbd> duyệt <kbd className="font-mono text-xs border border-line rounded px-1">R</kbd> trả lại <kbd className="font-mono text-xs border border-line rounded px-1">J</kbd>/<kbd className="font-mono text-xs border border-line rounded px-1">K</kbd> chuyển</>} />
      {db.session.staff === 'specialist' && <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-accent" />Xem cả việc giao cho người khác</label>}
      <ActionQueue />
      <PlanQueue mineOnly={mineOnly} />
      {done && <p role="status" className="enter text-[13px] bg-ok/10 text-ink rounded-r2 px-4 py-2.5 flex items-center gap-2"><Icon name="check" size={14} className="text-ok" />{done}</p>}
      {!o ? (
        <div className="border border-line rounded-r2"><Empty text={db.orders.some((x) => x.status === 'active' && x.plan?.status === 'pending') ? 'Không có bản nháp nào chờ duyệt. Hãy duyệt kế hoạch ở trên để agent bắt đầu làm.' : "Không có gì chờ duyệt. Bản nháp mới sẽ xuất hiện ở đây ngay khi qua kiểm tra chất lượng."} cta={<Btn size="s" onClick={() => navigate('/admin/viec')}>Xem bảng việc</Btn>} /></div>
      ) : (
        <div className="grid grid-cols-[260px_minmax(0,1fr)_300px] gap-6 max-xl:grid-cols-[240px_minmax(0,1fr)] max-md:grid-cols-1">
          <ul className="grid gap-1 content-start" aria-label="Danh sách chờ duyệt">
            {queue.map((x) => {
              const age = Math.round((Date.now() - (x.events.at(-1)?.t ?? x.createdAt)) / 60000)
              return (
                <li key={x.code}><a href={`#/admin/duyet/${x.code}`} aria-current={x === o ? 'true' : undefined} className={`flex gap-2.5 p-2.5 rounded-r ${x === o ? 'bg-hover' : 'hover:bg-soft'}`}>
                  <Avatar id={findService(x.service)!.agent} size={28} />
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium truncate">{findService(x.service)!.name} · v{x.version}</span><span className="block text-xs text-ink-3"><span className="font-mono">{x.code}</span> · chờ {age} phút</span></span>
                </a></li>
              )
            })}
          </ul>

          <section className="min-w-0 grid gap-3 content-start">
            <div className="flex items-baseline gap-2"><h2 className="text-sm">{o.brand} · bản v{o.version}</h2><span className="font-mono text-xs text-ink-3">{o.code}</span><span className="ml-auto text-xs text-ink-3">Bản gốc, không watermark</span></div>
            <div className="border border-line rounded-r2 bg-[#f4efe8] aspect-[3/2] grid place-items-center p-10"><Artwork service={o.service} brand={o.brand} v={o.version} /></div>
            <div className="flex gap-2 max-sm:flex-col">
              <Btn kind="primary" size="l" onClick={() => { ownerApprove(o.code); setDone(`Đã duyệt ${o.code} và gửi khách`) }}><Icon name="check" size={15} /> Duyệt & gửi khách</Btn>
              <Btn size="l" onClick={() => setRej(true)}>Trả lại cho agent</Btn>
            </div>
          </section>

          <aside className="grid gap-5 content-start max-xl:col-start-2 max-md:col-start-auto">
            <section>
              <h2 className="text-sm mb-2">Báo cáo kiểm tra (Lan)</h2>
              <ul className="text-[13px] text-ink-2">{QC_CHECKS[o.service].map((c) => <li key={c} className="flex gap-2 py-1.5 border-t border-line first:border-t-0"><Icon name="check" size={14} className="text-ok mt-0.5" />{c}</li>)}</ul>
            </section>
            <section className="grid gap-1.5">
              <h2 className="text-sm">Brief</h2>
              <p className="text-[13px] text-ink-2">{o.style}</p>
            </section>
            {o.revisions.length > 0 && (
              <section>
                <h2 className="text-sm mb-1.5">Góp ý gần nhất của khách</h2>
                {o.revisions.at(-1)!.annots.map((a, i) => <p key={a.id} className="text-[13px] text-ink-2"><span className="font-mono text-xs text-accent">{i + 1}.</span> {a.text}</p>)}
                {o.revisions.at(-1)!.note && <p className="text-[13px] text-ink-2 italic">“{o.revisions.at(-1)!.note}”</p>}
              </section>
            )}
            <dl className="text-[13px] border-t border-line pt-3">
              {[['Giá trị đơn', vnd(o.price.total)], ['Đã thu', vnd(o.paid)], ['Lượt sửa đã dùng', String(o.revisionsUsed)], ['Nộp lúc', when(o.events.at(-1)?.t ?? 0)]].map(([k, v]) => <div key={k} className="flex justify-between py-1.5"><dt className="text-ink-3">{k}</dt><dd className="tabular-nums">{v}</dd></div>)}
            </dl>
          </aside>
        </div>
      )}

      {rej && o && (
        <Modal title={`Trả lại ${o.code} cho agent`} onClose={() => setRej(false)}>
          <fieldset className="grid gap-1">
            <legend className="text-[13px] text-ink-3 mb-1.5">Lý do (bắt buộc)</legend>
            {REJECT.map((r) => <label key={r} className="flex gap-2.5 items-center text-[13px] min-h-9 px-2 rounded-r hover:bg-soft cursor-pointer"><input type="radio" checked={reason === r} onChange={() => setReason(r)} className="accent-accent" />{r}</label>)}
          </fieldset>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ghi chú cho agent (tùy chọn)" className="w-full border border-line rounded-r2 p-2.5 text-[13px] outline-none focus:border-[#d4d4d4] resize-none" />
          <p className="text-xs text-ink-3">Khách không thấy lý do này — tiến độ của khách vẫn hiện "Đang thực hiện".</p>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setRej(false)}>Hủy</Btn><Btn kind="primary" onClick={() => { ownerReject(o.code, note.trim() ? `${reason} — ${note.trim()}` : reason); setRej(false); setNote(''); setDone(`Đã trả ${o.code} về cho agent sửa`) }}>Trả lại</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
