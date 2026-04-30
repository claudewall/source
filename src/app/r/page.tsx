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
  resultCount?: number
  topScore?: number | null
  agentContext?: {
    project?: string
    triggerCommand?: string
  } | null
  createdAt?: Date
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

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n) + '…'
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
        resultCount: 1,
        topScore: 1,
        'agentContext.project': 1,
        'agentContext.triggerCommand': 1,
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

  const baseQS = {
    source: source !== 'all' ? source : undefined,
    range: range !== '7d' ? range : undefined,
    nomatch: nomatchOnly ? '1' : undefined,
    project: project || undefined,
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-3xl">Recalls</h1>
          <p className="text-sm text-neutral-600">
            Audit trail of what's been queried — click any row for full
            detail.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider text-neutral-500 w-16 shrink-0">
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
            <span className="text-xs uppercase tracking-wider text-neutral-500 w-16 shrink-0">
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
            <span className="text-xs uppercase tracking-wider text-neutral-500 w-16 shrink-0">
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

          {projects.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider text-neutral-500 w-16 shrink-0">
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
          <ul className="space-y-2 mt-6">
            {rows.map((r) => {
              const isAgent = r.source === 'agent'
              const summary =
                r.agentContext?.triggerCommand ?? r.query ?? '(empty)'
              const proj = r.agentContext?.project
              const noMatch = (r.resultCount ?? 0) === 0
              return (
                <li key={r._id.toString()} className="min-w-0">
                  <Link
                    href={`/r/${r._id.toString()}`}
                    className={
                      'block rounded-xl shadow-sm hover:shadow-md transition border min-w-0 overflow-hidden ' +
                      (noMatch
                        ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/60'
                        : 'border-transparent bg-white hover:bg-neutral-50')
                    }
                  >
                    <div className="px-4 py-3 min-w-0">
                      <div className="flex items-baseline gap-2 text-xs text-neutral-600 min-w-0">
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
                              {typeof r.topScore === 'number' && (
                                <span className="text-neutral-400 ml-2">
                                  {r.topScore.toFixed(2)}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        <span
                          className="text-neutral-300 shrink-0"
                          aria-hidden
                        >
                          →
                        </span>
                      </div>
                      <p className="text-sm text-neutral-800 font-mono mt-1 truncate min-w-0">
                        {isAgent ? truncate(summary, 120) : `“${truncate(summary, 120)}”`}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
