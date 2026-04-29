import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import SiteHeader from '../../_components/SiteHeader'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type RecallResponse = {
  q?: string
  lessons?: Array<{
    _id: string
    title: string
    trigger: string
    mistake: string
    correction: string
    tags?: string[]
    weight?: number
    score?: number
  }>
  error?: string
}

async function runRecall(q: string, cookie: string): Promise<RecallResponse> {
  if (!q) return { q: '', lessons: [] }
  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const url = `${proto}://${host}/api/l/recall?q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { cookie },
    })
    return (await res.json()) as RecallResponse
  } catch {
    return { error: 'Recall request failed.' }
  }
}

export default async function RecallPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/api/auth/signin')

  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 500)

  const h = await headers()
  const cookie = h.get('cookie') ?? ''
  const data = q ? await runRecall(q, cookie) : { q: '', lessons: [] }
  const lessons = data.lessons ?? []

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="mb-2">
          <h1 className="font-serif text-3xl">Recall</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Pull the lessons most relevant to a situation you're in right
            now.
          </p>
        </div>

        <form
          action="/l/recall"
          method="get"
          className="flex items-center gap-2 mt-4 mb-6"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Describe the situation in plain language…"
            className="flex-1 border border-neutral-300 rounded-md px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-md text-sm"
          >
            Recall
          </button>
        </form>

        {data.error && (
          <p className="text-sm text-red-600 mb-4">{data.error}</p>
        )}

        {q && !data.error && lessons.length === 0 && (
          <p className="text-sm text-neutral-500">
            No lessons close enough to <span className="font-mono">{q}</span>{' '}
            in your archive yet.
          </p>
        )}

        <div className="space-y-4">
          {lessons.map((l) => (
            <Link
              key={l._id}
              href={`/l/${l._id}`}
              className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition p-5 space-y-3"
            >
              <div className="flex items-start gap-3">
                <h3 className="font-serif text-lg leading-snug flex-1">
                  {l.title}
                </h3>
                {typeof l.score === 'number' && (
                  <span className="text-xs font-mono text-neutral-400 shrink-0">
                    {l.score.toFixed(3)}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 italic">
                when: {l.trigger}
              </p>
              <p className="text-sm text-neutral-700 line-clamp-2">
                <span className="text-neutral-500">do:</span> {l.correction}
              </p>
              {l.tags && l.tags.length > 0 && (
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
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
