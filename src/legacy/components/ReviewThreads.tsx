import { useState } from 'react'
import { useVoiceInput } from '../lib/useVoiceInput'
import { useStore, type Order, type ReviewStatus } from '../store'
import { Btn, Icon, when } from '../ui'

const statusCopy: Record<ReviewStatus, string> = {
  open: 'Mới',
  in_progress: 'Đang xử lý',
  fixed: 'Đã sửa',
  confirming: 'Chờ xác nhận',
  resolved: 'Đã đóng',
}
const statusTone: Record<ReviewStatus, string> = {
  open: 'bg-warn',
  in_progress: 'bg-accent',
  fixed: 'bg-ok',
  confirming: 'bg-accent',
  resolved: 'bg-idle',
}

export function ReviewThreads({ o, role, compact = false }: { o: Order; role: 'client' | 'owner'; compact?: boolean }) {
  const { replyReview, setReviewStatus } = useStore()
  const [reply, setReply] = useState<Record<number, string>>({})
  const [voiceFor, setVoiceFor] = useState<number | null>(null)
  const items = o.revisions.flatMap((revision, revisionIndex) => revision.annots.map((annot) => ({ annot, revision, revisionIndex }))).reverse()
  const voice = useVoiceInput((text) => {
    if (voiceFor == null) return
    setReply((all) => ({ ...all, [voiceFor]: [all[voiceFor]?.trim(), text].filter(Boolean).join(' ') }))
  })
  if (!items.length) return null
  const send = (id: number) => {
    const text = reply[id]?.trim()
    if (!text) return
    replyReview(o.code, id, text, role)
    setReply((all) => ({ ...all, [id]: '' }))
    voice.stop()
  }
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline gap-2"><h3 className="text-sm">Trao đổi chỉnh sửa</h3><span className="font-mono text-xs text-ink-3">{items.length} comment</span></div>
      <div className={`grid gap-3 ${compact ? '' : 'max-h-[600px] overflow-auto pr-1'}`}>
        {o.revisions.slice().reverse().map((revision, reverseIndex) => {
          const revisionIndex = o.revisions.length - 1 - reverseIndex
          if (!revision.annots.length) return null
          return (
            <div key={`${revision.t}-${revisionIndex}`} className="grid gap-2">
              <div className="flex items-center gap-2 text-xs text-ink-3"><span>Bản v{revision.version} · {when(revision.t)}</span><span className="lead" /></div>
              {revision.capture && (
                <div className="relative border border-line rounded-r2 overflow-hidden bg-side">
                  <img src={revision.capture} alt={`Capture cho bản v${revision.version}`} className="w-full max-h-52 object-contain object-top" />
                  {revision.annots.filter((a) => (a.asset ?? 0) === (revision.captureAsset ?? 0) && (a.viewport ?? 'desktop') === (revision.viewport ?? 'desktop')).map((a, i) => a.kind === 'region' && a.region ? (
                    <span key={a.id} style={{ left: `${a.region.x}%`, top: `${a.region.y}%`, width: `${a.region.width}%`, height: `${a.region.height}%` }} className="absolute border-2 border-accent bg-accent/10 rounded-r pointer-events-none"><i className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-accent text-white text-[10px] not-italic grid place-items-center">{i + 1}</i></span>
                  ) : (
                    <span key={a.id} style={{ left: `${a.x}%`, top: `${a.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 size-5 rounded-full bg-accent text-white text-[10px] grid place-items-center border border-white shadow pointer-events-none">{i + 1}</span>
                  ))}
                </div>
              )}
              {revision.note && <p className="text-[13px] text-ink-2 italic border-l-2 border-line pl-3">Ghi chú chung: “{revision.note}”</p>}
              {revision.annots.map((a, index) => {
                const status = a.status ?? 'open'
                return (
                  <article key={a.id} className="border border-line rounded-r2 p-3 grid gap-2.5 bg-white">
                    <header className="flex items-center gap-2">
                      <span className="size-6 rounded-full bg-accent text-white text-xs grid place-items-center">{index + 1}</span>
                      <div className="min-w-0 flex-1"><p className="text-[13px] font-medium truncate">{a.assetLabel ?? 'Bản nháp'} · {a.viewport ?? 'desktop'}</p><p className="text-xs text-ink-3">{a.kind === 'region' ? 'Vùng được khoanh' : `Ghim tại ${Math.round(a.x)}%, ${Math.round(a.y)}%`}</p></div>
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-2"><i className={`size-1.5 rounded-full ${statusTone[status]}`} />{statusCopy[status]}</span>
                    </header>
                    <p className="text-[13px] text-ink-2">{a.text}</p>
                    {(a.replies ?? []).length > 0 && (
                      <ol className="grid gap-2 border-l border-line pl-3">
                        {(a.replies ?? []).map((r) => <li key={r.id} className="text-[13px]"><p><b>{r.from === 'owner' ? 'Studio' : 'Khách hàng'}</b> <span className="text-xs text-ink-3">· {when(r.t)}</span></p><p className="text-ink-2">{r.text}</p></li>)}
                      </ol>
                    )}
                    {role === 'owner' ? (
                      <div className="grid gap-2">
                        <label className="flex items-center gap-2 text-xs text-ink-3">Trạng thái
                          <select value={status} onChange={(e) => setReviewStatus(o.code, a.id, e.target.value as ReviewStatus)} className="ml-auto h-8 border border-line rounded-r px-2 text-[13px] text-ink bg-white">
                            {(Object.keys(statusCopy) as ReviewStatus[]).map((s) => <option key={s} value={s}>{statusCopy[s]}</option>)}
                          </select>
                        </label>
                      </div>
                    ) : status === 'confirming' ? (
                      <div className="flex gap-2"><Btn size="s" kind="primary" onClick={() => setReviewStatus(o.code, a.id, 'resolved')}><Icon name="check" size={13} /> Xác nhận đã ổn</Btn><Btn size="s" onClick={() => setReviewStatus(o.code, a.id, 'open')}>Mở lại</Btn></div>
                    ) : null}
                    {status !== 'resolved' && (
                      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); send(a.id) }}>
                        <input value={reply[a.id] ?? ''} onFocus={() => setVoiceFor(a.id)} onChange={(e) => setReply({ ...reply, [a.id]: e.target.value })} placeholder={role === 'owner' ? 'Trả lời khách…' : 'Trao đổi thêm…'} className="min-w-0 flex-1 h-9 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" />
                        <button type="button" onClick={() => { setVoiceFor(a.id); voice.toggle() }} disabled={!voice.supported} aria-label="Nói nội dung trả lời" className={`size-9 rounded-r grid place-items-center disabled:opacity-30 ${voice.listening && voiceFor === a.id ? 'bg-accent/10 text-accent' : 'text-ink-3 hover:bg-soft'}`}><Icon name="mic" size={14} /></button>
                        <Btn size="s" type="submit" disabled={!reply[a.id]?.trim()}>Gửi</Btn>
                      </form>
                    )}
                  </article>
                )
              })}
            </div>
          )
        })}
      </div>
      {voice.error && <p role="alert" className="text-xs text-warn">{voice.error}</p>}
    </section>
  )
}
