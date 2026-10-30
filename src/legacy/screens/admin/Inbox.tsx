import { useEffect, useRef, useState } from 'react'
import { findService, type ServiceCode } from '../../lib/catalog'
import { navigate } from '../../router'
import { activeServices, creditOf, orderStatusAdmin, serviceOf, useStore, type Thread } from '../../store'
import { price } from '../../lib/pricing'
import { QuoteLines } from '../../components/QuoteLines'
import { AIBadge, Avatar, Btn, Empty, Icon, Modal, vnd, when } from '../../ui'
import { getStaffInbox } from '@/app/(frontend)/actions/conversation'

type F = 'all' | 'waiting' | 'ai' | 'unread'

/** A-04: hộp thư hợp nhất — tiếp quản chat, gợi ý trả lời, chèn báo giá, hồ sơ khách. */
export default function Inbox({ selected }: { selected?: string }) {
  const { db, hydrateInbox, ownerSend, setTakeover, readThread, saveThreadNote } = useStore()
  const [f, setF] = useState<F>('all')
  const [draft, setDraft] = useState('')
  const [quoting, setQuoting] = useState(false)
  const [syncError, setSyncError] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const name = (t: Thread) => db.customers.find((c) => c.id === t.customer)?.name || 'Khách mới'
  const last = (t: Thread) => t.messages[t.messages.length - 1]
  const threads = db.threads.slice().sort((a, b) => (last(b)?.t ?? 0) - (last(a)?.t ?? 0)).filter((t) =>
    f === 'all' ? true : f === 'waiting' ? t.handoff || t.takeover : f === 'ai' ? !t.handoff && !t.takeover : t.unread > 0)
  const th = db.threads.find((t) => t.id === selected) ?? threads[0]
  const c = th && db.customers.find((x) => x.id === th.customer)
  const orders = th ? db.orders.filter((o) => o.customer === th.customer) : []

  useEffect(() => { if (th?.unread) readThread(th.id) }, [th?.id, th?.unread, readThread])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [th?.id, th?.messages.length])
  useEffect(() => {
    let active = true
    const refresh = async () => {
      const result = await getStaffInbox()
      if (!active) return
      if (!result.ok) { setSyncError(result.error); return }
      setSyncError('')
      hydrateInbox(result.snapshot)
    }
    void refresh()
    const timer = setInterval(refresh, 10_000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  const lastClient = th && [...th.messages].reverse().find((m) => m.from === 'me')
  const suggestion = !lastClient ? '' : /lịch|google|tích hợp/i.test(lastClient.text) ? 'Dạ được chị ạ. Form đặt lịch có thể đồng bộ Google Calendar, em thêm vào phạm vi mà không tính phí.'
    : /hộp|bao bì/i.test(lastClient.text) ? 'Dạ có ạ, em đã nhắn Mai làm thêm bản áp lên hộp bánh trong bộ nhận diện.'
    : 'Dạ em đã nhận, em kiểm tra và phản hồi chị trong vài phút nhé.'
  const send = () => { if (!th || !draft.trim()) return; if (!th.takeover) setTakeover(th.id, true); ownerSend(th.id, draft.trim()); setDraft('') }

  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)_300px] max-xl:grid-cols-[280px_minmax(0,1fr)] max-md:grid-cols-1 h-[calc(100dvh-53px)] max-md:h-auto">
      <aside className={`border-r border-line flex flex-col min-h-0 ${selected ? 'max-md:hidden' : ''}`}>
        <div className="px-4 pt-4 pb-2 grid gap-2.5">
          <h1 className="text-sm">Hộp thư</h1>
          {syncError && <p role="alert" className="text-xs text-warn">{syncError}</p>}
          <div className="flex gap-1 flex-wrap">
            {([['all', 'Tất cả'], ['waiting', 'Chờ người'], ['ai', 'AI đang xử lý'], ['unread', 'Chưa đọc']] as [F, string][]).map(([id, l]) => (
              <button key={id} type="button" aria-pressed={f === id} onClick={() => setF(id)} className={`h-7 max-md:h-10 px-2.5 rounded-r text-xs ${f === id ? 'bg-hover font-medium' : 'text-ink-2 hover:bg-soft'}`}>{l}</button>
            ))}
          </div>
        </div>
        <ul className="overflow-auto flex-1 px-2 pb-2">
          {threads.length === 0 && <Empty text="Không có cuộc trò chuyện nào." />}
          {threads.map((t) => (
            <li key={t.id}><a href={`#/admin/hop-thu/${t.id}`} aria-current={t === th ? 'true' : undefined} className={`flex gap-2.5 p-2.5 rounded-r ${t === th ? 'bg-hover' : 'hover:bg-soft'}`}>
              <span className="size-8 rounded-full bg-soft grid place-items-center text-xs font-medium text-ink-2 flex-none">{name(t).split(' ').slice(-2).map((w) => w[0]).join('')}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">{name(t)}{t.takeover ? <span className="text-[11px] text-accent font-normal">Bạn đang trả lời</span> : t.handoff ? <span className="text-[11px] text-warn font-normal">Chờ người</span> : <AIBadge />}</span>
                <span className="block text-xs text-ink-3 truncate">{last(t)?.from === 'owner' ? 'Bạn: ' : ''}{last(t)?.text}</span>
              </span>
              <span className="grid justify-items-end gap-1"><span className="text-[11px] text-ink-3 font-mono">{last(t) && when(last(t).t).replace('Hôm qua ', 'HQ ')}</span>{t.unread > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[11px] grid place-items-center px-1">{t.unread}</span>}</span>
            </a></li>
          ))}
        </ul>
      </aside>

      {!th ? <div className="grid place-items-center"><Empty text="Chọn một cuộc trò chuyện." /></div> : (
        <section className={`flex flex-col min-h-0 min-w-0 ${!selected ? 'max-md:hidden' : ''}`}>
          <header className="flex items-center gap-2.5 px-5 py-3 border-b border-line flex-wrap">
            <button type="button" onClick={() => navigate('/admin/hop-thu')} className="md:hidden size-10 grid place-items-center -ml-2" aria-label="Quay lại"><Icon name="back" /></button>
            <div className="min-w-0"><h2 className="text-sm">{c?.name || 'Khách mới'}</h2><p className="text-xs text-ink-3">{th.takeover ? 'Bạn đang trả lời trực tiếp — AI tạm dừng' : th.handoff ? 'Khách yêu cầu gặp người' : 'Trợ lý AI đang xử lý'}</p></div>
            <div className="ml-auto flex gap-2">
              <Btn size="s" onClick={() => setQuoting(true)}><Icon name="file" size={14} /> Gửi báo giá</Btn>
              {th.takeover ? <Btn size="s" onClick={() => setTakeover(th.id, false)}>Trả lại AI</Btn> : <Btn size="s" kind="primary" onClick={() => setTakeover(th.id, true)}>Tiếp quản</Btn>}
            </div>
          </header>
          {th.takeover && <p className="px-5 py-2 text-xs bg-accent/5 text-accent border-b border-line">AI đã tạm dừng trong cuộc trò chuyện này.</p>}
          <div className="flex-1 overflow-auto px-5 py-5 flex flex-col gap-4">
            {th.messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 items-start max-w-[80%] ${m.from === 'me' ? '' : 'self-end flex-row-reverse'}`}>
                {m.from === 'me' ? <span className="size-7 rounded-full bg-soft grid place-items-center text-[11px] font-medium text-ink-2 flex-none">KH</span> : m.from === 'ai' ? <Avatar size={28} /> : <span className="size-7 rounded-full bg-ink text-white grid place-items-center text-[11px] font-medium flex-none">LC</span>}
                <div className={`grid gap-1 ${m.from === 'me' ? '' : 'justify-items-end'}`}>
                  <p className={`px-3 py-2 rounded-r2 text-[13px] ${m.from === 'me' ? 'bg-soft' : m.from === 'owner' ? 'bg-accent text-white' : 'border border-line'}`}>{m.text}</p>
                  {m.quoteCode && <a href={`#/admin/don-hang`} className="text-xs text-accent font-mono">Báo giá {m.quoteCode}</a>}
                  <span className="text-[11px] text-ink-3">{m.from === 'ai' ? 'Trợ lý AI · ' : m.from === 'owner' ? 'Bạn · ' : ''}{when(m.t)}</span>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <div className="border-t border-line p-4 grid gap-2">
            {suggestion && lastClient && last(th).from === 'me' && (
              <button type="button" onClick={() => setDraft(suggestion)} className="text-left text-[13px] border border-dashed border-line rounded-r2 px-3 py-2 hover:bg-side flex gap-2"><Icon name="spark" size={14} className="text-accent mt-0.5" /><span><span className="text-xs text-ink-3 block">Gợi ý trả lời (AI soạn, bạn sửa trước khi gửi)</span>{suggestion}</span></button>
            )}
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={2} placeholder={th.takeover ? 'Trả lời khách…' : 'Gửi tin sẽ tự tiếp quản cuộc trò chuyện…'} className="flex-1 border border-line rounded-r2 px-3 py-2 text-[13px] outline-none focus:border-[#d4d4d4] resize-none" />
              <Btn kind="primary" type="submit" disabled={!draft.trim()}><Icon name="send" size={14} /> Gửi</Btn>
            </form>
          </div>
        </section>
      )}

      {th && c && (
        <aside className="border-l border-line p-4 grid gap-5 content-start overflow-auto max-xl:hidden">
          <div><a href={`#/admin/khach-hang/${c.id}`} className="text-sm font-medium hover:underline underline-offset-4">{c.name || 'Khách mới'}</a><p className="text-xs text-ink-3">{c.contact} · {c.industry}</p></div>
          <dl className="text-[13px] grid gap-0">
            {[['Liên hệ', c.channel === 'zalo' ? `Zalo ${c.phone}` : c.channel === 'phone' ? c.phone : c.email], ['Credit', vnd(Math.max(0, creditOf(db, c.id)))], ['Gói', c.plan ? c.plan.code : 'Không'], ['Tổng đơn', String(orders.length)]].map(([k, v]) => <div key={k} className="flex justify-between gap-2 py-1.5 border-t border-line first:border-t-0"><dt className="text-ink-3">{k}</dt><dd className="text-right truncate">{v}</dd></div>)}
          </dl>
          <section><h3 className="text-xs text-ink-3 mb-1.5">Đơn gần đây</h3>
            <ul className="grid gap-1">{orders.slice(0, 4).map((o) => <li key={o.code}><a href={`#/admin/viec/${o.code}`} className="flex justify-between gap-2 text-[13px] py-1 hover:text-accent"><span className="truncate">{findService(o.service)!.name}</span><span className="text-xs text-ink-3 whitespace-nowrap">{orderStatusAdmin(o)}</span></a></li>)}{orders.length === 0 && <li className="text-[13px] text-ink-3">Chưa có đơn</li>}</ul>
          </section>
          <label className="grid gap-1.5"><span className="text-xs text-ink-3">Ghi chú nội bộ (khách không thấy)</span><textarea defaultValue={th.note} onBlur={(e) => saveThreadNote(th.id, e.target.value)} rows={4} placeholder="Sở thích, lưu ý…" className="border border-line rounded-r2 p-2.5 text-[13px] outline-none focus:border-[#d4d4d4] resize-none" /></label>
        </aside>
      )}
      {quoting && th && <QuoteComposer threadId={th.id} onClose={() => setQuoting(false)} />}
    </div>
  )
}

function QuoteComposer({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const { db, ownerQuote, setTakeover } = useStore()
  const svcs = activeServices(db)
  const [code, setCode] = useState<ServiceCode>(svcs[0].code)
  const [opts, setOpts] = useState<string[]>([])
  const [rush, setRush] = useState(false)
  const [style, setStyle] = useState('')
  const svc = serviceOf(db, code)
  const p = price({ service: svc, optionCodes: opts, rush, depositPct: db.settings.depositPct, smallOrderThreshold: db.settings.smallOrder })
  return (
    <Modal wide title="Gửi báo giá vào cuộc trò chuyện" onClose={onClose}>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Dịch vụ</span><select value={code} onChange={(e) => { setCode(e.target.value as ServiceCode); setOpts([]) }} className="h-9 px-2 border border-line rounded-r">{svcs.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
        <fieldset className="grid gap-1 text-[13px]"><legend className="text-ink-3 mb-1">Tùy chọn</legend>
          {svc.options.map((o) => <label key={o.code} className="flex gap-2 items-center min-h-8"><input type="checkbox" checked={opts.includes(o.code)} onChange={(e) => setOpts(e.target.checked ? [...opts, o.code] : opts.filter((x) => x !== o.code))} className="accent-accent" />{o.label} <span className="text-ink-3 ml-auto font-mono text-xs">+{vnd(o.price)}</span></label>)}
          <label className="flex gap-2 items-center min-h-8"><input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} className="accent-accent" />Giao gấp 24 giờ <span className="text-ink-3 ml-auto font-mono text-xs">+{vnd(svc.rushSurcharge)}</span></label>
        </fieldset>
        <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Mô tả brief</span><input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Ví dụ: trang đặt lịch, đồng bộ Google Calendar" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-[#d4d4d4]" /></label>
        <div className="bg-side rounded-r2 p-3"><QuoteLines price={p} compact /></div>
        <p className="text-xs text-ink-3">Giá tính từ engine theo bảng giá hiện hành — không sửa tay được.</p>
      </div>
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={style.trim().length < 3} onClick={() => { setTakeover(threadId, true); ownerQuote(threadId, code, opts, rush, style.trim()); onClose() }}>Gửi báo giá</Btn></div>
    </Modal>
  )
}
