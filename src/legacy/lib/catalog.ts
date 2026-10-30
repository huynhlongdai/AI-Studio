// Danh mục dịch vụ. Giá là GIÁ TẠM (handoff §5) — chưa phải bảng giá chốt.
import type { ServiceVersion } from './pricing'
import type { ManagedService } from '@/lib/services'

export type ServiceCode = 'logo' | 'post' | 'video' | 'landing'

export interface Service extends ServiceVersion {
  code: ServiceCode
  short: string
  desc: string
  deliverables: string[]
  slaDays: number
  agent: PersonaId
  keywords: RegExp
  styleQuestion: string
}

export type PersonaId = 'mai' | 'khoa' | 'minh' | 'lan'
export const personas: Record<PersonaId, { name: string; role: string; img: string }> = {
  mai: { name: 'Mai', role: 'Thiết kế', img: '/avatars/mai-thiet-ke.jpg' },
  khoa: { name: 'Khoa', role: 'Video', img: '/avatars/khoa-video.jpg' },
  minh: { name: 'Minh', role: 'Web', img: '/avatars/minh-web.jpg' },
  lan: { name: 'Lan', role: 'Kiểm tra chất lượng', img: '/avatars/lan-kiem-tra.jpg' },
}

export const CATALOG: Service[] = [
  {
    code: 'logo', name: 'Logo tối giản', short: 'Logo & nhận diện',
    desc: 'Logo vector, bản đen trắng và biểu tượng, dùng được từ biển hiệu đến avatar.',
    deliverables: ['Logo chính (SVG, PNG)', 'Bản đen trắng', 'Biểu tượng 1:1'],
    basePrice: 990_000, rushSurcharge: 300_000, includedRevisions: 3, slaDays: 3, agent: 'mai',
    options: [{ code: 'mini', label: 'Bộ nhận diện mini (danh thiếp, ly)', price: 300_000 }],
    keywords: /logo|nhận diện|nhan dien|thương hiệu mới/i,
    styleQuestion: 'Chị muốn phong cách thế nào ạ? Ví dụ: tối giản, mộc mạc, hiện đại, sang trọng.',
  },
  {
    code: 'post', name: 'Bộ 6 post mạng xã hội', short: 'Thiết kế post',
    desc: 'Bộ post Facebook/Instagram đồng bộ nhận diện, kèm caption gợi ý.',
    deliverables: ['6 post 1:1 (PNG)', 'File Canva chỉnh sửa được', 'Caption gợi ý'],
    basePrice: 690_000, rushSurcharge: 200_000, includedRevisions: 2, slaDays: 2, agent: 'mai',
    options: [{ code: 'more3', label: 'Thêm 3 post', price: 290_000 }],
    keywords: /post|bài đăng|banner|facebook|instagram|khai trương/i,
    styleQuestion: 'Bộ post cho dịp gì, và chị muốn tông màu nào ạ?',
  },
  {
    code: 'video', name: 'Video AI 15 giây', short: 'Video AI',
    desc: 'Video dọc 9:16 cho TikTok/Reels, dựng bằng AI từ ảnh và ý tưởng của chị.',
    deliverables: ['Video MP4 9:16', 'Bản không chữ', 'Ảnh bìa'],
    basePrice: 990_000, rushSurcharge: 300_000, includedRevisions: 2, slaDays: 3, agent: 'khoa',
    options: [
      { code: 'sub', label: 'Phụ đề tiếng Việt', price: 150_000 },
      { code: 'music', label: 'Nhạc nền bản quyền', price: 150_000 },
    ],
    keywords: /video|tiktok|reels|clip|quảng cáo/i,
    styleQuestion: 'Video giới thiệu gì ạ, và chị muốn không khí ra sao (ấm cúng, năng động, sang)?',
  },
  {
    code: 'landing', name: 'Landing page', short: 'Landing page',
    desc: 'Trang đích một trang trên WordPress/Flatsome, tối ưu điện thoại.',
    deliverables: ['Trang hoàn chỉnh trên tên miền của chị', 'Tài khoản quản trị', 'Hướng dẫn chỉnh nội dung'],
    basePrice: 2_900_000, rushSurcharge: 800_000, includedRevisions: 2, slaDays: 5, agent: 'minh',
    options: [
      { code: 'form', label: 'Form đặt bàn / đặt hàng', price: 400_000 },
      { code: 'host', label: 'Tên miền + hosting 1 năm', price: 900_000 },
    ],
    keywords: /landing|website|web|trang|wordpress|flatsome/i,
    styleQuestion: 'Trang dùng để làm gì ạ (đặt bàn, bán hàng, giới thiệu)? Chị có trang tham khảo nào không?',
  },
]

export function hydrateCatalog(managed: ManagedService[]) {
  if (!managed.length) return
  const byCode = new Map(managed.map((service) => [service.code, service]))
  const next = CATALOG.map((base) => {
    const value = byCode.get(base.code)
    if (!value) return base
    return {
      ...base,
      name: value.name,
      short: value.shortName,
      desc: value.description,
      basePrice: value.basePrice,
      rushSurcharge: value.rushSurcharge,
      includedRevisions: value.includedRevisions,
      slaDays: value.slaDays,
      deliverables: value.deliverables.map((item) => item.label),
      options: value.options ?? [],
    }
  })
  CATALOG.splice(0, CATALOG.length, ...next)
}

export const findService = (code: string) => CATALOG.find((s) => s.code === code)

export const QC_CHECKS: Record<ServiceCode, string[]> = {
  logo: ['Đúng tên, đúng chính tả có dấu', 'Đọc rõ ở cỡ 16px', 'Bản đen trắng giữ nhận diện', 'Đúng tông màu trong brief', 'Font được phép dùng thương mại'],
  post: ['Đúng kích thước 1080×1080', 'Chữ không bị cắt ở vùng an toàn', 'Đồng bộ màu thương hiệu', 'Không lỗi chính tả', 'Ảnh có quyền sử dụng'],
  video: ['Đúng tỉ lệ 9:16, đủ 15 giây', 'Phụ đề khớp tiếng', 'Không có vật thể méo do AI', 'Nhạc có bản quyền', 'Có nhãn nội dung AI'],
  landing: ['Hiển thị tốt trên điện thoại', 'Tốc độ tải dưới 2,5 giây', 'Form gửi được', 'Không lỗi chính tả', 'Có chính sách quyền riêng tư'],
}

export interface Plan { code: string; name: string; price: number; credit: number; parallel: number; perks: string[] }
/** Gói tháng: trả trước, nhận credit (VND) lớn hơn số tiền trả để dùng cho mọi dịch vụ. Giá tạm. */
export const PLANS: Plan[] = [
  { code: 'co-ban', name: 'Cơ bản', price: 1_490_000, credit: 1_600_000, parallel: 1, perks: ['1 việc chạy cùng lúc', 'Credit dùng trong 30 ngày', 'Hỗ trợ trong giờ làm việc'] },
  { code: 'tang-truong', name: 'Tăng trưởng', price: 2_990_000, credit: 3_400_000, parallel: 2, perks: ['2 việc chạy cùng lúc', 'Ưu tiên xếp hàng', 'Thêm 1 lượt sửa mỗi đơn'] },
  { code: 'doanh-nghiep', name: 'Doanh nghiệp', price: 5_990_000, credit: 7_000_000, parallel: 4, perks: ['4 việc chạy cùng lúc', 'Bộ nhận diện lưu sẵn', 'Chuyên viên riêng'] },
]
export const findPlan = (c: string) => PLANS.find((p) => p.code === c)
