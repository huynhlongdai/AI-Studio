import { useState } from 'react'
import { CHANNELS, KKIND, type KKind } from '../../lib/agents'
import { navigate } from '../../router'
import { customerName, useStore } from '../../store'
import { Btn, Modal, Page, PageHead, Tabs, vnd, when } from '../../ui'

/** Chuyên viên xem agent bán hàng của một khách để hỗ trợ khi khách nhờ. Không sửa trực tiếp kiến thức đã duyệt. */
export default function SalesAgentDetail({ customer }: { customer: string }) {
  const { db, resolveHelp, staffSuggest } = useStore()
  const a = db.sales.find((x) => x.customer === customer)
  const [tab, setTab] = useState<'help' | 'kb' | 'lead'>('help')
  const [reply, setReply] = useState<Record<string, string>>({})
  const [add, setAdd] = useState(false)
  if (!a) return <Page><PageHead title="Không tìm thấy agent" back={() => navigate('/admin/agent-khach')} /></Page>
  const open = (a.help ?? []).filter((h) => h.status === 'open').length
  return (
    <Page max={1080}>
      <PageHead title={`${a.name}`} back={() => navigate('/admin/agent-khach')} sub={`${customerName(db, customer)} · ${a.conv.toLocaleString('vi-VN')} hội thoại · ${a.channels.filter((c) => c.connected).map((c) => CHANNELS[c.id].name).join(', ') || 'chưa kết nối kênh'}${a.terms ? ` · ${vnd(a.terms.monthly)}/tháng` : ''}`} end={<Btn kind="primary" onClick={() => setAdd(true)}>Soạn kiến thức giúp khách</Btn>} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'help', label: `Yêu cầu hỗ trợ${open ? ` (${open})` : ''}` }, { id: 'kb', label: `Kiến thức (${a.knowledge.length})` }, { id: 'lead', label: `Lead (${a.leads.length})` }]} />
      {tab === 'help' && (
        <ul className="grid gap-3">
          {(a.help ?? []).length === 0 && <li className="text-[13px] text-ink-3">Khách chưa nhờ hỗ trợ.</li>}
          {(a.help ?? []).map((h) => (
            <li key={h.id} className={`border rounded-r2 p-4 grid gap-2 text-[13px] ${h.status === 'open' ? 'border-accent/40' : 'border-line'}`}>
              <p><span className="text-xs text-ink-3">{when(h.t)} · </span>{h.text}</p>
              {h.status === 'done' ? <p className="text-ink-2 bg-soft rounded-r px-2.5 py-1.5"><b className="text-xs">{h.by}:</b> {h.reply}</p> : (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const r = reply[h.id]?.trim(); if (r) resolveHelp(customer, h.id, r) }}>
                  <input value={reply[h.id] ?? ''} onChange={(e) => setReply({ ...reply, [h.id]: e.target.value })} placeholder="Trả lời khách…" className="flex-1 h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" />
                  <Btn type="submit" kind="primary" disabled={!reply[h.id]?.trim()}>Gửi & đóng</Btn>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {tab === 'kb' && (
        <ul className="border border-line rounded-r2 divide-y divide-line">
          {a.knowledge.map((k) => <li key={k.id} className="p-3 grid gap-0.5 text-[13px]"><p className="text-xs text-ink-3">{KKIND[k.kind]} · {k.status === 'approved' ? 'đã duyệt' : k.status === 'proposed' ? 'chờ khách duyệt' : 'khách bỏ qua'} · {k.source}</p><b className="font-medium">{k.title}</b><p className="text-ink-2">{k.body || '—'}</p></li>)}
        </ul>
      )}
      {tab === 'lead' && (
        <ul className="border border-line rounded-r2 divide-y divide-line">
          {a.leads.map((l) => <li key={l.id} className="p-3 text-[13px] flex gap-3"><div className="flex-1 min-w-0"><b className="font-medium">{l.name}</b> <span className="text-xs text-ink-3">· {CHANNELS[l.channel].name} · {when(l.t)}</span><p className="text-xs text-ink-3 truncate">{l.need}</p></div><span className="text-xs text-ink-3">SĐT ẩn với studio</span></li>)}
          {a.leads.length === 0 && <li className="p-4 text-[13px] text-ink-3">Chưa có lead.</li>}
        </ul>
      )}
      {add && <Suggest onClose={() => setAdd(false)} onAdd={(x) => { staffSuggest(customer, x); setAdd(false); setTab('kb') }} />}
    </Page>
  )
}

function Suggest({ onClose, onAdd }: { onClose: () => void; onAdd: (x: { kind: KKind; title: string; body: string }) => void }) {
  const [kind, setKind] = useState<KKind>('scenario')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  return (
    <Modal title="Soạn kiến thức giúp khách" onClose={onClose}>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Loại</span><select value={kind} onChange={(e) => setKind(e.target.value as KKind)} className="h-9 px-2 border border-line rounded-r">{(Object.keys(KKIND) as KKind[]).map((x) => <option key={x} value={x}>{KKIND[x]}</option>)}</select></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Tiêu đề</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Câu trả lời</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="border border-line rounded-r p-2.5 outline-none focus:border-accent" /></label>
      <p className="text-xs text-ink-3">Gửi ở trạng thái đề xuất — khách duyệt rồi agent mới dùng.</p>
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={!title.trim() || !body.trim()} onClick={() => onAdd({ kind, title: title.trim(), body: body.trim() })}>Gửi đề xuất</Btn></div>
    </Modal>
  )
}
