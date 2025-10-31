import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, account }: any) {
      if (account?.provider) (token as any).provider = account.provider
      return token
    },
    async session({ session, token }: any) {
      const s = session as any
      s.user = s.user || {}
      s.user.provider = (token as any).provider
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export const authHandler = NextAuth(authOptions)
