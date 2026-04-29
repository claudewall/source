import Link from 'next/link'
import { headers } from 'next/headers'
import SiteHeader from '../_components/SiteHeader'

export const dynamic = 'force-dynamic'

type SearchResponse = {
  q?: string
  tips?: Array<{
    _id: string
    title: string
    body: string
    code?: string
    lang?: string
    tags?: string[]
    authorHandle?: string
    authorImage?: string | null
    score?: number
  }>
  error?: string
}

async function runSearch(q: string): Promise<SearchResponse> {
  if (!q) return { q: '', tips: [] }
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const url = `${proto}://${host}/api/search?q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return (await res.json()) as SearchResponse
  } catch {
    return { error: 'Search request failed.' }
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 200)

  const data = q ? await runSearch(q) : { q: '', tips: [] }
  const tips = data.tips ?? []

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <form
          action="/search"
          method="get"
          className="flex items-center gap-2 mb-6"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Search tips by meaning, not exact words…"
            className="flex-1 border border-neutral-300 rounded-md px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-md text-sm"
          >
            Search
          </button>
        </form>

        {data.error && (
          <p className="text-sm text-red-600 mb-4">{data.error}</p>
        )}

        {q && !data.error && tips.length === 0 && (
          <p className="text-sm text-neutral-500">
            No matches for{' '}
            <span className="font-mono">{q}</span>.
          </p>
        )}

        <div className="space-y-3">
          {tips.map((t) => (
            <Link
              key={t._id}
              href={`/t/${t._id}`}
              className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg leading-snug">
                    {t.title}
                  </h3>
                  <p className="text-sm text-neutral-700 mt-1 line-clamp-2">
                    {t.body}
                  </p>
                  {t.tags && t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.tags.map((tg) => (
                        <span
                          key={tg}
                          className="text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded"
                        >
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-neutral-500 mt-2 flex items-center gap-2">
                    {t.authorImage && (
                      <img
                        src={t.authorImage}
                        alt=""
                        className="w-4 h-4 rounded-full"
                      />
                    )}
                    @{t.authorHandle ?? 'unknown'}
                    {typeof t.score === 'number' && (
                      <span className="ml-auto font-mono text-neutral-400">
                        {t.score.toFixed(3)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
