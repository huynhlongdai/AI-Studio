import 'server-only'
import { unstable_cache } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'

export type ManagedService = {
  code: string
  name: string
  shortName: string
  description: string
  basePrice: number
  rushSurcharge: number
  includedRevisions: number
  slaDays: number
  deliverables: { label: string }[]
  options?: { code: string; label: string; price: number }[]
}

export const getManagedServices = unstable_cache(
  async (): Promise<ManagedService[]> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'services' as never,
      where: { active: { equals: true } },
      sort: 'createdAt',
      limit: 20,
      depth: 0,
      overrideAccess: false,
    })
    return result.docs.map((doc) => {
      const service = doc as unknown as ManagedService
      return {
        code: service.code,
        name: service.name,
        shortName: service.shortName,
        description: service.description,
        basePrice: service.basePrice,
        rushSurcharge: service.rushSurcharge,
        includedRevisions: service.includedRevisions,
        slaDays: service.slaDays,
        deliverables: service.deliverables ?? [],
        options: service.options ?? [],
      }
    })
  },
  ['managed-services'],
  { tags: ['services'] },
)
