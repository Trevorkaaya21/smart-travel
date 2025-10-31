// apps/web/middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/api/auth/signin' },
})

export const config = {
  matcher: [
    '/trip/:path*',
    '/dashboard/trips/:path*',
    '/dashboard/diary/:path*',
    '/dashboard/profile/:path*',
  ],
}
