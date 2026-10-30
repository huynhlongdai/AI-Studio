import { useState } from 'react'
import { personas } from '../lib/catalog'
import { activeServices, useStore } from '../store'
import { navigate } from '../router'
import { Avatar, Btn, Icon, vnd } from '../ui'

const STEPS = [
  ['Chat', 'Kể cho trợ lý AI chị cần gì. 3 phút là đủ brief.'],
  ['Báo giá', 'Giá lấy từ bảng giá công khai, không mặc cả, không phát sinh.'],
  ['Cọc qua QR', 'Quét VietQR, hệ thống tự xác nhận khi ngân hàng báo về.'],
  ['Theo dõi', 'Xem từng bước trực tiếp, duyệt bản nháp, ghim góp ý.'],
  ['Nhận tệp', 'Chuyên viên duyệt trước khi giao. Tệp gốc thuộc về chị.'],
]
const FAQ = [
  ['AI làm hết à? Có người kiểm tra không?', 'Đội agent AI thực hiện, Lan (agent kiểm tra) chấm theo checklist, và chuyên viên Longca duyệt từng bản trước khi tới tay chị.'],
  ['Giá có thay đổi giữa chừng không?', 'Không. Giá chốt theo báo giá chị chấp nhận. Chỉ khi chị muốn đổi hẳn phạm vi hoặc mua thêm lượt sửa thì mới có báo giá phụ.'],

  ['Tôi có toàn quyền sử dụng sản phẩm?', 'Có. Sau khi thanh toán đủ, chị dùng thương mại không giới hạn. Sản phẩm có nhãn nội dung AI theo quy định.'],
]

export default function Landing() {
  const [faq, setFaq] = useState<number | null>(0)
  const { db } = useStore()
  const services = activeServices(db)
  const faqs = [...FAQ.slice(0, 2), ['Thanh toán thế nào?', `Cọc ${db.settings.depositPct}% bằng VietQR (hoặc credit gói tháng) để bắt đầu; phần còn lại khi chị duyệt bản cuối, trước khi mở tệp gốc. Đơn dưới ${vnd(db.settings.smallOrder)} thanh toán một lần.`], ...FAQ.slice(2)]
  const start = db.session.client.loggedIn ? '/app/chat' : '/dang-nhap'
  return (
    <div className="min-h-dvh bg-white">
      <header className="max-w-[1120px] mx-auto px-6 max-md:px-4 h-16 flex items-center gap-6">
        <a href="#/" className="flex items-center gap-2.5"><span className="size-7 rounded-r bg-ink text-white grid place-items-center"><Icon name="spark" size={15} /></span><span className="font-medium">AI Studio</span></a>
        <nav className="flex gap-5 text-[13px] text-ink-2 max-md:hidden"><a href="#dich-vu" onClick={(e) => { e.preventDefault(); document.getElementById('dich-vu')?.scrollIntoView({ behavior: 'smooth' }) }} className="hover:text-ink">Dịch vụ</a><a href="#agent-ban-hang" onClick={(e) => { e.preventDefault(); document.getElementById('agent-ban-hang')?.scrollIntoView({ behavior: 'smooth' }) }} className="hover:text-ink">Agent bán hàng</a><a href="#quy-trinh" onClick={(e) => { e.preventDefault(); document.getElementById('quy-trinh')?.scrollIntoView({ behavior: 'smooth' }) }} className="hover:text-ink">Quy trình</a><a href="#faq" onClick={(e) => { e.preventDefault(); document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }) }} className="hover:text-ink">Câu hỏi</a></nav>
        <div className="ml-auto flex gap-2"><Btn kind="plain" onClick={() => navigate(db.session.client.loggedIn ? '/app' : '/dang-nhap')}>{db.session.client.loggedIn ? 'Vào ứng dụng' : 'Đăng nhập'}</Btn><Btn kind="primary" onClick={() => navigate(start)}>Chat với trợ lý</Btn></div>
      </header>

      <section className="max-w-[1120px] mx-auto px-6 max-md:px-4 pt-14 pb-16 max-md:pt-8 grid grid-cols-[1.05fr_1fr] gap-12 max-lg:grid-cols-1 items-center">
        <div className="grid gap-6">
          <p className="text-xs text-ink-3 font-mono">Studio sáng tạo AI cho doanh nghiệp nhỏ</p>
          <h1 className="text-[44px] max-md:text-[32px] leading-[1.15] tracking-[-0.025em] font-medium text-balance">Logo, video, landing page — đặt trong 3 phút, theo dõi đến từng bước.</h1>
          <p className="text-base text-ink-2 leading-relaxed max-w-[520px]">Đội agent AI làm, chuyên viên duyệt từng bản trước khi giao. Giá công khai, cọc qua VietQR, chị duyệt rồi mới trả phần còn lại.</p>
          <div className="flex gap-2 max-sm:flex-col"><Btn kind="primary" size="l" onClick={() => navigate(start)}>Chat với trợ lý AI <Icon name="arrow" size={15} /></Btn><Btn size="l" onClick={() => document.getElementById('dich-vu')?.scrollIntoView({ behavior: 'smooth' })}>Xem bảng giá</Btn></div>
          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">{(Object.keys(personas) as (keyof typeof personas)[]).map((p) => <span key={p} className="rounded-full ring-2 ring-white"><Avatar id={p} size={28} /></span>)}</div>
            <p className="text-[13px] text-ink-3">Mai, Khoa, Minh và Lan — cùng chuyên viên Longca</p>
          </div>
        </div>
        <figure className="relative rounded-[14px] overflow-hidden border border-line aspect-[4/3.4] max-lg:aspect-[16/10]">
          <img src="/hero-focus.jpg" alt="Không gian làm việc của studio" className="w-full h-full object-cover" />
          <figcaption className="absolute left-4 right-4 bottom-4 bg-white/95 backdrop-blur rounded-r2 border border-line p-3.5 grid gap-2.5">
            <div className="flex items-center gap-2 text-[13px]"><Avatar id="mai" size={24} /><b>Mai</b><span className="text-ink-3">· gửi bản nháp v2</span><span className="ml-auto font-mono text-xs text-ink-3">10:42</span></div>
            <div className="flex gap-1">{[1, 1, 1, 1, 1, 0, 0].map((d, i) => <span key={i} className={`h-1 flex-1 rounded-sm ${d ? 'bg-accent' : 'bg-hover'}`} />)}</div>
            <p className="text-xs text-ink-3">Bước 5/7 · Lan kiểm tra đạt 5/5 tiêu chí</p>
          </figcaption>
        </figure>
      </section>

      <section id="dich-vu" className="border-t border-line">
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-16 grid gap-8">
          <div className="flex items-end gap-4 flex-wrap"><h2 className="text-2xl">Dịch vụ & giá</h2><p className="text-[13px] text-ink-3 ml-auto">Giá tạm tính · đã gồm kiểm tra chất lượng và duyệt của chuyên viên</p></div>
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] border border-line rounded-r2 divide-x divide-line max-lg:divide-x-0 [&>li]:border-line max-lg:[&>li:nth-child(odd)]:border-r max-lg:[&>li:nth-child(-n+2)]:border-b max-sm:[&>li]:!border-r-0 max-sm:[&>li:not(:last-child)]:border-b">
            {services.map((s) => (
              <li key={s.code} className="p-5 grid gap-3 content-start">
                <div className="flex items-center gap-2"><Avatar id={s.agent} size={22} /><span className="text-xs text-ink-3">{personas[s.agent].name} · {personas[s.agent].role}</span></div>
                <h3 className="text-base">{s.name}</h3>
                <p className="text-[13px] text-ink-2 leading-relaxed min-h-[60px]">{s.desc}</p>
                <p className="text-sm">từ <b className="tabular-nums">{vnd(s.basePrice)}</b></p>
                <p className="text-xs text-ink-3">{s.slaDays} ngày · {s.includedRevisions} lượt sửa</p>
                <button type="button" onClick={() => navigate(start)} className="text-[13px] font-medium text-accent inline-flex items-center gap-1 justify-self-start min-h-8 hover:underline underline-offset-4">Đặt việc này <Icon name="arrow" size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="agent-ban-hang" className="border-t border-line">
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-16 grid grid-cols-[1fr_400px] max-lg:grid-cols-1 gap-12 items-center">
          <div className="grid gap-5">
            <p className="text-xs font-mono text-accent">THUÊ DÀI HẠN</p>
            <h2 className="text-2xl leading-tight">Agent bán hàng trả lời người mua 24/7, chuyển khách nóng cho nhân viên của bạn</h2>
            <p className="text-[15px] text-ink-2 leading-relaxed">Không phải chatbot kịch bản. Agent học đúng sản phẩm, giá, chính sách của shop — bạn tự duyệt từng thông tin, chuyên viên studio hỗ trợ khi cần.</p>
            <ul className="grid grid-cols-2 max-sm:grid-cols-1 gap-x-6 gap-y-3 text-[13px]">
              {[['Website, Zalo OA, Messenger, Instagram, Telegram, API', 'Một agent, nhiều kênh'], ['Agent research có nguồn, bạn duyệt', 'Không tự bịa thông tin'], ['Thi thử đạt 80% mới chạy thật', 'An toàn trước khi gặp khách'], ['Xin đồng ý rồi mới lưu SĐT', 'Chuyển lead kèm tóm tắt cho nhân viên']].map(([t, d]) => (
                <li key={t} className="flex gap-2.5"><Icon name="check" size={15} className="text-accent mt-0.5 flex-none" /><span><b className="font-medium block">{d}</b><span className="text-ink-3">{t}</span></span></li>
              ))}
            </ul>
            <div className="flex gap-2 flex-wrap"><Btn kind="primary" onClick={() => navigate(db.session.client.loggedIn ? '/app/agent' : '/dang-nhap')}>Thiết lập agent cho shop</Btn><Btn onClick={() => navigate('/w/moc-an')}>Thử chat như người mua</Btn></div>
            <p className="text-xs text-ink-3">Phí tháng, số hội thoại kèm theo và phí vượt thỏa thuận riêng theo quy mô shop.</p>
          </div>
          <div className="border border-line rounded-[14px] overflow-hidden" aria-hidden="true">
            <div className="flex items-center gap-2 p-3 border-b border-line"><span className="size-7 rounded-full bg-ink text-white grid place-items-center text-[11px]">MA</span><p className="text-[13px] font-medium">Quán Mộc An</p><span className="ml-auto text-xs text-ink-3">Zalo OA</span></div>
            <div className="p-3 grid gap-2 text-[13px] bg-white">
              <p className="bg-ink text-white rounded-[12px] px-3 py-2 justify-self-end max-w-[80%]">Quán nhận đặt 30 ly cho công ty thứ 6 không?</p>
              <p className="bg-soft rounded-[12px] px-3 py-2 max-w-[85%]">Dạ có ạ, đơn từ 20 ly quán giảm 10% và tự giao miễn phí trong 5km. Để chị Hân tư vấn kỹ, mình cho em xin số điện thoại nhé?</p>
              <p className="bg-ink text-white rounded-[12px] px-3 py-2 justify-self-end">0903 •••• 88</p>
              <p className="bg-soft rounded-[12px] px-3 py-2 max-w-[85%]">Em xin phép lưu số để chị Hân gọi tư vấn riêng đơn này. Mình đồng ý không ạ?</p>
            </div>
            <div className="border-t border-line p-3 bg-side text-xs flex items-center gap-2"><span className="size-1.5 rounded-full bg-red-500" /><b>Lead nóng</b> giao chị Hân · 30 ly · thứ 6 · cần VAT</div>
          </div>
        </div>
      </section>

      <section id="quy-trinh" className="bg-side border-y border-line">
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-16 grid gap-8">
          <h2 className="text-2xl">Quy trình 5 bước</h2>
          <ol className="grid grid-cols-5 max-lg:grid-cols-1 gap-6">
            {STEPS.map(([t, d], i) => <li key={t} className="grid gap-2 content-start max-lg:grid-cols-[32px_1fr] max-lg:gap-x-3"><span className="font-mono text-xs text-ink-3 border border-line bg-white rounded-full size-7 grid place-items-center max-lg:row-span-2">{i + 1}</span><h3 className="text-sm">{t}</h3><p className="text-[13px] text-ink-2 leading-relaxed">{d}</p></li>)}
          </ol>
        </div>
      </section>

      <section id="faq" className="max-w-[760px] mx-auto px-6 max-md:px-4 py-16 grid gap-6">
        <h2 className="text-2xl">Câu hỏi thường gặp</h2>
        <ul className="border-t border-line">
          {faqs.map(([q, a], i) => (
            <li key={q} className="border-b border-line">
              <button type="button" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)} className="w-full flex items-center gap-3 py-4 text-left text-sm font-medium min-h-11">{q}<Icon name="plus" size={15} className={`ml-auto text-ink-3 transition-transform ${faq === i ? 'rotate-45' : ''}`} /></button>
              {faq === i && <p className="enter pb-4 text-[13px] text-ink-2 leading-relaxed">{a}</p>}
            </li>
          ))}
        </ul>
        <div className="border border-line rounded-r2 p-6 grid gap-3 justify-items-start mt-4">
          <h3 className="text-base">Sẵn sàng bắt đầu?</h3>
          <p className="text-[13px] text-ink-2">Trợ lý trả lời ngay, chuyên viên hỗ trợ 8:00–21:00.</p>
          <Btn kind="primary" size="l" onClick={() => navigate(start)}>Chat với trợ lý AI</Btn>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-8 flex gap-6 flex-wrap text-xs text-ink-3">
          <span>HKD AI Studio · MST đang cập nhật</span><a href="#/" className="hover:text-ink">Chính sách quyền riêng tư</a><a href="#/" className="hover:text-ink">Điều khoản</a><a href="#/" className="hover:text-ink">Chính sách AI & bản quyền</a>
          <a href="#/doi-tac" className="ml-auto hover:text-ink">Cổng đối tác</a><a href="#/nv" className="hover:text-ink">Nhân viên shop</a><a href="#/admin" className="hover:text-ink">Cổng studio</a>
        </div>
      </footer>
    </div>
  )
}
