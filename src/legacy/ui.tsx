import type { ReactNode } from 'react'
import { personas } from './lib/catalog'
import type { Tone } from './store'

const paths: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  grid: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  card: <><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></>,
  box: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
  spark: <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z" />,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  clip: <path d="m21.4 11-8.6 8.6a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8-8" />,
  check: <path d="M20 6 9 17l-5-5" />,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  back: <path d="m15 18-6-6 6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  file: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h6" /></>,
  phone: <><rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" /></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" /><path d="M8 22h8" /></>,
  camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z" /><circle cx="12" cy="13" r="3.5" /></>,
  region: <><path d="M4 9V4h5" /><path d="M15 4h5v5" /><path d="M20 15v5h-5" /><path d="M9 20H4v-5" /></>,
  desktop: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>,
  tablet: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
  split: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M12 3v18" /></>,
}

export function Icon({ name, size = 16, className = '' }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={`flex-none ${className}`} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

export function Btn({ kind = 'ghost', size = 'm', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'plain'; size?: 's' | 'm' | 'l' }) {
  const k = {
    primary: 'bg-accent text-white hover:bg-accent-ink',
    ghost: 'bg-white border-line text-ink hover:bg-soft',
    plain: 'text-ink-2 hover:bg-soft hover:text-ink',
  }[kind]
  const s = { s: 'min-h-7 px-2.5 max-md:min-h-11', m: 'min-h-8 px-3 max-md:min-h-11', l: 'min-h-11 px-4 text-sm' }[size]
  return <button type="button" {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-r border border-transparent text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${k} ${s} ${className}`} />
}

const stColor: Record<Tone, string> = { run: 'bg-accent', done: 'bg-ok', wait: 'bg-warn', queue: 'bg-idle', stop: 'bg-red-500' }
export function StatusDot({ status, children }: { status: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[7px] text-[13px] text-ink-2 whitespace-nowrap">
      <span className={`size-1.5 rounded-full ${stColor[status]}`} />
      {children}
    </span>
  )
}

export function Avatar({ id, size = 28 }: { id?: string | null; size?: number }) {
  const p = id && id in personas ? personas[id as keyof typeof personas] : null
  if (p) return <img src={p.img} alt="" width={size} height={size} className="rounded-full object-cover flex-none" style={{ width: size, height: size }} />
  return (
    <span className="rounded-full bg-ink text-white grid place-items-center flex-none" style={{ width: size, height: size }}>
      <Icon name="spark" size={Math.round(size * 0.46)} />
    </span>
  )
}

export function AIBadge() {
  return <span className="font-mono text-[11px] text-ink-3 border border-line rounded px-1 leading-4">AI</span>
}

export function Box({ title, count, action, children, className = '' }: { title?: ReactNode; count?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-line rounded-r2 min-w-0 bg-white ${className}`}>
      {title && (
        <header className="flex items-baseline gap-2 px-4 py-3 border-b border-line">
          <h2 className="text-sm">{title}</h2>
          {count != null && <span className="text-[13px] text-ink-3 tabular-nums">{count}</span>}
          {action && <div className="ml-auto">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Bar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-1 rounded-sm bg-hover overflow-hidden">
        <i className="block h-full rounded-sm bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-ink-3 w-9 text-right">{pct}%</span>
    </div>
  )
}

export function Empty({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="p-4 grid justify-items-start gap-2 text-[13px] text-ink-3">
      <p>{text}</p>
      {cta}
    </div>
  )
}

export function SkRows({ n = 3 }: { n?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="sk size-7 rounded-full" />
          <div className="flex-1 grid gap-[7px]">
            <span className="sk h-3 w-2/5" />
            <span className="sk h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageHead({ title, sub, end, back }: { title: ReactNode; sub?: ReactNode; end?: ReactNode; back?: () => void }) {
  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div className="min-w-0">
        {back && (
          <button type="button" onClick={back} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink mb-1.5 -ml-1 min-h-7">
            <Icon name="back" size={14} /> Quay lại
          </button>
        )}
        <h1 className="text-xl">{title}</h1>
        {sub && <p className="text-[13px] text-ink-3 mt-0.5">{sub}</p>}
      </div>
      {end && <div className="ml-auto max-sm:ml-0 max-sm:w-full flex gap-2 max-sm:[&>*]:flex-1">{end}</div>}
    </div>
  )
}

export const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'
export function when(t: number) {
  const d = new Date(t), now = new Date()
  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return hm
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Hôm qua ${hm}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`
}
export const day = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
export function left(ms: number) {
  if (ms <= 0) return 'đã hết hạn'
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000)
  return h ? `còn ${h} giờ ${m} phút` : `còn ${m} phút`
}

export function Modal({ title, children, onClose, wide = false }: { title: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center p-4 bg-ink/40" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className={`enter w-full ${wide ? 'max-w-[560px]' : 'max-w-[420px]'} bg-white border border-line rounded-r2 p-5 grid gap-4 relative max-h-[90dvh] overflow-auto`} onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Đóng" onClick={onClose} className="absolute top-2 right-2 size-10 grid place-items-center rounded-r text-ink-3 hover:bg-soft"><Icon name="x" /></button>
        <h2 className="text-base pr-8">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-5 border-b border-line overflow-x-auto no-scrollbar">
      {items.map((i) => (
        <button key={i.id} role="tab" type="button" aria-selected={value === i.id} onClick={() => onChange(i.id)} className={`relative pb-2.5 pt-1 text-[13px] whitespace-nowrap min-h-9 max-md:min-h-11 ${value === i.id ? 'text-ink font-medium after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink' : 'text-ink-3 hover:text-ink'}`}>{i.label}</button>
      ))}
    </div>
  )
}

export const Page = ({ children, max = 1080 }: { children: ReactNode; max?: number }) => (
  <div className="px-8 pt-7 pb-14 max-md:px-4 max-md:pt-5 flex flex-col gap-7 w-full" style={{ maxWidth: max }}>{children}</div>
)
