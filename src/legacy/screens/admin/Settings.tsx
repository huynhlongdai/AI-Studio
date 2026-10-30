import { useState } from 'react'
import { personas } from '../../lib/catalog'
import { navigate } from '../../router'
import { defaultSettings, useStore, type Settings as S } from '../../store'
import { AIBadge, Avatar, Btn, Icon, Modal, Page, PageHead } from '../../ui'
import { logoutAppUser } from '@/app/(frontend)/actions/appAuth'

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_240px] max-sm:grid-cols-1 gap-x-6 gap-y-1.5 py-3 border-t border-line first:border-t-0 items-center"><div><p className="text-[13px] font-medium">{label}</p>{hint && <p className="text-xs text-ink-3">{hint}</p>}</div><div>{children}</div></div>
)
const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-label={label} aria-checked={on} onClick={() => onChange(!on)} className={`w-9 h-5 rounded-full relative transition-colors ${on ? 'bg-accent' : 'bg-[#d4d4d4]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} /></button>
)

export default function Settings() {
  const { db, saveSettings, reset, adminLogout } = useStore()
  const [f, setF] = useState<S>(db.settings)
  const [saved, setSaved] = useState(false)
  const [wipe, setWipe] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(db.settings)
  const set = <K extends keyof S>(k: K, v: S[K]) => { setF({ ...f, [k]: v }); setSaved(false) }
  const num = (k: keyof S, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Math.min(max, Math.max(min, Number(e.target.value.replace(/\D/g, '')) || 0)) as never)
  const field = 'h-8 max-md:h-11 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent w-full'
  return (
    <Page max={880}>
      <PageHead title="Cài đặt" sub="Áp dụng cho báo giá và thanh toán mới; không thay đổi đơn đã tạo." end={<Btn kind="plain" onClick={async () => { await logoutAppUser(); adminLogout(); navigate('/admin/dang-nhap') }}>Đăng xuất</Btn>} />

      <section className="border border-line rounded-r2 px-5 py-2"><h2 className="text-sm pt-3 pb-1">Thanh toán</h2>
        <Row label="Tỷ lệ cọc" hint="D2 · đề xuất 50%"><div className="flex items-center gap-2"><input type="range" min={20} max={100} step={10} value={f.depositPct} onChange={(e) => set('depositPct', Number(e.target.value))} className="flex-1 accent-accent" aria-label="Tỷ lệ cọc" /><span className="font-mono text-[13px] w-10 text-right">{f.depositPct}%</span></div></Row>
        <Row label="Đơn nhỏ trả 100%" hint="Đơn dưới mức này thu đủ một lần"><input value={f.smallOrder.toLocaleString('vi-VN')} onChange={num('smallOrder', 0, 10_000_000)} inputMode="numeric" className={`${field} font-mono text-right`} /></Row>
        <Row label="Giá lượt sửa thêm"><input value={f.extraRevision.toLocaleString('vi-VN')} onChange={num('extraRevision', 0, 5_000_000)} inputMode="numeric" className={`${field} font-mono text-right`} /></Row>
        <Row label="Mã QR hết hạn sau" hint="phút"><input value={f.qrTtlMin} onChange={num('qrTtlMin', 5, 60)} inputMode="numeric" className={`${field} font-mono text-right`} /></Row>
        <Row label="Báo giá hiệu lực" hint="giờ"><input value={f.quoteTtlH} onChange={num('quoteTtlH', 1, 168)} inputMode="numeric" className={`${field} font-mono text-right`} /></Row>
        <Row label="Cổng thanh toán" hint="D1 · payOS miễn phí; SePay ~300đ/giao dịch">
          <div role="group" className="flex p-0.5 gap-0.5 border border-line rounded-r">{(['payOS', 'SePay'] as const).map((g) => <button key={g} type="button" aria-pressed={f.gateway === g} onClick={() => set('gateway', g)} className={`flex-1 h-7 max-md:h-10 rounded text-xs ${f.gateway === g ? 'bg-hover font-medium' : 'text-ink-2'}`}>{g}</button>)}</div>
        </Row>
        <Row label="Ngân hàng nhận"><input value={f.bankName} onChange={(e) => set('bankName', e.target.value)} className={field} /></Row>
        <Row label="Số tài khoản"><input value={f.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} className={`${field} font-mono`} /></Row>
        <Row label="Chủ tài khoản"><input value={f.accountName} onChange={(e) => set('accountName', e.target.value.toUpperCase())} className={field} /></Row>
      </section>

      <section className="border border-line rounded-r2 px-5 py-2"><h2 className="text-sm pt-3 pb-1">Trợ lý AI & chi phí</h2>
        <Row label="Trợ lý AI trả lời khách" hint="Tắt: mọi tin nhắn chuyển thẳng vào hộp thư"><Toggle label="Trợ lý AI" on={f.aiEnabled} onChange={(v) => set('aiEnabled', v)} /></Row>
        <Row label="Trần chi phí model + tool" hint="D10 · % giá job; cảnh báo ở Tài chính khi vượt"><div className="flex items-center gap-2"><input type="range" min={5} max={30} value={f.modelBudgetPct} onChange={(e) => set('modelBudgetPct', Number(e.target.value))} className="flex-1 accent-accent" aria-label="Trần chi phí" /><span className="font-mono text-[13px] w-10 text-right">{f.modelBudgetPct}%</span></div></Row>
        <Row label="Tốc độ mô phỏng" hint="Chỉ có trong prototype"><div role="group" className="flex p-0.5 gap-0.5 border border-line rounded-r">{([1, 2, 4] as const).map((x) => <button key={x} type="button" aria-pressed={f.simSpeed === x} onClick={() => set('simSpeed', x)} className={`flex-1 h-7 max-md:h-10 rounded text-xs ${f.simSpeed === x ? 'bg-hover font-medium' : 'text-ink-2'}`}>{x}×</button>)}</div></Row>
      </section>

      <section className="border border-line rounded-r2 px-5 py-2"><h2 className="text-sm pt-3 pb-1">Doanh nghiệp</h2>
        <Row label="Tên hiển thị trên hóa đơn"><input value={f.businessName} onChange={(e) => set('businessName', e.target.value)} className={field} /></Row>
        <Row label="Giờ làm việc của chuyên viên"><input value={f.hours} onChange={(e) => set('hours', e.target.value)} className={field} /></Row>
      </section>

      <section className="border border-line rounded-r2 p-5 grid gap-3"><h2 className="text-sm">Đội agent</h2>
        <ul className="grid gap-2">{(Object.keys(personas) as (keyof typeof personas)[]).map((id) => {
          const load = db.orders.filter((o) => o.status === 'active' && ['running', 'revision_requested', 'qc_review', 'submitted'].includes(o.job) && (id === 'lan' ? ['qc_review', 'submitted'].includes(o.job) : true)).length
          return <li key={id} className="flex items-center gap-3 text-[13px]"><Avatar id={id} size={28} /><span><b>{personas[id].name}</b> <span className="text-ink-3">· {personas[id].role}</span></span><AIBadge /><span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-3"><span className="size-1.5 rounded-full bg-ok" />Hoạt động · OpenClaw nội bộ{id !== 'lan' && load ? ` · ${load} việc` : ''}</span></li>
        })}</ul>
      </section>

      <div className="sticky bottom-0 max-md:bottom-[60px] bg-white border-t border-line -mx-8 max-md:-mx-4 px-8 max-md:px-4 py-3 flex items-center gap-2">
        <Btn kind="primary" disabled={!dirty} onClick={() => { saveSettings(f); setSaved(true) }}>Lưu cài đặt</Btn>
        {dirty && <Btn kind="plain" onClick={() => setF(db.settings)}>Hoàn tác</Btn>}
        {saved && !dirty && <span role="status" className="text-[13px] text-ok inline-flex items-center gap-1"><Icon name="check" size={14} /> Đã lưu</span>}
        <Btn kind="plain" className="ml-auto" onClick={() => setF(defaultSettings())}>Về mặc định</Btn>
        <Btn kind="plain" onClick={() => setWipe(true)}>Nạp lại dữ liệu mẫu</Btn>
      </div>
      {wipe && <Modal title="Nạp lại dữ liệu mẫu?" onClose={() => setWipe(false)}><p className="text-[13px] text-ink-2">Mọi đơn, báo giá, hội thoại và cài đặt sẽ về trạng thái ban đầu của prototype. Thao tác này không thể hoàn tác.</p><div className="flex gap-2 justify-end"><Btn onClick={() => setWipe(false)}>Hủy</Btn><Btn kind="primary" onClick={() => { reset(false); setWipe(false); setF(defaultSettings()) }}>Nạp lại</Btn></div></Modal>}
    </Page>
  )
}
