import AppClient from './AppClient'
import { getManagedServices } from '@/lib/services'

export default async function HomePage() {
  const services = await getManagedServices()
  return <AppClient services={services} />
}
