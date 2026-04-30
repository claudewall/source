import Link from 'next/link'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth, signIn } from '@/lib/auth'
import SiteHeader from '../_components/SiteHeader'

export const dynamic = 'force-dynamic'

const RANGE_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

type RecallRow = {
  _id: ObjectId
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

type LessonHydrated = {
  _id: string
  title: string
  weight?: number
  trigger?: string
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

function FilterPill({
  label,
  active,
  href,
}: {
  label: string
  active: boolean
  href: string
}) {
  return (
    <Link
      href={href}
      className={
        'px-3 py-1 rounded-full text-xs border transition ' +
        (active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500')
      }
    >
      {label}
    </Link>
  )
}

function buildHref(
  base: Record<string, string | undefined>,
  override: Record<string, string | undefined>,
): string {
  const merged: Record<string, string> = {}
  for (const [k, v] of Object.entries({ ...base, ...override })) {
    if (typeof v === 'string' && v.length > 0) merged[k] = v
  }
  const qs = new URLSearchParams(merged).toString()
  return '/r' + (qs ? '?' + qs : '')
}

export default async function RecallsPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string
    range?: string
    nomatch?: string
    q?: string
    project?: string
  }>
}) {
  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined

  if (!sessionUser?.id) {
    return (
      <main className="flex-1 bg-[#faf6ec] text-neutral-900">
        <SiteHeader />
        <div className="max-w-xl mx-auto p-10 text-center space-y-6">
          <h1 className="font-serif text-3xl">Recalls</h1>
          <p className="text-neutral-700">
            Your audit trail of recall queries — agent (Bash failures
            pulled into the next turn) and web (manual searches).
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

  const sp = await searchParams
  const sourceParam = (sp.source ?? 'all').toLowerCase()
  const source =
    sourceParam === 'agent' || sourceParam === 'web' ? sourceParam : 'all'
  const range = sp.range && RANGE_HOURS[sp.range] ? sp.range : '7d'
  const nomatchOnly = sp.nomatch === '1'
  const q = (sp.q ?? '').trim().slice(0, 200)
  const project = (sp.project ?? '').trim().slice(0, 100)

  const authorId = new ObjectId(sessionUser.id)

  const filter: Record<string, unknown> = {
    authorId,
    createdAt: {
      $gte: new Date(Date.now() - RANGE_HOURS[range] * 60 * 60 * 1000),
    },
  }
  if (source !== 'all') filter.source = source
  if (nomatchOnly) filter.resultCount = 0
  if (project) filter['agentContext.project'] = project
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rx = { $regex: safe, $options: 'i' }
    filter.$or = [
      { query: rx },
      { 'agentContext.triggerCommand': rx },
      { 'agentContext.triggerError': rx },
    ]
  }

  let rows: RecallRow[] = []
  let projects: string[] = []
  try {
    const d = await db()
    rows = (await d
      .collection('recall_history')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()) as unknown as RecallRow[]

    const distinctRaw = await d
      .collection('recall_history')
      .distinct('agentContext.project', { authorId })
    projects = distinctRaw
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .sort()
  } catch {
    // empty state
  }

  const allLessonIds = new Set<string>()
  for (const r of rows) {
    for (const id of r.resultIds ?? []) allLessonIds.add(id.toString())
  }
  let lessonsById: Record<string, LessonHydrated> = {}
  if (allLessonIds.size > 0) {
    try {
      const d = await db()
      const lessons = await d
        .collection('lessons')
        .find(
          {
            _id: {
              $in: Array.from(allLessonIds).map((s) => new ObjectId(s)),
            },
          },
          { projection: { title: 1, weight: 1, trigger: 1 } },
        )
        .toArray()
      lessonsById = Object.fromEntries(
        lessons.map((l) => [
          (l._id as ObjectId).toString(),
          {
            _id: (l._id as ObjectId).toString(),
            title: String((l as { title?: string }).title ?? '(untitled)'),
            weight: (l as { weight?: number }).weight,
            trigger: (l as { trigger?: string }).trigger,
          },
        ]),
      )
    } catch {
      // ignore
    }
  }

  const baseQS = {
    source: source !== 'all' ? source : undefined,
    range: range !== '7d' ? range : undefined,
    nomatch: nomatchOnly ? '1' : undefined,
    q: q || undefined,
    project: project || undefined,
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">Recalls</h1>
          <p className="text-sm text-neutral-600">
            Audit trail of what's been queried — agent (Bash failures) and
            web (manual searches).
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-neutral-500 w-16">
              Source
            </span>
            <FilterPill
              label="agent"
              active={source === 'agent'}
              href={buildHref(baseQS, { source: 'agent' })}
            />
            <FilterPill
              label="web"
              active={source === 'web'}
              href={buildHref(baseQS, { source: 'web' })}
            />
            <FilterPill
              label="all"
              active={source === 'all'}
              href={buildHref(baseQS, { source: undefined })}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-neutral-500 w-16">
              Range
            </span>
            {(['24h', '7d', '30d'] as const).map((r) => (
              <FilterPill
                key={r}
                label={r}
                active={range === r}
                href={buildHref(baseQS, {
                  range: r === '7d' ? undefined : r,
                })}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-neutral-500 w-16">
              Show
            </span>
            <FilterPill
              label="all"
              active={!nomatchOnly}
              href={buildHref(baseQS, { nomatch: undefined })}
            />
            <FilterPill
              label="no-match only"
              active={nomatchOnly}
              href={buildHref(baseQS, { nomatch: '1' })}
            />
          </div>

          <form
            action="/r"
            method="get"
            className="flex items-center gap-2 mt-3"
          >
            {source !== 'all' && (
              <input type="hidden" name="source" value={source} />
            )}
            {range !== '7d' && <input type="hidden" name="range" value={range} />}
            {nomatchOnly && <input type="hidden" name="nomatch" value="1" />}
            {project && (
              <input type="hidden" name="project" value={project} />
            )}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search command, query, or error…"
              className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-black text-white rounded-md"
            >
              Go
            </button>
            {(q || project) && (
              <Link
                href={buildHref(baseQS, { q: undefined, project: undefined })}
                className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-900"
              >
                clear
              </Link>
            )}
          </form>

          {projects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider text-neutral-500 w-16">
                Project
              </span>
              <FilterPill
                label="all"
                active={!project}
                href={buildHref(baseQS, { project: undefined })}
              />
              {projects.map((p) => (
                <FilterPill
                  key={p}
                  label={p}
                  active={project === p}
                  href={buildHref(baseQS, { project: p })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-10">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-neutral-500 space-y-2">
            <p className="font-serif text-xl">No recalls match.</p>
            <p className="text-sm">
              Either nothing's been recalled in this window, or the filters
              are too narrow.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {rows.map((r) => {
              const isAgent = r.source === 'agent'
              const command =
                r.agentContext?.triggerCommand ?? r.query ?? '(empty)'
              const error = r.agentContext?.triggerError ?? ''
              const proj = r.agentContext?.project
              const cwd = r.agentContext?.cwd
              const sessionId = r.agentContext?.sessionId
              const lessonHits = (r.resultIds ?? [])
                .map((id) => lessonsById[id.toString()])
                .filter(Boolean) as LessonHydrated[]
              const noMatch = (r.resultCount ?? 0) === 0
              return (
                <article
                  key={r._id.toString()}
                  className={
                    'bg-white rounded-2xl shadow-sm overflow-hidden border ' +
                    (noMatch
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-transparent')
                  }
                >
                  <header className="px-5 py-3 flex items-center gap-2 text-xs text-neutral-600 border-b border-neutral-100">
                    <span aria-hidden>{isAgent ? '🤖' : '👤'}</span>
                    <span>{r.createdAt ? timeAgo(r.createdAt) : ''}</span>
                    <span className="text-neutral-300">·</span>
                    <span>{isAgent ? 'agent' : 'web'}</span>
                    {proj && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span className="font-mono">{proj}</span>
                      </>
                    )}
                    <span className="ml-auto">
                      {noMatch ? (
                        <span className="text-amber-700">⚠ no match</span>
                      ) : (
                        <>
                          {r.resultCount} hit
                          {r.resultCount === 1 ? '' : 's'}
                          {typeof r.topScore === 'number' && (
                            <span className="text-neutral-400 ml-2">
                              top {r.topScore.toFixed(2)}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </header>

                  <div className="px-5 py-4 space-y-3">
                    {isAgent ? (
                      <>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
                            command
                          </div>
                          <pre className="bg-neutral-900 text-neutral-100 text-xs rounded-md p-3 overflow-x-auto font-mono whitespace-pre-wrap break-words">
                            {command}
                          </pre>
                        </div>
                        {error && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
                              error
                            </div>
                            <pre className="bg-neutral-50 border border-neutral-200 text-xs text-neutral-800 rounded-md p-3 overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                              {error}
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
                          query
                        </div>
                        <p className="text-sm font-mono text-neutral-800">
                          “{r.query}”
                        </p>
                      </div>
                    )}

                    {noMatch ? (
                      <div className="text-sm text-neutral-700 bg-amber-100/50 rounded-md p-3 border border-amber-200">
                        <span className="font-medium">No lesson matched.</span>{' '}
                        Strong candidate to capture — next time you solve
                        this, run{' '}
                        <code className="font-mono bg-white px-1 rounded">
                          /lesson
                        </code>{' '}
                        in that session.
                      </div>
                    ) : (
                      lessonHits.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">
                            matched lessons
                          </div>
                          <ul className="space-y-1">
                            {lessonHits.map((l) => (
                              <li key={l._id}>
                                <Link
                                  href={`/l/${l._id}`}
                                  className="flex items-baseline gap-2 text-sm hover:underline"
                                >
                                  <span className="text-neutral-400 font-mono text-xs shrink-0">
                                    {'★'.repeat(l.weight ?? 3)}
                                    {'·'.repeat(5 - (l.weight ?? 3))}
                                  </span>
                                  <span className="flex-1 truncate">
                                    {l.title}
                                  </span>
                                  <span className="text-neutral-300">→</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    )}

                    {(sessionId || cwd) && (
                      <div className="text-[11px] text-neutral-400 font-mono pt-1">
                        {sessionId && <span>{sessionId.slice(0, 8)}…</span>}
                        {sessionId && cwd && (
                          <span className="text-neutral-300"> · </span>
                        )}
                        {cwd && <span>{cwd}</span>}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
