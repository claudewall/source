import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import clientPromise from './mongo'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise, { databaseName: process.env.MONGODB_DB || 'claudewall' }),
  session: { strategy: 'database' },
  providers: [
    GitHub({
      profile(p) {
        return {
          id: String(p.id),
          name: p.name ?? p.login,
          email: p.email,
          image: p.avatar_url,
          handle: p.login,
        } as unknown as { id: string; name: string; email: string; image: string }
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const u = user as unknown as { id: string; handle?: string }
        ;(session.user as unknown as { id: string }).id = u.id
        ;(session.user as unknown as { handle?: string }).handle = u.handle
      }
      return session
    },
  },
})
