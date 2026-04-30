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
}

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
        'px-2.5 py-0.5 rounded-full text-xs border transition shrink-0 ' +
        (active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500')
      }
    >
      {label}
    </Link>
  )
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500 shrink-0">
        {label}
      </span>
      {children}
    </div>
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

  let rows: RecallRow[] = []
  let projects: string[] = []
  try {
    const d = await db()
    rows = (await d
      .collection('recall_history')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .project({
        _id: 1,
        source: 1,
        query: 1,
        resultIds: 1,
        resultCount: 1,
        topScore: 1,
        'agentContext.project': 1,
        'agentContext.triggerCommand': 1,
        'agentContext.triggerError': 1,
        createdAt: 1,
      })
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

  // Hydrate just the FIRST lesson per row (highest-scoring, by recall API
  // ordering). Card shows only that one — click into /r/:id for the rest.
  const topLessonIds = new Set<string>()
  for (const r of rows) {
    const ids = r.resultIds ?? []
    if (ids.length > 0) topLessonIds.add(ids[0].toString())
  }
  let lessonsById: Record<string, LessonHydrated> = {}
  if (topLessonIds.size > 0) {
    try {
      const d = await db()
      const lessons = await d
        .collection('lessons')
        .find(
          {
            _id: {
              $in: Array.from(topLessonIds).map((s) => new ObjectId(s)),
            },
          },
          { projection: { title: 1, weight: 1 } },
        )
        .toArray()
      lessonsById = Object.fromEntries(
        lessons.map((l) => [
          (l._id as ObjectId).toString(),
          {
            _id: (l._id as ObjectId).toString(),
            title: String((l as { title?: string }).title ?? '(untitled)'),
            weight: (l as { weight?: number }).weight,
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
    project: project || undefined,
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="px-4 sm:px-6 pt-5 pb-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">Recalls</h1>
          <p className="text-sm text-neutral-600">
            Audit trail of what's been queried — click a card for full
            detail.
          </p>
        </div>

        {/* Filters: stack vertically on mobile, single row on md+. */}
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-2">
          <FilterGroup label="Source">
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
          </FilterGroup>

          <FilterGroup label="Range">
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
          </FilterGroup>

          <FilterGroup label="Show">
            <FilterPill
              label="all"
              active={!nomatchOnly}
              href={buildHref(baseQS, { nomatch: undefined })}
            />
            <FilterPill
              label="no-match"
              active={nomatchOnly}
              href={buildHref(baseQS, { nomatch: '1' })}
            />
          </FilterGroup>

          {projects.length > 0 && (
            <FilterGroup label="Project">
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
            </FilterGroup>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-neutral-500 space-y-2 px-4">
          <p className="font-serif text-xl">No recalls match.</p>
          <p className="text-sm">
            Either nothing's been recalled in this window, or the filters
            are too narrow.
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-6 columns-1 sm:columns-2 lg:columns-3 gap-4">
          {rows.map((r) => {
            const isAgent = r.source === 'agent'
            const command =
              r.agentContext?.triggerCommand ?? r.query ?? '(empty)'
            const error = r.agentContext?.triggerError ?? ''
            const proj = r.agentContext?.project
            const noMatch = (r.resultCount ?? 0) === 0
            const topId = r.resultIds?.[0]?.toString()
            const topLesson = topId ? lessonsById[topId] : undefined
            const moreCount = (r.resultCount ?? 0) - (topLesson ? 1 : 0)
            return (
              <Link
                key={r._id.toString()}
                href={`/r/${r._id.toString()}`}
                className={
                  'group block mb-4 break-inside-avoid rounded-2xl shadow-sm hover:shadow-md transition border min-w-0 overflow-hidden ' +
                  (noMatch
                    ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                    : 'border-transparent bg-white')
                }
              >
                {/* Header */}
                <div className="px-5 pt-4 pb-2 flex items-baseline gap-2 text-xs text-neutral-600 min-w-0">
                  <span aria-hidden className="shrink-0">
                    {isAgent ? '🤖' : '👤'}
                  </span>
                  <span className="shrink-0">
                    {r.createdAt ? timeAgo(r.createdAt) : ''}
                  </span>
                  {proj && (
                    <>
                      <span className="text-neutral-300 shrink-0">·</span>
                      <span className="font-mono truncate min-w-0">
                        {proj}
                      </span>
                    </>
                  )}
                  <span className="ml-auto shrink-0">
                    {noMatch ? (
                      <span className="text-amber-700">⚠ no match</span>
                    ) : (
                      <>
                        {r.resultCount} hit
                        {r.resultCount === 1 ? '' : 's'}
                      </>
                    )}
                  </span>
                </div>

                <div className="px-5 pb-4 space-y-3">
                  {/* Command / query */}
                  <pre
                    className="bg-neutral-900 text-neutral-100 text-xs rounded-md px-3 py-2 font-mono whitespace-pre-wrap break-words overflow-hidden"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {isAgent ? '$ ' + command : `“${r.query ?? ''}”`}
                  </pre>

                  {/* Error preview (agent only, when present) */}
                  {isAgent && error && (
                    <pre
                      className="text-[11px] text-neutral-700 font-mono whitespace-pre-wrap break-words overflow-hidden leading-snug"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {error}
                    </pre>
                  )}

                  {/* Top match or no-match callout */}
                  {noMatch ? (
                    <div className="text-xs text-amber-800">
                      ⚠ No lesson matched ·{' '}
                      <span className="underline decoration-amber-300 underline-offset-2 group-hover:decoration-amber-500">
                        capture next time →
                      </span>
                    </div>
                  ) : (
                    topLesson && (
                      <div className="border-t border-neutral-100 pt-3 flex items-baseline gap-2 min-w-0">
                        <span className="text-neutral-400 font-mono text-[11px] shrink-0">
                          {'★'.repeat(topLesson.weight ?? 3)}
                          {'·'.repeat(5 - (topLesson.weight ?? 3))}
                        </span>
                        <span className="text-sm flex-1 truncate min-w-0">
                          {topLesson.title}
                        </span>
                        {typeof r.topScore === 'number' && (
                          <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                            {r.topScore.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )
                  )}

                  {!noMatch && moreCount > 0 && (
                    <div className="text-[11px] text-neutral-500">
                      + {moreCount} more
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
