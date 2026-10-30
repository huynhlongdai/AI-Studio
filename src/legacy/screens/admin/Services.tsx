import { useState } from 'react'
import { findService, personas } from '../../lib/catalog'
import { price } from '../../lib/pricing'
import { serviceOf, useStore, type PriceRow } from '../../store'
import { QuoteLines } from '../../components/QuoteLines'
import { Avatar, Btn, Icon, Page, PageHead, vnd } from '../../ui'

/** Bảng giá: nguồn duy nhất cho engine báo giá. Báo giá đã gửi giữ snapshot giá cũ (BR-DELIV-01). */
export default function Services() {
  const { db } = useStore()
  return (
    <Page max={1180}>
      <PageHead title="Dịch vụ & bảng giá" sub="Trợ lý AI và báo giá chỉ dùng giá ở đây. Báo giá đã gửi giữ nguyên giá lúc tạo." />
      <div className="grid gap-4">{db.catalog.map((r) => <Row key={r.code} row={r} />)}</div>
    </Page>
  )
}

function Row({ row }: { row: PriceRow }) {
  const { db, savePrice } = useStore()
  const [f, setF] = useState<PriceRow>(row)
  const [saved, setSaved] = useState(false)
  const base = findService(row.code)!
  const dirty = JSON.stringify(f) !== JSON.stringify(row)
  const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, '')) || 0)
  const preview = price({ service: { ...serviceOf(db, row.code), ...f }, optionCodes: f.options.map((o) => o.code), depositPct: db.settings.depositPct, smallOrderThreshold: db.settings.smallOrder })
  const field = 'h-8 max-md:h-11 px-2.5 border border-line rounded-r text-[13px] font-mono tabular-nums outline-none focus:border-accent w-full text-right'
  const valid = f.basePrice >= 100_000
  return (
    <section className={`border rounded-r2 p-5 grid grid-cols-[minmax(0,1fr)_300px] gap-6 max-lg:grid-cols-1 ${f.active ? 'border-line' : 'border-dashed border-line bg-side'}`}>
      <div className="grid gap-4 content-start">
        <div className="flex items-center gap-3">
          <Avatar id={base.agent} size={28} />
          <div className="min-w-0"><h2 className="text-sm">{base.name}</h2><p className="text-xs text-ink-3">{personas[base.agent].name} thực hiện · SLA {base.slaDays} ngày</p></div>
          <label className="ml-auto flex items-center gap-2 text-[13px] cursor-pointer">{f.active ? 'Đang bán' : 'Tạm ẩn'}
            <button type="button" role="switch" aria-checked={f.active} onClick={() => { setF({ ...f, active: !f.active }); setSaved(false) }} className={`w-9 h-5 rounded-full relative transition-colors ${f.active ? 'bg-accent' : 'bg-[#d4d4d4]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${f.active ? 'left-[18px]' : 'left-0.5'}`} /></button>
          </label>
        </div>
        <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-3">
          <label className="grid gap-1.5"><span className="text-xs text-ink-3">Giá gốc</span><input value={f.basePrice.toLocaleString('vi-VN')} onChange={(e) => { setF({ ...f, basePrice: num(e.target.value) }); setSaved(false) }} inputMode="numeric" className={field} /></label>
          <label className="grid gap-1.5"><span className="text-xs text-ink-3">Phụ phí giao gấp</span><input value={f.rushSurcharge.toLocaleString('vi-VN')} onChange={(e) => { setF({ ...f, rushSurcharge: num(e.target.value) }); setSaved(false) }} inputMode="numeric" className={field} /></label>
          <label className="grid gap-1.5"><span className="text-xs text-ink-3">Lượt sửa miễn phí</span><input type="number" min={0} max={10} value={f.includedRevisions} onChange={(e) => { setF({ ...f, includedRevisions: Math.min(10, Math.max(0, Number(e.target.value))) }); setSaved(false) }} className={field} /></label>
        </div>
        <div className="grid gap-2">
          <p className="text-xs text-ink-3">Tùy chọn thêm</p>
          {f.options.map((o, i) => (
            <div key={o.code} className="grid grid-cols-[minmax(0,1fr)_140px] gap-3 items-center">
              <input value={o.label} onChange={(e) => { const opts = [...f.options]; opts[i] = { ...o, label: e.target.value }; setF({ ...f, options: opts }); setSaved(false) }} aria-label="Tên tùy chọn" className="h-8 max-md:h-11 px-2.5 border border-line rounded-r text-[13px] outline-none focus:border-accent" />
              <input value={o.price.toLocaleString('vi-VN')} onChange={(e) => { const opts = [...f.options]; opts[i] = { ...o, price: num(e.target.value) }; setF({ ...f, options: opts }); setSaved(false) }} inputMode="numeric" aria-label={`Giá ${o.label}`} className={field} />
            </div>
          ))}
        </div>
        {!valid && <p role="alert" className="text-[13px] text-red-600">Giá gốc tối thiểu 100.000đ.</p>}
        <div className="flex items-center gap-2">
          <Btn kind="primary" disabled={!dirty || !valid} onClick={() => { savePrice(f); setSaved(true) }}>Lưu bảng giá</Btn>
          {dirty && <Btn kind="plain" onClick={() => setF(row)}>Hoàn tác</Btn>}
          {saved && !dirty && <span role="status" className="text-[13px] text-ok inline-flex items-center gap-1"><Icon name="check" size={14} /> Đã áp dụng cho báo giá mới</span>}
        </div>
      </div>
      <aside className="bg-side rounded-r2 p-4 grid gap-3 content-start">
        <p className="text-xs text-ink-3">Xem trước báo giá đủ tùy chọn</p>
        <QuoteLines price={preview} compact />
        <p className="text-xs text-ink-3">Cọc theo cài đặt hiện tại: {db.settings.depositPct}% (đơn dưới {vnd(db.settings.smallOrder)} trả 100%)</p>
      </aside>
    </section>
  )
}
