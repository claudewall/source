import Link from 'next/link'
import { db } from '@/lib/mongo'
import { auth, signIn, signOut } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function signInGitHub() {
  'use server'
  await signIn('github')
}

async function signOutAction() {
  'use server'
  await signOut({ redirectTo: '/' })
}

export default async function Home() {
  const session = await auth()
  const user = session?.user as { handle?: string; image?: string | null } | undefined

  let posts: Array<Record<string, unknown>> = []
  try {
    const d = await db()
    posts = await d
      .collection('posts')
      .find({})
      .sort({ createdAt: -1 })
      .limit(60)
      .toArray()
  } catch {
    // DB not configured yet — render empty state.
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <header className="px-6 py-4 flex items-center justify-between border-b border-neutral-200/70">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          claudewall
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href={`/u/${user.handle}`}
                className="flex items-center gap-2 hover:underline"
              >
                {user.image && (
                  <img
                    src={user.image}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                )}
                <span>@{user.handle}</span>
              </Link>
              <form action={signOutAction}>
                <button className="text-neutral-500 hover:text-neutral-900">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <form action={signInGitHub}>
              <button className="px-4 py-1.5 bg-black text-white rounded-full text-sm">
                Sign in with GitHub
              </button>
            </form>
          )}
        </nav>
      </header>

      {posts.length === 0 ? (
        <div className="max-w-xl mx-auto p-10 text-center text-neutral-600 space-y-4">
          <p className="font-serif text-2xl text-neutral-800">
            A wall of memorable lines from Claude Code sessions.
          </p>
          <p className="text-sm">
            Install the slash command:
            <br />
            <code className="inline-block mt-2 bg-neutral-100 px-3 py-1 rounded font-mono">
              npx claudewall init
            </code>
          </p>
          <p className="text-sm">Then run <code>/wall</code> in any session.</p>
        </div>
      ) : (
        <div className="p-6 columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {posts.map((p) => {
            const id = String((p as { _id: { toString(): string } })._id)
            const handle = String((p as { authorHandle?: string }).authorHandle ?? '')
            const image = (p as { authorImage?: string | null }).authorImage
            const quote = String((p as { quote?: string }).quote ?? '')
            return (
              <div
                key={id}
                className="mb-4 break-inside-avoid bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <Link href={`/p/${id}`}>
                  <img
                    src={`/api/og/${id}`}
                    alt={quote}
                    className="w-full block"
                    loading="lazy"
                  />
                </Link>
                <div className="px-3 py-2 flex items-center gap-2">
                  {image && (
                    <img
                      src={image}
                      alt=""
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <Link
                    href={`/u/${handle}`}
                    className="text-sm text-neutral-600 hover:underline"
                  >
                    @{handle}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
