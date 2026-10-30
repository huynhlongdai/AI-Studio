import { useState } from 'react'
import { RISKY_ACTIONS, TIERS, type AgentCfg, type DataScope, type Runtime, type Tier } from '../../lib/agents'
import { personas } from '../../lib/catalog'
import { useStore } from '../../store'
import { AIBadge, Avatar, Btn, Icon, Modal, Page, PageHead, vnd, when } from '../../ui'

const DATA: Record<DataScope, string> = { brief: 'Chỉ brief đã ẩn thông tin cá nhân', brief_profile: 'Brief + hồ sơ khách', workspace: 'Kho kiến thức của đúng khách đó' }
const RT_STATUS: Record<Runtime['status'], [string, string]> = { connected: ['Hoạt động', 'bg-ok'], paused: ['Dừng khẩn cấp', 'bg-red-500'], disconnected: ['Chưa kết nối', 'bg-idle'] }

/** Runtime (OpenClaw, Hermes…), phân quyền từng agent, tầng model, nút dừng khẩn cấp. */
export default function AgentOps() {
  const { db, stopAll, resetSpend } = useStore()
  const [edit, setEdit] = useState<AgentCfg | null>(null)
  const [conn, setConn] = useState<Runtime | null>(null)
  const [add, setAdd] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const running = db.orders.filter((o) => o.status === 'active' && ['running', 'submitted', 'qc_review', 'revision_requested'].includes(o.job))
  const blocked = running.filter((o) => { const a = db.agents.find((x) => x.id === (['submitted', 'qc_review'].includes(o.job) ? 'lan' : personaOf(o.service))); const r = a && db.runtimes.find((x) => x.id === a.runtime); return a && r && (!a.enabled || r.status !== 'connected' || a.spentToday >= a.capDay) })
  const spent = db.agents.reduce((s, a) => s + a.spentToday, 0)

  return (
    <Page max={1280}>
      <PageHead title="Runtime & agent" sub="Kết nối nơi agent chạy, cấp quyền từng agent, giới hạn chi phí. Mọi thay đổi có hiệu lực ngay."
        end={<Btn onClick={() => setConfirmStop(true)} className="!text-red-600 !border-red-200 hover:!bg-red-50"><Icon name="x" size={14} /> Dừng khẩn cấp tất cả</Btn>} />

      {blocked.length > 0 && <p className="text-[13px] bg-warn/10 rounded-r2 px-4 py-2.5">{blocked.length} việc đang bị giữ lại do agent tắt, runtime dừng hoặc vượt trần chi phí ngày: {blocked.map((o) => o.code).join(', ')}.</p>}

      <section className="grid gap-3">
        <div className="flex items-baseline gap-2"><h2 className="text-sm">Runtime</h2><span className="text-[13px] text-ink-3">{db.runtimes.filter((r) => r.status === 'connected').length}/{db.runtimes.length} hoạt động</span><button type="button" onClick={() => setAdd(true)} className="ml-auto text-[13px] font-medium text-accent min-h-8">+ Thêm runtime (A2A / MCP)</button></div>
        <ul className="grid grid-cols-3 max-lg:grid-cols-1 gap-3">
          {db.runtimes.map((r) => {
            const [label, dot] = RT_STATUS[r.status]
            const users = db.agents.filter((a) => a.runtime === r.id)
            return (
              <li key={r.id} className={`border rounded-r2 p-4 grid gap-3 content-start ${r.status === 'paused' ? 'border-red-200 bg-red-50/40' : 'border-line'}`}>
                <div className="flex items-center gap-2"><span className="size-8 rounded-r bg-ink text-white grid place-items-center font-mono text-xs">{r.kind === 'openclaw' ? 'OC' : r.kind === 'hermes' ? 'HM' : 'SB'}</span><div className="min-w-0"><h3 className="text-sm">{r.name}</h3><p className="text-xs text-ink-3 truncate font-mono">{r.endpoint || 'chưa cấu hình'}</p></div><span className="ml-auto inline-flex items-center gap-1.5 text-xs whitespace-nowrap"><span className={`size-1.5 rounded-full ${dot}`} />{label}</span></div>
                <p className="text-xs text-ink-3">{r.note}</p>
                {r.status !== 'disconnected' && <p className="text-xs text-ink-3 font-mono">Tín hiệu {when(r.lastBeat)} · {r.latencyMs}ms · khóa {r.keyHint}</p>}
                {r.tools.length > 0 && <div className="flex flex-wrap gap-1">{r.tools.map((t) => <span key={t} className="font-mono text-[11px] border border-line rounded px-1.5 py-0.5 text-ink-2">{t}</span>)}</div>}
                <p className="text-xs text-ink-3">{users.length ? `Đang dùng bởi: ${users.map((a) => a.name).join(', ')}` : 'Chưa có agent nào dùng'}</p>
                <RuntimeActions r={r} onConnect={() => setConn(r)} />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="grid gap-3">
        <div className="flex items-baseline gap-2"><h2 className="text-sm">Agent</h2><span className="text-[13px] text-ink-3">Chi phí hôm nay {vnd(spent)}</span><button type="button" onClick={resetSpend} className="ml-auto text-[13px] text-ink-3 hover:text-ink min-h-8">Đặt lại bộ đếm ngày</button></div>
        <div className="overflow-x-auto border border-line rounded-r2">
          <table className="w-full text-[13px] border-collapse min-w-[920px]">
            <thead><tr className="text-left text-xs text-ink-3 border-b border-line [&>th]:font-normal [&>th]:py-2.5 [&>th]:px-3"><th>Agent</th><th>Runtime</th><th>Tầng model</th><th>Quyền dữ liệu</th><th>Tool</th><th>Chi phí ngày</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{db.agents.map((a) => {
              const rt = db.runtimes.find((r) => r.id === a.runtime)
              const pct = Math.min(100, (a.spentToday / a.capDay) * 100)
              return (
                <tr key={a.id} className="border-b border-line last:border-0 [&>td]:py-2.5 [&>td]:px-3 align-middle">
                  <td><div className="flex items-center gap-2.5">{a.id in personas ? <Avatar id={a.id} size={26} /> : <Avatar size={26} />}<div><p className="font-medium flex items-center gap-1.5">{a.name}{a.customerFacing && <span className="text-[11px] text-ink-3 border border-line rounded px-1">gặp khách</span>}</p><p className="text-xs text-ink-3">{a.role}</p></div></div></td>
                  <td className="text-ink-2">{rt?.name ?? '—'}{rt && rt.status !== 'connected' && <span className="block text-xs text-red-600">{RT_STATUS[rt.status][0]}</span>}</td>
                  <td><span className="font-medium">{TIERS[a.tier].label}</span>{a.autoEscalate && <span className="block text-xs text-ink-3">tự nâng tầng khi QC trượt</span>}</td>
                  <td className="text-ink-2 text-xs max-w-44">{DATA[a.data]}</td>
                  <td className="text-xs text-ink-3">{a.tools.length} tool{a.approval.length > 0 && <span className="block">{a.approval.length} hành động cần duyệt</span>}</td>
                  <td className="w-36"><div className="h-1 bg-hover rounded-sm overflow-hidden"><i className={`block h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div><span className="text-xs text-ink-3 font-mono">{vnd(a.spentToday)} / {vnd(a.capDay)}</span></td>
                  <td>{a.enabled ? <span className="inline-flex items-center gap-1.5 text-xs"><span className="size-1.5 rounded-full bg-ok" />Bật</span> : <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><span className="size-1.5 rounded-full bg-idle" />Tắt</span>}</td>
                  <td className="text-right"><Btn size="s" onClick={() => setEdit(a)}>Cấu hình</Btn></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm">Tầng model & tối ưu credit</h2>
        <ul className="grid grid-cols-3 max-lg:grid-cols-1 gap-3">
          {(Object.keys(TIERS) as Tier[]).map((t) => (
            <li key={t} className="border border-line rounded-r2 p-4 grid gap-1.5 content-start">
              <div className="flex items-baseline gap-2"><h3 className="text-sm">{TIERS[t].label}</h3><span className="ml-auto font-mono text-xs text-ink-3">~{vnd(TIERS[t].costPer1k)} / 1k token</span></div>
              <p className="text-xs text-ink-3">{TIERS[t].use}</p>
              <p className="text-[13px]">{TIERS[t].models.join(' · ')}</p>
              <p className="text-xs text-ink-3">{db.agents.filter((a) => a.tier === t).map((a) => a.name).join(', ') || 'Chưa agent nào'}</p>
            </li>
          ))}
        </ul>
        <ol className="grid gap-1.5 text-[13px] text-ink-2 list-decimal pl-5 marker:text-ink-3">
          <li>Bắt đầu ở tầng cấu hình của agent; câu hỏi lặp lại dùng cache, không gọi model.</li>
          <li>QC trượt → tự nâng một tầng (nếu bật) và ghi nhận để lần sau loại việc đó đi thẳng tầng trên.</li>
          <li>Chạm 80% trần chi phí job → cảnh báo; 100% → giữ việc, báo chuyên viên. Không bao giờ hạ chất lượng dưới ngưỡng QC để tiết kiệm.</li>
        </ol>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm">Nhật ký thay đổi</h2>
        {db.audit.length === 0 ? <p className="text-[13px] text-ink-3">Chưa có thay đổi.</p> : (
          <ol className="border border-line rounded-r2 divide-y divide-line max-h-80 overflow-auto">
            {db.audit.slice(0, 60).map((x) => (
              <li key={x.id} className="grid grid-cols-[80px_90px_1fr] max-md:grid-cols-[72px_1fr] gap-3 px-4 py-2 text-[13px]">
                <time className="font-mono text-xs text-ink-3 pt-px">{when(x.t)}</time>
                <span className="text-xs text-ink-3 max-md:hidden">{x.actor === 'admin' ? 'Chuyên viên' : x.actor === 'client' ? 'Khách' : 'Hệ thống'}</span>
                <span className="text-ink-2">{x.text}{x.customer && <span className="text-ink-3"> · {db.customers.find((c) => c.id === x.customer)?.name}</span>}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {edit && <AgentEditor key={edit.id} a={edit} onClose={() => setEdit(null)} />}
      {conn && <ConnectRuntime r={conn} onClose={() => setConn(null)} />}
      {add && <AddRuntime onClose={() => setAdd(false)} />}
      {confirmStop && (
        <Modal title="Dừng khẩn cấp tất cả runtime sản xuất?" onClose={() => setConfirmStop(false)}>
          <p className="text-[13px] text-ink-2">Mọi agent trên OpenClaw và runtime khác ngừng nhận và thực hiện việc ngay. Việc đang chạy được giữ nguyên trạng thái để tiếp tục sau. Trợ lý tiếp nhận và agent bán hàng (sandbox) vẫn trả lời khách.</p>
          <div className="flex gap-2 justify-end"><Btn onClick={() => setConfirmStop(false)}>Hủy</Btn><Btn kind="primary" className="!bg-red-600 hover:!bg-red-700" onClick={() => { stopAll(); setConfirmStop(false) }}>Dừng tất cả</Btn></div>
        </Modal>
      )}
    </Page>
  )
}

const personaOf = (s: string) => ({ logo: 'mai', post: 'mai', video: 'khoa', landing: 'minh' } as Record<string, string>)[s]

function RuntimeActions({ r, onConnect }: { r: Runtime; onConnect: () => void }) {
  const { pingRuntime, setRuntimeStatus } = useStore()
  if (r.status === 'disconnected') return <Btn kind="primary" onClick={onConnect}>Kết nối</Btn>
  return (
    <div className="flex gap-2 flex-wrap">
      <Btn size="s" onClick={() => pingRuntime(r.id)}>Kiểm tra kết nối</Btn>
      {r.status === 'connected' && r.id !== 'portal' && <Btn size="s" className="!text-red-600" onClick={() => setRuntimeStatus(r.id, 'paused')}>Dừng khẩn cấp</Btn>}
      {r.status === 'paused' && <Btn size="s" kind="primary" onClick={() => setRuntimeStatus(r.id, 'connected')}>Cho chạy lại</Btn>}
      {r.id !== 'portal' && <Btn size="s" kind="plain" onClick={() => setRuntimeStatus(r.id, 'disconnected')}>Ngắt</Btn>}
    </div>
  )
}

function ConnectRuntime({ r, onClose }: { r: Runtime; onClose: () => void }) {
  const { connectRuntime } = useStore()
  const [url, setUrl] = useState(r.endpoint || (r.kind === 'hermes' ? 'https://hermes.instabox.tech/a2a' : 'https://'))
  const [key, setKey] = useState('')
  const [step, setStep] = useState<'form' | 'check'>('form')
  const ok = /^https:\/\/.+/.test(url) && key.length >= 8
  return (
    <Modal title={`Kết nối ${r.name}`} onClose={onClose}>
      {step === 'form' ? (
        <>
          <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Endpoint (A2A hoặc MCP qua HTTPS)</span><input value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 px-2.5 border border-line rounded-r font-mono text-xs outline-none focus:border-accent" /></label>
          <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Khóa truy cập</span><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Tối thiểu 8 ký tự" className="h-9 px-2.5 border border-line rounded-r font-mono text-xs outline-none focus:border-accent" /></label>
          <p className="text-xs text-ink-3">Khóa được mã hóa trong kho bí mật, chỉ hiện 4 ký tự cuối sau khi lưu. Không chia sẻ khóa của gateway có tool sản xuất cho agent gặp khách.</p>
          <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={!ok} onClick={() => { setStep('check'); setTimeout(() => { connectRuntime(r.id, url, key); onClose() }, 1200) }}>Kết nối & đọc năng lực</Btn></div>
        </>
      ) : <p className="text-[13px] text-ink-2 inline-flex items-center gap-2"><span className="size-2 rounded-full bg-accent live" /> Đang bắt tay, đọc Agent Card và danh sách tool…</p>}
    </Modal>
  )
}

function AddRuntime({ onClose }: { onClose: () => void }) {
  const { addRuntime } = useStore()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  return (
    <Modal title="Thêm runtime" onClose={onClose}>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Tên</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Provider thiết kế ngoài" className="h-9 px-2.5 border border-line rounded-r outline-none focus:border-accent" /></label>
      <label className="grid gap-1.5 text-[13px]"><span className="text-ink-3">Endpoint</span><input value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 px-2.5 border border-line rounded-r font-mono text-xs outline-none focus:border-accent" /></label>
      <p className="text-xs text-ink-3">Runtime bên thứ ba chạy trên hạ tầng riêng; chỉ nhận brief đã ẩn thông tin cá nhân.</p>
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={name.trim().length < 2} onClick={() => { addRuntime(name.trim(), url); onClose() }}>Thêm</Btn></div>
    </Modal>
  )
}

function AgentEditor({ a, onClose }: { a: AgentCfg; onClose: () => void }) {
  const { db, saveAgent } = useStore()
  const [f, setF] = useState<AgentCfg>(a)
  const rt = db.runtimes.find((r) => r.id === f.runtime)
  const allowedRuntimes = db.runtimes.filter((r) => (f.customerFacing ? r.id === 'portal' : r.id !== 'portal'))
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const money = (v: string) => Math.max(0, Number(v.replace(/\D/g, '')) || 0)
  return (
    <Modal wide title={<span className="inline-flex items-center gap-2">Cấu hình {f.name} <AIBadge /></span>} onClose={onClose}>
      <div className="grid gap-4 text-[13px]">
        <label className="flex items-center gap-3"><span className="flex-1"><b>Bật agent</b><span className="block text-xs text-ink-3">Tắt: việc của agent được giữ lại, không mất dữ liệu.</span></span>
          <button type="button" role="switch" aria-checked={f.enabled} onClick={() => setF({ ...f, enabled: !f.enabled })} className={`w-9 h-5 rounded-full relative ${f.enabled ? 'bg-accent' : 'bg-[#d4d4d4]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${f.enabled ? 'left-[18px]' : 'left-0.5'}`} /></button></label>
        <label className="grid gap-1.5"><span className="text-ink-3">Runtime</span>
          <select value={f.runtime} onChange={(e) => setF({ ...f, runtime: e.target.value, tools: [] })} className="h-9 px-2 border border-line rounded-r">{allowedRuntimes.map((r) => <option key={r.id} value={r.id}>{r.name}{r.status !== 'connected' ? ' (chưa hoạt động)' : ''}</option>)}</select>
          {f.customerFacing && <span className="text-xs text-ink-3">Agent gặp khách chỉ được chạy trong sandbox portal.</span>}</label>
        <fieldset className="grid gap-1.5"><legend className="text-ink-3 mb-1">Tầng model</legend>
          <div className="grid grid-cols-3 gap-2">{(Object.keys(TIERS) as Tier[]).map((t) => <label key={t} className={`border rounded-r p-2.5 cursor-pointer ${f.tier === t ? 'border-accent' : 'border-line'}`}><input type="radio" className="sr-only" checked={f.tier === t} onChange={() => setF({ ...f, tier: t })} /><b className="block">{TIERS[t].label}</b><span className="text-xs text-ink-3">{TIERS[t].models[0]}</span></label>)}</div>
          <label className="flex gap-2 items-center mt-1"><input type="checkbox" checked={f.autoEscalate} onChange={(e) => setF({ ...f, autoEscalate: e.target.checked })} className="accent-accent" /> Tự nâng tầng khi QC trượt</label>
        </fieldset>
        <fieldset className="grid gap-1"><legend className="text-ink-3 mb-1">Tool được phép ({rt?.name})</legend>
          {(rt?.tools ?? []).length === 0 ? <p className="text-xs text-ink-3">Runtime chưa khai báo tool nào.</p> : <div className="flex flex-wrap gap-1.5">{rt!.tools.map((t) => <label key={t} className={`font-mono text-xs border rounded px-2 py-1 cursor-pointer ${f.tools.includes(t) ? 'border-accent text-accent' : 'border-line text-ink-3'}`}><input type="checkbox" className="sr-only" checked={f.tools.includes(t)} onChange={() => setF({ ...f, tools: toggle(f.tools, t) })} />{t}</label>)}</div>}
        </fieldset>
        <fieldset className="grid gap-1"><legend className="text-ink-3 mb-1">Quyền dữ liệu</legend>
          {(Object.keys(DATA) as DataScope[]).map((k) => <label key={k} className="flex gap-2 items-center min-h-8"><input type="radio" checked={f.data === k} onChange={() => setF({ ...f, data: k })} className="accent-accent" />{DATA[k]}</label>)}
        </fieldset>
        <fieldset className="grid gap-1"><legend className="text-ink-3 mb-1">Hành động phải có người duyệt</legend>
          {RISKY_ACTIONS.map((x) => <label key={x} className="flex gap-2 items-center min-h-8"><input type="checkbox" checked={f.approval.includes(x)} onChange={() => setF({ ...f, approval: toggle(f.approval, x) })} className="accent-accent" />{x}</label>)}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5"><span className="text-ink-3">Trần chi phí mỗi job</span><input value={f.capJob.toLocaleString('vi-VN')} onChange={(e) => setF({ ...f, capJob: money(e.target.value) })} className="h-9 px-2.5 border border-line rounded-r font-mono text-right" /></label>
          <label className="grid gap-1.5"><span className="text-ink-3">Trần chi phí mỗi ngày</span><input value={f.capDay.toLocaleString('vi-VN')} onChange={(e) => setF({ ...f, capDay: money(e.target.value) })} className="h-9 px-2.5 border border-line rounded-r font-mono text-right" /></label>
        </div>
      </div>
      <div className="flex gap-2 justify-end"><Btn onClick={onClose}>Hủy</Btn><Btn kind="primary" disabled={f.capDay < 10_000} onClick={() => { saveAgent(f); onClose() }}>Lưu cấu hình</Btn></div>
    </Modal>
  )
}
