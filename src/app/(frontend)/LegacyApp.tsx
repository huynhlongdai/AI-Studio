'use client'

import App from '@/legacy/App'
import { hydrateCatalog } from '@/legacy/lib/catalog'
import type { ManagedService } from '@/lib/services'

export default function LegacyApp({ services }: { services: ManagedService[] }) {
  hydrateCatalog(services)
  return <App />
}
