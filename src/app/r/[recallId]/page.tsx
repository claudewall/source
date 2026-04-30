import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth, signIn } from '@/lib/auth'
import SiteHeader from '../../_components/SiteHeader'

export const dynamic = 'force-dynamic'

type RecallDoc = {
  _id: ObjectId
  authorId: ObjectId
  source: 'agent' | 'web'
  query?: string
  resultIds?: ObjectId[]
  resultCount?: number
  topScore?: number | null
  agentContext?: {
    sessionId?: string
    cwd?: string
    project?: string
    triggerCommand?: string
    triggerError?: string
  } | null
  createdAt?: Date
}

type LessonDoc = {
  _id: ObjectId
  title?: string
  trigger?: string
  detection?: string
  mistake?: string
  replacement?: string
  verification?: string
  failureIndicators?: string[]
  tags?: string[]
  weight?: number
}

async function signInGitHub() {
  'use server'
  await signIn('github')
}

function timeAgo(d: Date): string {
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

export default async function RecallDetailPage({
  params,
}: {
  params: Promise<{ recallId: string }>
}) {
  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined

  if (!sessionUser?.id) {
    return (
      <main className="flex-1 bg-[#faf6ec] text-neutral-900">
        <SiteHeader />
        <div className="max-w-xl mx-auto p-10 text-center space-y-4">
          <h1 className="font-serif text-2xl">Sign in to view this recall</h1>
          <form action={signInGitHub}>
            <button className="px-5 py-2 bg-black text-white rounded-full text-sm">
              Sign in with GitHub
            </button>
          </form>
        </div>
      </main>
    )
  }

  const { recallId } = await params
  let recallObjectId: ObjectId
  try {
    recallObjectId = new ObjectId(recallId)
  } catch {
    notFound()
  }

  const authorId = new ObjectId(sessionUser.id)
  const d = await db()
  const recall = (await d
    .collection('recall_history')
    .findOne({ _id: recallObjectId, authorId })) as RecallDoc | null

  if (!recall) notFound()

  const lessonIds = recall.resultIds ?? []
  let lessonsById: Record<string, LessonDoc> = {}
  if (lessonIds.length > 0) {
    const lessons = await d
      .collection('lessons')
      .find({ _id: { $in: lessonIds } })
      .toArray()
    lessonsById = Object.fromEntries(
      lessons.map((l) => [(l._id as ObjectId).toString(), l as LessonDoc]),
    )
  }
  const lessons = lessonIds
    .map((id) => lessonsById[id.toString()])
    .filter((l): l is LessonDoc => Boolean(l))

  const isAgent = recall.source === 'agent'
  const command =
    recall.agentContext?.triggerCommand ?? recall.query ?? '(empty)'
  const error = recall.agentContext?.triggerError ?? ''
  const proj = recall.agentContext?.project
  const cwd = recall.agentContext?.cwd
  const sessionId = recall.agentContext?.sessionId
  const noMatch = (recall.resultCount ?? 0) === 0

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-10 space-y-6">
        <Link
          href="/r"
          className="inline-block text-sm text-neutral-600 hover:text-neutral-900"
        >
          ◂ Back to recalls
        </Link>

        <header className="space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap text-sm text-neutral-600 min-w-0">
            <span aria-hidden className="shrink-0">
              {isAgent ? '🤖' : '👤'}
            </span>
            <span className="shrink-0">
              {recall.createdAt ? timeAgo(recall.createdAt) : ''}
            </span>
            <span className="text-neutral-300 shrink-0">·</span>
            <span className="shrink-0">{isAgent ? 'agent' : 'web'}</span>
            {proj && (
              <>
                <span className="text-neutral-300 shrink-0">·</span>
                <span className="font-mono truncate">{proj}</span>
              </>
            )}
            <span className="ml-auto shrink-0">
              {noMatch ? (
                <span className="text-amber-700">⚠ no match</span>
              ) : (
                <>
                  {recall.resultCount} hit
                  {recall.resultCount === 1 ? '' : 's'}
                  {typeof recall.topScore === 'number' && (
                    <span className="text-neutral-400 ml-2">
                      top {recall.topScore.toFixed(2)}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        </header>

        <section className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
              {isAgent ? 'command' : 'query'}
            </div>
            {isAgent ? (
              <pre className="bg-neutral-900 text-neutral-100 text-xs sm:text-sm rounded-md p-3 overflow-x-auto font-mono whitespace-pre-wrap break-words">
                {command}
              </pre>
            ) : (
              <p className="text-sm font-mono text-neutral-800 bg-white rounded-md p-3 border border-neutral-200">
                “{recall.query}”
              </p>
            )}
          </div>

          {error && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
                error
              </div>
              <pre className="bg-neutral-50 border border-neutral-200 text-xs sm:text-sm text-neutral-800 rounded-md p-3 overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                {error}
              </pre>
            </div>
          )}

          {(sessionId || cwd || recall.createdAt) && (
            <div className="text-[11px] text-neutral-500 font-mono space-y-0.5 pt-1">
              {sessionId && (
                <div>
                  <span className="text-neutral-400">session  </span>
                  {sessionId}
                </div>
              )}
              {cwd && (
                <div className="break-all">
                  <span className="text-neutral-400">cwd      </span>
                  {cwd}
                </div>
              )}
              {recall.createdAt && (
                <div>
                  <span className="text-neutral-400">when     </span>
                  {recall.createdAt.toISOString()}
                </div>
              )}
            </div>
          )}
        </section>

        {noMatch ? (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-baseline gap-2">
              <span aria-hidden>⚠</span>
              <h2 className="font-serif text-lg">No lesson matched</h2>
            </div>
            <p className="text-sm text-neutral-700">
              Strong candidate to capture — next time you solve this, run{' '}
              <code className="font-mono bg-white px-1 rounded">/lesson</code>{' '}
              in that Claude Code session and pick the relevant one.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="font-serif text-xl border-t border-neutral-200 pt-4">
              Matched lessons ({lessons.length})
            </h2>
            {lessons.map((l) => (
              <article
                key={l._id.toString()}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
              >
                <header className="px-5 py-3 flex items-baseline gap-2 border-b border-neutral-100 min-w-0">
                  <span className="text-neutral-400 font-mono text-xs shrink-0">
                    {'★'.repeat(l.weight ?? 3)}
                    {'·'.repeat(5 - (l.weight ?? 3))}
                  </span>
                  <h3 className="font-serif text-base sm:text-lg leading-snug flex-1 min-w-0">
                    {l.title}
                  </h3>
                </header>

                <div className="px-5 py-4 space-y-4 text-sm">
                  {l.trigger && (
                    <Field label="Trigger" value={l.trigger} />
                  )}
                  {l.detection && (
                    <Field label="Detection" value={l.detection} />
                  )}
                  {l.mistake && (
                    <Field label="Mistake" value={l.mistake} />
                  )}
                  {l.replacement && (
                    <Field label="Replacement" value={l.replacement} />
                  )}
                  {l.verification && (
                    <Field label="Verification" value={l.verification} />
                  )}
                  {l.failureIndicators && l.failureIndicators.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
                        Failure indicators
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {l.failureIndicators.map((fi) => (
                          <span
                            key={fi}
                            className="text-xs font-mono bg-neutral-900 text-neutral-100 px-2 py-0.5 rounded"
                          >
                            {fi}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
                    {l.tags && l.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {l.tags.map((t) => (
                          <span
                            key={t}
                            className="text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    <Link
                      href={`/l/${l._id.toString()}`}
                      className="text-xs text-neutral-500 hover:text-neutral-900 hover:underline shrink-0"
                    >
                      permalink →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
        {label}
      </div>
      <p className="text-neutral-800 leading-relaxed whitespace-pre-wrap break-words">
        {value}
      </p>
    </div>
  )
}
