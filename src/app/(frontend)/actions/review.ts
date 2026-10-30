'use server'

import type { File } from 'payload'
import type { User } from '@/payload-types'
import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'

type ReviewAnnotationInput = {
  id: number
  x: number
  y: number
  text: string
  kind?: 'pin' | 'region'
  region?: { width: number; height: number }
  asset?: number
  assetLabel?: string
  viewport?: 'desktop' | 'tablet' | 'mobile'
}

type ReviewBatchInput = {
  order: {
    code: string
    serviceCode: string
    brand: string
    brief: string
    total: number
    includedRevisions: number
    dueAt: string
    version: number
  }
  annotations: ReviewAnnotationInput[]
  capture?: string
  captureAsset?: number
  captureViewport?: 'desktop' | 'tablet' | 'mobile'
}

const finitePercent = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100

export async function persistReviewBatch(input: ReviewBatchInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await appAuth.currentUser() as User | null
  if (!current || current.collection !== 'users') return { ok: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' }
  if (!input.order.code || input.order.brand.length > 160 || input.order.brief.length > 4000 || input.annotations.length > 30) return { ok: false, error: 'Dữ liệu review không hợp lệ.' }
  const annotations = input.annotations.filter((a) => a.text.trim() && a.text.length <= 1200 && finitePercent(a.x) && finitePercent(a.y))
  if (!annotations.length) return { ok: false, error: 'Cần ít nhất một comment hợp lệ.' }

  const payload = await getPayloadClient()
  const services = await payload.find({
    collection: 'services',
    where: { code: { equals: input.order.serviceCode } },
    limit: 1,
    depth: 0,
    overrideAccess: false,
  })
  const service = services.docs[0]
  if (!service) return { ok: false, error: 'Dịch vụ không còn hoạt động.' }

  let orders = await payload.find({
    collection: 'orders',
    where: { code: { equals: input.order.code } },
    limit: 1,
    depth: 0,
    user: current,
    overrideAccess: false,
  })
  if (!orders.docs[0]) {
    const created = await payload.create({
      collection: 'orders',
      data: {
        code: input.order.code,
        customer: current.id,
        service: service.id,
        brand: input.order.brand,
        brief: input.order.brief,
        total: Math.max(0, input.order.total),
        paid: 0,
        status: 'awaiting_deposit',
        jobState: 'queued',
        version: 0,
        includedRevisions: Math.max(0, input.order.includedRevisions),
        usedRevisions: 0,
        extraRevisions: 0,
        dueAt: input.order.dueAt,
      },
      context: { trustedReviewMirror: true },
      user: current,
      overrideAccess: false,
    })
    orders = { ...orders, docs: [created] }
  }
  const order = orders.docs[0]

  let captureID: string | undefined
  const match = input.capture?.match(/^data:image\/(jpeg|png);base64,(.+)$/)
  if (match) {
    const data = Buffer.from(match[2], 'base64')
    if (data.byteLength <= 1_500_000) {
      const extension = match[1] === 'png' ? 'png' : 'jpg'
      const file: File = { data, mimetype: `image/${match[1]}`, name: `${input.order.code}-v${input.order.version}.${extension}`, size: data.byteLength }
      const media = await payload.create({
        collection: 'review-media',
        data: { alt: `Capture ${input.order.code} v${input.order.version}`, customer: current.id, order: order.id },
        file,
        user: current,
        overrideAccess: false,
      })
      captureID = media.id
    }
  }

  for (const annotation of annotations) {
    await payload.create({
      collection: 'review-comments',
      data: {
        order: order.id,
        customer: current.id,
        version: Math.max(1, input.order.version),
        assetKey: String(annotation.asset ?? 0),
        assetLabel: annotation.assetLabel ?? 'Bản nháp',
        viewport: annotation.viewport ?? 'desktop',
        kind: annotation.kind ?? 'pin',
        x: annotation.x,
        y: annotation.y,
        region: annotation.region,
        text: annotation.text.trim(),
        status: 'open',
        authorRole: 'client',
        capture: captureID,
      },
      user: current,
      overrideAccess: false,
    })
  }
  return { ok: true }
}
