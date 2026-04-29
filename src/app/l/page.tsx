import Link from 'next/link'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth, signIn } from '@/lib/auth'
import SiteHeader from '../_components/SiteHeader'
import DeleteButton from '../_components/DeleteButton'
import TagCloud from '../_components/TagCloud'
import { deleteLesson } from '../_actions/lessons'

export const dynamic = 'force-dynamic'

async function signInGitHub() {
  'use server'
  await signIn('github')
}

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const sp = await searchParams
  const rawTag = (sp.tag ?? '').toLowerCase().trim()
  const tagFilter = /^[a-z0-9][a-z0-9-]*$/.test(rawTag) ? rawTag : ''

  const session = await auth()
  const sessionUser = session?.user as
    | { id?: string; handle?: string }
    | undefined

  if (!sessionUser?.id) {
    return (
      <main className="flex-1 bg-[#faf6ec] text-neutral-900">
        <SiteHeader />
        <div className="max-w-xl mx-auto p-10 text-center space-y-6">
          <h1 className="font-serif text-3xl">Lessons</h1>
          <p className="text-neutral-700">
            A personal archive of gotchas, dead-ends, and corrected
            assumptions captured from your Claude Code sessions — searchable
            by similar situations across future sessions.
          </p>
          <p className="text-sm text-neutral-600">
            Sign in to view your lessons, capture new ones with{' '}
            <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
              /lesson
            </code>
            , and recall relevant ones with{' '}
            <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
              /recall
            </code>
            .
          </p>
          <form action={signInGitHub}>
            <button className="px-5 py-2 bg-black text-white rounded-full text-sm">
              Sign in with GitHub
            </button>
          </form>
        </div>
      </main>
    )
  }

  const authorId = new ObjectId(sessionUser.id)

  let lessons: Array<Record<string, unknown>> = []
  let tagCounts: Array<{ tag: string; count: number }> = []
  try {
    const d = await db()
    const filter = tagFilter
      ? { authorId, tags: tagFilter }
      : { authorId }
    lessons = await d
      .collection('lessons')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const cloudPipeline = [
      ...(tagFilter
        ? [{ $match: { authorId, tags: tagFilter } }]
        : [{ $match: { authorId } }]),
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 as const, _id: 1 as const } },
      { $limit: 50 },
    ]
    const raw = await d
      .collection('lessons')
      .aggregate(cloudPipeline)
      .toArray()
    tagCounts = raw.map((r) => ({
      tag: String((r as { _id: string })._id),
      count: Number((r as { count: number }).count),
    }))
  } catch {
    // DB not configured — empty state.
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="px-4 sm:px-6 pt-5 pb-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">Lessons</h1>
          <p className="text-sm text-neutral-600">
            Your personal archive — gotchas, dead-ends, corrected
            assumptions.
          </p>
        </div>
        {tagFilter && (
          <div className="mt-2 text-sm flex items-center gap-2">
            <span>Filtered by</span>
            <span className="font-mono bg-neutral-200/70 rounded px-2 py-0.5">
              #{tagFilter}
            </span>
            <Link href="/l" className="text-neutral-500 hover:underline">
              clear
            </Link>
          </div>
        )}
      </div>

      <TagCloud tags={tagCounts} activeTag={tagFilter} basePath="/l" />

      {lessons.length === 0 ? (
        <div className="max-w-xl mx-auto p-10 text-center text-neutral-700 space-y-4">
          {tagFilter ? (
            <>
              <p className="font-serif text-xl">
                No lessons with #{tagFilter} yet.
              </p>
              <p className="text-sm">
                <Link href="/l" className="underline">
                  Browse all lessons
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-xl">No lessons captured yet.</p>
              <p className="text-sm">
                Run{' '}
                <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                  /lesson
                </code>{' '}
                in any Claude Code session after a misstep that's worth
                remembering — Claude proposes structured lessons, you pick
                which to keep.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="p-4 sm:p-6 columns-1 sm:columns-2 lg:columns-3 gap-4">
          {lessons.map((l) => {
            const id = String((l as { _id: { toString(): string } })._id)
            const tags = ((l as { tags?: unknown }).tags ?? []) as string[]
            const title = String((l as { title?: string }).title ?? '')
            const trigger = String((l as { trigger?: string }).trigger ?? '')
            const correction = String(
              (l as { correction?: string }).correction ?? '',
            )
            const weight = Number((l as { weight?: number }).weight ?? 3)
            return (
              <div
                key={id}
                className="relative mb-4 break-inside-avoid bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden"
              >
                <DeleteButton
                  id={id}
                  action={deleteLesson}
                  noun="lesson"
                />
                <Link href={`/l/${id}`} className="block p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <h3 className="font-serif text-lg leading-snug flex-1">
                      {title}
                    </h3>
                    <span
                      className="text-xs text-neutral-400 font-mono shrink-0"
                      title={`weight ${weight}/5`}
                    >
                      {'★'.repeat(weight)}
                      {'·'.repeat(5 - weight)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 italic line-clamp-1">
                    when: {trigger}
                  </p>
                  <p className="text-sm text-neutral-700 line-clamp-2">
                    {correction}
                  </p>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tg) => (
                        <span
                          key={tg}
                          className="text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded"
                        >
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
