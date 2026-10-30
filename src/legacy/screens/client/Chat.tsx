import { useEffect, useRef, useState } from 'react'
import { findService } from '../../lib/catalog'
import { navigate } from '../../router'
import { useStore, useMine } from '../../store'
import { useVoiceInput } from '../../lib/useVoiceInput'
import { QuoteLines } from '../../components/QuoteLines'
import { AIBadge, Avatar, Btn, Icon, left, when } from '../../ui'

export default function Chat() {
  const db = useMine()
  const { typing, send, newIntake } = useStore()
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const voice = useVoiceInput((text) => {
    setDraft((current) => [current.trim(), text].filter(Boolean).join(' '))
    ta.current?.focus()
  })
  const s = db.thread.intake
  const paused = db.thread.handoff || db.thread.takeover
  const live = db.thread.takeover
  const svc = s.service ? findService(s.service) : undefined
  const lastChips = [...db.thread.messages].reverse().find((m) => m.from === 'ai')?.chips

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [db.thread.messages.length, typing])

  const submit = (t: string) => {
    if (!t.trim() && !attachment) return
    voice.stop()
    const fileLine = attachment ? `[Tệp đính kèm: ${attachment.name}]` : ''
    send([t.trim(), fileLine].filter(Boolean).join('\n'))
    setDraft('')
    setAttachment(null)
    setFileError('')
    if (picker.current) picker.current.value = ''
    ta.current?.focus()
  }
  const pickFile = (file?: File) => {
    if (!file) return
    const allowed = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!allowed) { setFileError('Chỉ hỗ trợ ảnh hoặc PDF.'); return }
    if (file.size > 10 * 1024 * 1024) { setFileError('Tệp phải nhỏ hơn 10 MB.'); return }
    setAttachment(file)
    setFileError('')
  }

  const brief: [string, string | undefined][] = [
    ['Dịch vụ', svc?.name],
    ['Thương hiệu', s.brand],
    ['Mô tả', s.style],
    ['Tùy chọn', svc && s.optionIdx >= svc.options.length ? (s.options.length ? s.options.map((c) => svc.options.find((o) => o.code === c)!.label).join(', ') : 'Không') : undefined],
    ['Hạn giao', s.askedDeadline ? (s.rush ? 'Gấp 24 giờ' : `Tiêu chuẩn ${svc!.slaDays} ngày`) : undefined],
  ]
  const filled = brief.filter(([, v]) => v).length

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_280px] max-xl:grid-cols-1 min-h-[calc(100dvh-53px)]">
      <section className="flex flex-col min-w-0">
        <header className="flex items-center gap-2.5 px-6 py-3 border-b border-line max-md:px-4 flex-wrap">
          <Avatar size={28} />
          <div>
            <h1 className="text-sm flex items-center gap-1.5">Trợ lý AI Studio <AIBadge /></h1>
            <p className="text-xs text-ink-3">{live ? 'Chuyên viên Longca đang trả lời trực tiếp' : paused ? 'Đã chuyển cho chuyên viên' : 'Trả lời tự động · giá lấy từ bảng giá, không do AI tự đặt'}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Btn size="s" onClick={newIntake}><Icon name="plus" size={14} /><span className="max-sm:hidden">Yêu cầu mới</span></Btn>
            {!paused && <Btn size="s" onClick={() => submit('Cho tôi nói chuyện với người thật')}><Icon name="user" size={14} /><span className="max-sm:hidden">Nói chuyện với người</span></Btn>}
          </div>
        </header>
        {paused && <p className="px-6 py-2.5 text-[13px] bg-soft border-b border-line text-ink-2 flex items-center gap-2"><Icon name="clock" size={14} /> {live ? 'Chuyên viên Longca đã vào cuộc trò chuyện. Trợ lý AI tạm dừng.' : 'Đã chuyển cho chuyên viên — phản hồi trong giờ làm việc. Trợ lý AI tạm dừng.'}</p>}

        <div className="flex-1 flex flex-col gap-5 p-6 max-md:px-4 w-full max-w-[760px] mx-auto" aria-live="polite">
          {db.thread.messages.map((m) => (
            <div key={m.id} className={`enter flex gap-2.5 items-start ${m.from === 'me' ? 'self-end max-w-[min(520px,85%)]' : ''}`}>
              {m.from === 'ai' && <Avatar size={28} />}
              {m.from === 'owner' && <span className="size-7 rounded-full bg-hover grid place-items-center text-xs font-medium text-ink-2 flex-none" title="Chuyên viên Longca">LC</span>}
              <div className={`grid gap-2.5 min-w-0 flex-1 ${m.from === 'me' ? 'justify-items-end' : 'justify-items-start'}`}>
                {m.from === 'owner' && <span className="text-xs text-ink-3 -mb-1.5"><b className="text-ink">Longca</b> · Chuyên viên</span>}
                {m.from === 'me' ? <p className="bg-soft px-3 py-2 rounded-r2 text-sm whitespace-pre-wrap">{m.text}</p> : <p className="text-sm leading-relaxed pt-px">{m.text}</p>}
                {m.quoteCode && <InlineQuote code={m.quoteCode} />}
                <span className="text-xs text-ink-3">{when(m.t)}</span>
              </div>
            </div>
          ))}
          {typing && <div className="flex gap-2.5 items-center"><Avatar size={28} /><span className="typing inline-flex gap-1 py-2" aria-label="Trợ lý đang trả lời"><i /><i /><i /></span></div>}
          {!typing && !paused && lastChips && (
            <div className="flex flex-wrap gap-1.5 pl-[38px]">
              {lastChips.map((c) => (
                <button key={c} type="button" onClick={() => submit(c)} className="min-h-[30px] max-md:min-h-11 px-2.5 border border-line rounded-r text-[13px] text-ink-2 hover:bg-soft hover:text-ink">{c}</button>
              ))}
            </div>
          )}
          <div ref={end} />
        </div>

        <form className="px-6 pt-3 pb-4 max-md:px-4 w-full max-w-[760px] mx-auto sticky bottom-0 max-md:bottom-[60px] bg-white" onSubmit={(e) => { e.preventDefault(); submit(draft) }}>
          {attachment && (
            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-r border border-line bg-soft px-2.5 py-1.5 text-[13px]">
              <Icon name="file" size={14} />
              <span className="truncate">{attachment.name}</span>
              <span className="text-xs text-ink-3">{attachment.size < 1024 * 1024 ? `${Math.ceil(attachment.size / 1024)} KB` : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}</span>
              <button type="button" onClick={() => { setAttachment(null); if (picker.current) picker.current.value = '' }} aria-label="Bỏ tệp đính kèm" className="size-7 grid place-items-center rounded-r text-ink-3 hover:bg-hover hover:text-ink"><Icon name="x" size={14} /></button>
            </div>
          )}
          <div className="flex items-end gap-0.5 min-h-11 border border-line rounded-r2 focus-within:border-[#d4d4d4] transition-colors bg-white">
            <input ref={picker} type="file" accept="image/*,.pdf,application/pdf" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            <button type="button" onClick={() => picker.current?.click()} aria-label="Đính kèm ảnh hoặc PDF" className="size-[42px] grid place-items-center text-ink-3 hover:text-ink"><Icon name="clip" /></button>
            <button type="button" onClick={voice.toggle} disabled={!voice.supported || typing} aria-label={voice.listening ? 'Dừng nghe' : 'Nhập bằng giọng nói'} aria-pressed={voice.listening} title={voice.supported ? 'Nhập bằng giọng nói' : 'Trình duyệt chưa hỗ trợ giọng nói'} className={`size-[42px] grid place-items-center rounded-r transition-colors disabled:opacity-30 ${voice.listening ? 'bg-accent/10 text-accent live' : 'text-ink-3 hover:text-ink hover:bg-soft'}`}><Icon name="mic" /></button>
            <textarea ref={ta} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(draft) } }} rows={1} placeholder={paused ? 'Nhắn cho chuyên viên…' : 'Nhắn cho trợ lý…'} aria-label="Tin nhắn" className="flex-1 resize-none outline-none bg-transparent py-[11px] px-1 text-sm leading-5 max-h-36 placeholder:text-ink-3" />
            <button type="submit" disabled={(!draft.trim() && !attachment) || typing} aria-label="Gửi" className="size-[34px] max-md:size-[42px] m-1 max-md:m-0 rounded-r bg-accent text-white grid place-items-center hover:bg-accent-ink flex-none disabled:opacity-40"><Icon name="send" size={15} /></button>
          </div>
          {voice.listening && <p role="status" className="text-xs text-accent mt-2 inline-flex gap-1.5 items-center"><span className="size-1.5 rounded-full bg-accent live" />Đang nghe tiếng Việt… Bấm micro để dừng.</p>}
          {voice.error && <p role="alert" className="text-xs text-warn mt-2">{voice.error}</p>}
          {fileError && <p role="alert" className="text-xs text-warn mt-2">{fileError}</p>}
          <p className="text-xs text-ink-3 mt-2 flex gap-1.5 items-center"><Icon name="shield" size={13} /> Nội dung do AI hỗ trợ. Chuyên viên kiểm tra mọi sản phẩm trước khi giao.</p>
        </form>
      </section>

      <aside className="border-l border-line px-5 py-4 grid gap-2.5 content-start self-start sticky top-[53px] max-xl:hidden">
        <div className="flex items-baseline gap-2"><h2 className="text-sm">Brief đang ghi</h2><span className="ml-auto font-mono text-xs text-ink-3">{filled}/{brief.length}</span></div>
        <div className="flex gap-1">{brief.map(([k, v]) => <span key={k} className={`h-1 flex-1 rounded-sm ${v ? 'bg-accent' : 'bg-hover'}`} />)}</div>
        <dl>
          {brief.map(([k, v], i) => (
            <div key={k} className={`grid grid-cols-[84px_1fr] gap-3 py-2 ${i ? 'border-t border-line' : ''}`}>
              <dt className="text-[13px] text-ink-3">{k}</dt>
              <dd className={`text-[13px] break-words ${v ? '' : 'text-ink-3/60'}`}>{v ?? 'Chưa có'}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-3 leading-relaxed">Brief được chuẩn hóa thành JSON gửi cho đội sản xuất sau khi chị thanh toán cọc.</p>
      </aside>
    </div>
  )
}

function InlineQuote({ code }: { code: string }) {
  const db = useMine()
  const q = db.quotes.find((x) => x.code === code)
  if (!q) return null
  const svc = findService(q.service)!
  return (
    <div className="border border-line rounded-r2 p-4 w-full max-w-[420px] grid gap-3.5 bg-white">
      <div className="flex items-baseline gap-2"><b className="text-sm">Báo giá · {svc.name}</b><span className="ml-auto font-mono text-xs text-ink-3">{q.code}</span></div>
      <QuoteLines price={q.price} compact />
      <p className="text-xs text-ink-3">{svc.includedRevisions} lượt sửa miễn phí · giao {q.rush ? 'trong 24 giờ' : `trong ${svc.slaDays} ngày`} · {q.status === 'sent' ? `hiệu lực ${left(q.expiresAt - Date.now())}` : q.status === 'accepted' ? 'đã chấp nhận' : q.status === 'expired' ? 'đã hết hạn' : 'đã từ chối'}</p>
      <div className="flex gap-2 flex-wrap">
        {q.status === 'sent' && <Btn kind="primary" onClick={() => navigate(`/app/bao-gia/${q.code}`)}>Xem & chấp nhận</Btn>}
        {q.status === 'accepted' && q.orderCode && <Btn kind="primary" onClick={() => navigate(`/app/don-hang/${q.orderCode}`)}>Xem đơn {q.orderCode}</Btn>}
        {q.status !== 'sent' && <Btn onClick={() => navigate(`/app/bao-gia/${q.code}`)}>Xem chi tiết</Btn>}
      </div>
    </div>
  )
}
