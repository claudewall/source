import Link from 'next/link'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth, signIn } from '@/lib/auth'
import SiteHeader from './_components/SiteHeader'

export const dynamic = 'force-dynamic'

const RECENT_LIMIT = 5
const NOMATCH_GROUP_LIMIT = 4

async function signInGitHub() {
  'use server'
  await signIn('github')
}

function timeAgo(d: Date): string {
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}d`
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n) + '…'
}

export default async function HomePage() {
  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined

  if (!sessionUser?.id) {
    return (
      <main className="flex-1 bg-[#faf6ec] text-neutral-900">
        <SiteHeader />
        <div className="max-w-2xl mx-auto p-8 sm:p-12 space-y-10">
          <div className="text-center space-y-4">
            <h1 className="font-serif text-4xl sm:text-5xl">
              A personal lessons-learned archive for Claude Code.
            </h1>
            <p className="text-neutral-700 text-lg">
              Capture the gotcha you just hit. Pull it back next time —
              automatically, before you improvise.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
              <h3 className="font-serif text-xl">/lesson</h3>
              <p className="text-sm text-neutral-700">
                After a misstep that's worth remembering, structured
                gotchas are surfaced from your session. Pick which ones to
                save.
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
              <h3 className="font-serif text-xl">/recall</h3>
              <p className="text-sm text-neutral-700">
                Past lessons matched to a situation you're in now — pulled
                via vector search, scoped to your archive only.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-serif text-lg text-center">
              One command sets it all up:
            </p>
            <pre className="bg-neutral-900 text-neutral-100 text-sm rounded-lg px-4 py-3 overflow-x-auto font-mono">
              npx claudewall init
            </pre>
            <p className="text-xs text-neutral-600 text-center leading-relaxed">
              Auths your device, installs the slash commands, registers a
              PostToolUseFailure hook so Bash failures auto-pull matching
              past lessons into Claude's next turn.
            </p>
          </div>

          <div className="text-center">
            <form action={signInGitHub}>
              <button className="px-5 py-2 bg-black text-white rounded-full text-sm">
                Sign in with GitHub
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  const authorId = new ObjectId(sessionUser.id)

  let lessonCount = 0
  let recentLessons: Array<{
    _id: string
    title: string
    weight?: number
    createdAt?: Date
    tags?: string[]
  }> = []
  let recallCount24h = 0
  let recentRecalls: Array<{
    _id: string
    source: 'agent' | 'web'
    query: string
    resultCount: number
    triggerCommand?: string
    project?: string
    createdAt: Date
  }> = []
  let nomatchGroups: Array<{
    command: string
    project?: string
    count: number
  }> = []

  try {
    const d = await db()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      lessonCountRaw,
      recentLessonsRaw,
      recallCountRaw,
      recentRecallsRaw,
      nomatchRaw,
    ] = await Promise.all([
      d.collection('lessons').countDocuments({ authorId }),
      d
        .collection('lessons')
        .find({ authorId })
        .sort({ createdAt: -1 })
        .limit(RECENT_LIMIT)
        .project({ title: 1, weight: 1, createdAt: 1, tags: 1 })
        .toArray(),
      d
        .collection('recall_history')
        .countDocuments({ authorId, createdAt: { $gte: since24h } }),
      d
        .collection('recall_history')
        .find({ authorId })
        .sort({ createdAt: -1 })
        .limit(RECENT_LIMIT)
        .toArray(),
      d
        .collection('recall_history')
        .aggregate([
          {
            $match: {
              authorId,
              createdAt: { $gte: since24h },
              resultCount: 0,
              'agentContext.triggerCommand': { $exists: true, $ne: '' },
            },
          },
          {
            $group: {
              _id: {
                command: '$agentContext.triggerCommand',
                project: '$agentContext.project',
              },
              count: { $sum: 1 },
              latest: { $max: '$createdAt' },
            },
          },
          { $sort: { count: -1, latest: -1 } },
          { $limit: NOMATCH_GROUP_LIMIT },
        ])
        .toArray(),
    ])

    lessonCount = lessonCountRaw
    recentLessons = recentLessonsRaw.map((l) => ({
      _id: (l._id as ObjectId).toString(),
      title: String((l as { title?: string }).title ?? '(untitled)'),
      weight: (l as { weight?: number }).weight,
      createdAt: (l as { createdAt?: Date }).createdAt,
      tags: ((l as { tags?: string[] }).tags ?? []) as string[],
    }))
    recallCount24h = recallCountRaw
    recentRecalls = recentRecallsRaw.map((r) => {
      const o = r as Record<string, unknown> & {
        _id: ObjectId
        agentContext?: { triggerCommand?: string; project?: string } | null
      }
      return {
        _id: o._id.toString(),
        source: o.source as 'agent' | 'web',
        query: String(o.query ?? ''),
        resultCount: Number(o.resultCount ?? 0),
        triggerCommand: o.agentContext?.triggerCommand,
        project: o.agentContext?.project,
        createdAt: o.createdAt as Date,
      }
    })
    nomatchGroups = nomatchRaw.map((g) => {
      const o = g as { _id: { command: string; project?: string }; count: number }
      return {
        command: o._id.command,
        project: o._id.project,
        count: o.count,
      }
    })
  } catch {
    // empty state
  }

  const newUser = lessonCount === 0 && recallCount24h === 0

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">Dashboard</h1>
          <p className="text-sm text-neutral-600">
            What you've taught Claude · what Claude looked up.
          </p>
        </div>

        {newUser && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
            <p className="font-serif text-lg">Get started</p>
            <p className="text-sm text-neutral-700">
              Run this in your shell, then reload your Claude Code session:
            </p>
            <pre className="bg-neutral-900 text-neutral-100 text-sm rounded-lg px-4 py-2 overflow-x-auto font-mono">
              npx claudewall init
            </pre>
            <p className="text-xs text-neutral-500">
              Auths your device, installs <code className="font-mono">/lesson</code>{' '}
              and <code className="font-mono">/recall</code>, and registers
              the PostToolUseFailure hook so Bash failures auto-pull
              matching past lessons.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 min-w-0">
          {/* Lessons column */}
          <section className="bg-white rounded-2xl shadow-sm p-5 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-serif text-xl">Lessons</h2>
                <span className="text-sm text-neutral-500">
                  {lessonCount.toLocaleString()}
                </span>
              </div>
              <Link
                href="/l"
                className="text-xs text-neutral-500 hover:underline"
              >
                See all →
              </Link>
            </div>
            {recentLessons.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">
                No lessons captured yet. Run{' '}
                <code className="font-mono bg-neutral-100 px-1 rounded">
                  /lesson
                </code>{' '}
                in any Claude Code session after a misstep.
              </p>
            ) : (
              <ul className="space-y-2 flex-1">
                {recentLessons.map((l) => (
                  <li key={l._id} className="min-w-0">
                    <Link
                      href={`/l/${l._id}`}
                      className="flex items-baseline gap-2 hover:underline min-w-0"
                    >
                      <span className="text-neutral-400 font-mono text-xs shrink-0">
                        {'★'.repeat(l.weight ?? 3)}
                        {'·'.repeat(5 - (l.weight ?? 3))}
                      </span>
                      <span className="text-sm flex-1 truncate min-w-0">
                        {l.title}
                      </span>
                      {l.createdAt && (
                        <span className="text-[11px] text-neutral-400 shrink-0">
                          {timeAgo(l.createdAt)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-neutral-400 mt-3 pt-3 border-t border-neutral-100">
              Capture: <code className="font-mono">/lesson</code> in CC
            </p>
          </section>

          {/* Recalls column */}
          <section className="bg-white rounded-2xl shadow-sm p-5 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-serif text-xl">Recalls</h2>
                <span className="text-sm text-neutral-500">
                  {recallCount24h.toLocaleString()} in 24h
                </span>
              </div>
              <Link
                href="/r"
                className="text-xs text-neutral-500 hover:underline"
              >
                See all →
              </Link>
            </div>
            {recentRecalls.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">
                No recalls yet. They appear automatically after Bash
                failures (agent) or via search (web).
              </p>
            ) : (
              <ul className="space-y-2 flex-1">
                {recentRecalls.map((r) => {
                  const cmd = r.triggerCommand ?? r.query
                  const noMatch = r.resultCount === 0
                  return (
                    <li key={r._id} className="min-w-0">
                      <Link
                        href={`/r/${r._id}`}
                        className="block hover:bg-neutral-50 rounded-md -mx-1 px-1 py-1 min-w-0"
                      >
                        <div className="flex items-baseline gap-2 text-xs text-neutral-500 min-w-0">
                          <span aria-hidden className="shrink-0">
                            {r.source === 'agent' ? '🤖' : '👤'}
                          </span>
                          <span className="shrink-0">
                            {timeAgo(r.createdAt)}
                          </span>
                          {r.project && (
                            <>
                              <span className="text-neutral-300 shrink-0">·</span>
                              <span className="font-mono truncate min-w-0">
                                {r.project}
                              </span>
                            </>
                          )}
                          <span className="ml-auto shrink-0">
                            {noMatch ? (
                              <span className="text-amber-600">⚠ 0</span>
                            ) : (
                              `${r.resultCount} hit${r.resultCount === 1 ? '' : 's'}`
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-800 font-mono mt-0.5 truncate">
                          {truncate(cmd, 80)}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="text-[11px] text-neutral-400 mt-3 pt-3 border-t border-neutral-100">
              Auto-fired on Bash failures via PostToolUseFailure hook
            </p>
          </section>
        </div>

        {nomatchGroups.length > 0 && (
          <section className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3 min-w-0 overflow-hidden">
            <div className="flex items-baseline gap-2">
              <span aria-hidden>⚠</span>
              <h2 className="font-serif text-lg">
                Zero-match recalls in the last 24h
              </h2>
            </div>
            <p className="text-sm text-neutral-700">
              These commands failed and the agent had no matching lesson.
              Strong candidates for{' '}
              <code className="font-mono bg-white px-1 rounded">/lesson</code>{' '}
              capture next time you solve them.
            </p>
            <ul className="space-y-1">
              {nomatchGroups.map((g, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 text-sm font-mono text-neutral-800 min-w-0"
                >
                  <span className="text-neutral-400 shrink-0">•</span>
                  <span className="flex-1 truncate min-w-0">
                    {truncate(g.command, 90)}
                  </span>
                  {g.project && (
                    <span className="text-xs text-neutral-500 shrink-0">
                      {g.project}
                    </span>
                  )}
                  {g.count > 1 && (
                    <span className="text-xs text-amber-700 shrink-0">
                      ×{g.count}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/r?nomatch=1&range=24h"
              className="inline-block text-sm text-neutral-700 hover:underline"
            >
              Open zero-match recalls →
            </Link>
          </section>
        )}
      </div>
    </main>
  )
}
