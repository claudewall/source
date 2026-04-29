import Link from 'next/link'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import SiteHeader from '../_components/SiteHeader'
import InstallBanner from '../_components/InstallBanner'
import DeleteButton from '../_components/DeleteButton'
import TagCloud from '../_components/TagCloud'
import { deleteTip } from '../_actions/tips'

export const dynamic = 'force-dynamic'

export default async function TipsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const sp = await searchParams
  const rawTag = (sp.tag ?? '').toLowerCase().trim()
  const tagFilter = /^[a-z0-9][a-z0-9-]*$/.test(rawTag) ? rawTag : ''

  const session = await auth()
  const sessionHandle = (session?.user as { handle?: string } | undefined)
    ?.handle

  let tips: Array<Record<string, unknown>> = []
  let tagCounts: Array<{ tag: string; count: number }> = []
  try {
    const d = await db()
    const filter = tagFilter ? { tags: tagFilter } : {}
    tips = await d
      .collection('tips')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(60)
      .toArray()

    // Tag cloud: when a filter is active, the cloud shows tags that
    // co-occur with it (so the active tag stays in view alongside its
    // common companions); without a filter, it's the global cloud.
    const cloudPipeline = [
      ...(tagFilter ? [{ $match: { tags: tagFilter } }] : []),
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 as const, _id: 1 as const } },
      { $limit: 50 },
    ]
    const raw = await d.collection('tips').aggregate(cloudPipeline).toArray()
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

      {tips.length > 0 && (
        <InstallBanner
          command="/tip"
          question="Want to share a tip?"
          step3="in a fresh session and publish the techniques you've shared."
        />
      )}

      <div className="px-4 sm:px-6 pt-5 pb-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">Tips</h1>
          <p className="text-sm text-neutral-600">
            Generic, shareable techniques from Claude Code sessions.
          </p>
        </div>
        {tagFilter && (
          <div className="mt-2 text-sm flex items-center gap-2">
            <span>Filtered by</span>
            <span className="font-mono bg-neutral-200/70 rounded px-2 py-0.5">
              #{tagFilter}
            </span>
            <Link
              href="/t"
              className="text-neutral-500 hover:underline"
            >
              clear
            </Link>
          </div>
        )}
      </div>

      <TagCloud tags={tagCounts} activeTag={tagFilter} />

      {tips.length === 0 ? (
        <div className="max-w-xl mx-auto p-10 text-center text-neutral-700 space-y-4">
          {tagFilter ? (
            <>
              <p className="font-serif text-xl">
                No tips with #{tagFilter} yet.
              </p>
              <p className="text-sm">
                <Link href="/t" className="underline">
                  Browse all tips
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-xl">No tips on the wall yet.</p>
              <p className="text-sm">
                Run{' '}
                <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                  /tip
                </code>{' '}
                in any Claude Code session to start one.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="p-4 sm:p-6 columns-1 sm:columns-2 lg:columns-3 gap-4">
          {tips.map((t) => {
            const id = String((t as { _id: { toString(): string } })._id)
            const tags = ((t as { tags?: unknown }).tags ?? []) as string[]
            const handle = String(
              (t as { authorHandle?: string }).authorHandle ?? '',
            )
            const image = (t as { authorImage?: string | null }).authorImage
            const title = String((t as { title?: string }).title ?? '')
            const body = String((t as { body?: string }).body ?? '')
            const code = (t as { code?: string }).code
            const lang = (t as { lang?: string }).lang
            const isOwn =
              sessionHandle !== undefined && sessionHandle === handle
            return (
              <div
                key={id}
                className="relative mb-4 break-inside-avoid bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden"
              >
                {isOwn && (
                  <DeleteButton
                    id={id}
                    action={deleteTip}
                    noun="tip"
                  />
                )}
                <Link href={`/t/${id}`} className="block p-5 space-y-3">
                  <h3 className="font-serif text-lg leading-snug text-neutral-900">
                    {title}
                  </h3>
                  <p className="text-sm text-neutral-700 line-clamp-3">
                    {body}
                  </p>
                  {code && (
                    <pre className="bg-neutral-50 border border-neutral-200/70 rounded-md px-3 py-2 text-xs font-mono leading-relaxed line-clamp-4 overflow-hidden whitespace-pre">
                      {code}
                    </pre>
                  )}
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
                <div className="px-5 pb-4 flex items-center gap-2 text-sm">
                  {image && (
                    <img
                      src={image}
                      alt=""
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <Link
                    href={`/u/${handle}`}
                    className="text-neutral-600 hover:underline"
                  >
                    @{handle}
                  </Link>
                  {lang && (
                    <span className="ml-auto text-xs text-neutral-500 font-mono">
                      {lang}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
