'use client'

import dynamic from 'next/dynamic'
import type { ManagedService } from '@/lib/services'

const App = dynamic(() => import('./LegacyApp'), { ssr: false })

export default function AppClient({ services }: { services: ManagedService[] }) {
  return <App services={services} />
}
