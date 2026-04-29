import Link from 'next/link'
import { db } from '@/lib/mongo'
import SiteHeader from './_components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function Home() {
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
      <SiteHeader />

      {posts.length === 0 ? (
        <div className="max-w-xl mx-auto p-10 text-center text-neutral-700 space-y-8">
          <p className="font-serif text-2xl text-neutral-900">
            A wall of memorable lines from Claude Code sessions.
          </p>

          <ol className="text-left space-y-5 text-sm">
            <li className="flex gap-4">
              <span className="font-serif text-2xl text-neutral-400 leading-none">1.</span>
              <div className="space-y-2">
                <p>In any Claude Code session, ask Claude to run:</p>
                <code className="inline-block bg-neutral-100 px-3 py-1 rounded font-mono">
                  npx claudewall init
                </code>
                <p className="text-xs text-neutral-500">
                  Approve the device code in the browser when it opens.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="font-serif text-2xl text-neutral-400 leading-none">2.</span>
              <p className="pt-1">
                Exit Claude Code (it only loads slash commands at session start).
              </p>
            </li>

            <li className="flex gap-4">
              <span className="font-serif text-2xl text-neutral-400 leading-none">3.</span>
              <div className="space-y-2 pt-1">
                <p>Start a new session and run:</p>
                <code className="inline-block bg-neutral-100 px-3 py-1 rounded font-mono">
                  /wall
                </code>
              </div>
            </li>
          </ol>
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
