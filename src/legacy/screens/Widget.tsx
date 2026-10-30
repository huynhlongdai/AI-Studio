import { useEffect, useRef, useState } from 'react'
import { useVoiceInput } from '../lib/useVoiceInput'
import { useStore, customerName } from '../store'
import { Icon } from '../ui'

/** Widget chat công khai trên website của shop — đúng thứ người mua thấy. Chỉ dùng kiến thức đã duyệt. */
export default function Widget({ customer }: { customer: string }) {
  const { db, buyerChat } = useStore()
  const a = db.sales.find((x) => x.customer === customer)
  const name = customerName(db, customer)
  const [log, setLog] = useState<{ me: boolean; text: string }[]>([{ me: false, text: `Dạ em chào mình, em là trợ lý của ${name}. Mình cần em tư vấn gì ạ?` }])
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(true)
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const voice = useVoiceInput((text) => {
    setMsg((current) => [current.trim(), text].filter(Boolean).join(' '))
    input.current?.focus()
  })
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [log])
  const send = (t: string) => {
    voice.stop()
    const hist = log.filter((l) => l.me).map((l) => l.text).concat(t)
    const r = buyerChat(customer, t, hist)
    setLog((l) => [...l, { me: true, text: t }, { me: false, text: r.text }])
  }
  return (
    <div className="min-h-dvh bg-soft">
      <div className="max-w-3xl mx-auto p-8 max-md:p-4 grid gap-3 text-ink-3">
        <p className="text-xs font-mono">Bản xem trước · website {name}</p>
        <div className="h-40 rounded-r2 bg-white border border-line" /><div className="h-24 rounded-r2 bg-white border border-line" /><div className="h-24 w-2/3 rounded-r2 bg-white border border-line" />
      </div>
      {open ? (
        <section className="fixed bottom-4 right-4 max-sm:inset-x-2 max-sm:bottom-2 w-[360px] max-sm:w-auto h-[520px] max-h-[80dvh] bg-white border border-line rounded-[14px] shadow-[0_16px_40px_-16px_rgb(0_0_0/.3)] grid grid-rows-[auto_1fr_auto] overflow-hidden" aria-label={`Chat với ${name}`}>
          <header className="flex items-center gap-2.5 p-3 border-b border-line"><span className="size-8 rounded-full bg-ink text-white grid place-items-center text-xs font-medium">{name.split(' ').map((w) => w[0]).slice(-2).join('')}</span><div className="min-w-0"><p className="text-sm font-medium leading-tight">{name}</p><p className="text-xs text-ink-3">{a?.status === 'live' ? 'Trả lời ngay · trợ lý tự động' : 'Chế độ xem trước'}</p></div><button type="button" onClick={() => { voice.stop(); setOpen(false) }} aria-label="Thu nhỏ" className="ml-auto size-9 grid place-items-center rounded-r hover:bg-soft"><Icon name="x" /></button></header>
          <div className="overflow-auto p-3 grid gap-2 content-start">
            {log.map((l, i) => <p key={i} className={`text-[13px] rounded-[12px] px-3 py-2 max-w-[85%] ${l.me ? 'bg-ink text-white justify-self-end' : 'bg-soft'}`}>{l.text}</p>)}
            <div ref={end} />
          </div>
          <form className="p-2.5 border-t border-line grid gap-1.5" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { send(msg.trim()); setMsg('') } }}>
            <div className="flex gap-1.5">
              <input ref={input} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={voice.listening ? 'Đang nghe tiếng Việt…' : 'Nhập tin nhắn…'} className="flex-1 min-w-0 h-10 px-3 border border-line rounded-full text-[13px] outline-none focus:border-accent" />
              <button type="button" onClick={voice.toggle} disabled={!voice.supported} aria-label={voice.listening ? 'Dừng nghe' : 'Nhập bằng giọng nói'} aria-pressed={voice.listening} title={voice.supported ? 'Nhập bằng giọng nói' : 'Trình duyệt chưa hỗ trợ giọng nói'} className={`size-10 rounded-full grid place-items-center flex-none transition-colors disabled:opacity-30 ${voice.listening ? 'bg-accent/10 text-accent live' : 'text-ink-3 hover:bg-soft hover:text-ink'}`}><Icon name="mic" size={17} /></button>
              <button type="submit" disabled={!msg.trim()} aria-label="Gửi" className="size-10 rounded-full bg-accent text-white grid place-items-center flex-none disabled:opacity-40"><Icon name="arrow" size={16} /></button>
            </div>
            {voice.error && <p role="alert" className="text-[11px] text-warn text-center">{voice.error}</p>}
            <p className="text-[11px] text-ink-3 text-center">Trợ lý AI có thể nhầm. Số điện thoại chỉ được lưu khi bạn đồng ý.</p>
          </form>
        </section>
      ) : <button type="button" onClick={() => setOpen(true)} aria-label="Mở chat" className="fixed bottom-4 right-4 size-14 rounded-full bg-accent text-white grid place-items-center shadow-lg"><Icon name="chat" size={22} /></button>}
    </div>
  )
}
