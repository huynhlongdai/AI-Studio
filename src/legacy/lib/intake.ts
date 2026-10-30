// Trợ lý tiếp nhận brief bằng luật cố định. Giá CHỈ lấy từ engine báo giá, chat không tự nói ra tổng tiền.
import type { Service, ServiceCode } from './catalog'

export interface IntakeState {
  service?: ServiceCode
  brand?: string
  style?: string
  options: string[]
  optionIdx: number // tùy chọn đang hỏi
  rush?: boolean
  askedDeadline?: boolean
}

export const emptyIntake = (): IntakeState => ({ options: [], optionIdx: 0 })

export interface IntakeReply {
  text: string
  state: IntakeState
  chips?: string[]
  readyToQuote?: boolean
  handoff?: boolean
}

const YES = /^(có|co|ok|oke|ừ|uh|vâng|dạ có|thêm|yes|đồng ý)/i
const NO = /^(không|ko|khong|thôi|no|bỏ qua)/i

/** `services` is the effective (admin-edited, active-only) catalog so asked prices match the price engine. */
export function nextReply(message: string, prev: IntakeState, services: Service[]): IntakeReply {
  const findService = (c: string) => services.find((x) => x.code === c)
  const m = message.trim()
  const s: IntakeState = { ...prev, options: [...prev.options] }

  if (/người thật|nói chuyện với người|chuyên viên|gặp người/i.test(m)) {
    return { text: 'Em đã chuyển cuộc trò chuyện cho chuyên viên. Anh Longca sẽ phản hồi trong giờ làm việc (8:00–21:00) ạ.', state: s, handoff: true }
  }

  if (!s.service) {
    const hit = services.find((c) => c.keywords.test(m))
    if (!hit) return { text: 'Chị đang cần làm gì ạ? Hiện studio nhận 4 loại việc:', state: s, chips: services.map((c) => c.short) }
    s.service = hit.code
    return { text: `Dạ, ${hit.name} — ${hit.desc} Thương hiệu hoặc tên quán của chị là gì ạ?`, state: s }
  }
  const svc = findService(s.service)!

  if (!s.brand) {
    const b = m.match(/(?:thương hiệu|tên|quán|shop|tiệm)\s*(?:là|:)?\s*(.+)/i)?.[1] ?? m
    if (b.length < 2 || b.length > 50) return { text: 'Chị cho em tên thương hiệu ngắn gọn nhé (dưới 50 ký tự)?', state: s }
    s.brand = b.replace(/[.!]+$/, '').trim()
    return { text: `Cảm ơn chị. ${svc.styleQuestion}`, state: s }
  }

  if (!s.style) {
    if (m.length < 3) return { text: 'Chị mô tả thêm một chút để đội làm đúng ý nhé?', state: s }
    s.style = m
    return askOption(s, svc)
  }

  if (s.optionIdx < svc.options.length) {
    const opt = svc.options[s.optionIdx]
    if (YES.test(m)) s.options.push(opt.code)
    else if (!NO.test(m)) return { text: `Chị trả lời giúp em "Có" hoặc "Không" cho mục ${opt.label} nhé.`, state: s, chips: ['Có', 'Không'] }
    s.optionIdx++
    return askOption(s, svc)
  }

  if (!s.askedDeadline) {
    if (/gấp|24|1 ngày|mai/i.test(m)) s.rush = true
    else if (/tiêu chuẩn|bình thường|không gấp|thường/i.test(m)) s.rush = false
    else return { text: 'Chị chọn giúp em "Giao gấp 24 giờ" hoặc "Tiêu chuẩn" nhé.', state: s, chips: ['Giao gấp 24 giờ', 'Tiêu chuẩn'] }
    s.askedDeadline = true
    return { text: `Em đã đủ brief cho ${s.brand}. Đây là báo giá lấy từ bảng giá hiện hành — chị xem và chấp nhận để thanh toán cọc ạ.`, state: s, readyToQuote: true }
  }

  return { text: 'Báo giá đã sẵn sàng ở trên ạ. Nếu muốn làm việc khác, chị bấm "Bắt đầu yêu cầu mới".', state: s }
}

function askOption(s: IntakeState, svc: Service): IntakeReply {
  if (s.optionIdx < svc.options.length) {
    const o = svc.options[s.optionIdx]
    return { text: `Chị có muốn thêm ${o.label} không ạ? (+${o.price.toLocaleString('vi-VN')}đ)`, state: s, chips: ['Có', 'Không'] }
  }
  return {
    text: `Chị cần giao gấp trong 24 giờ (+${svc.rushSurcharge.toLocaleString('vi-VN')}đ) hay tiêu chuẩn ${svc.slaDays} ngày ạ?`,
    state: s, chips: ['Giao gấp 24 giờ', 'Tiêu chuẩn'],
  }
}
