import 'server-only'
import { cookies } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'

const SESSION_COOKIE = 'app-session'

export function createAppAuth(collection: 'users') {
  return {
    async login(email: string, password: string) {
      const payload = await getPayloadClient()
      const result = await payload.login({
        collection: collection as never,
        data: { email, password } as never,
        overrideAccess: false,
      })
      if (!result.token || !result.user) return null
      const cookieStore = await cookies()
      cookieStore.set(SESSION_COOKIE, result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      return result.user
    },
    async logout() {
      const cookieStore = await cookies()
      cookieStore.delete(SESSION_COOKIE)
    },
    async currentUser() {
      const token = (await cookies()).get(SESSION_COOKIE)?.value
      if (!token) return null
      const payload = await getPayloadClient()
      const authHeaders = new Headers({ Authorization: `JWT ${token}` })
      const { user } = await payload.auth({ headers: authHeaders })
      if (!user || user.collection !== collection) return null
      return user
    },
  }
}

export const appAuth = createAppAuth('users')
