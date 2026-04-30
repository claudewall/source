'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Source = 'agent' | 'web' | 'all'

type LessonHit = {
  _id: string
  title: string
  trigger?: string
  detection?: string
  replacement?: string
  verification?: string
  weight?: number
  score?: number
  tags?: string[]
}

type HistoryItem = {
  _id: string
  source: 'agent' | 'web'
  query: string
  resultCount: number
  topScore: number | null
  agentContext: {
    sessionId?: string
    cwd?: string
    project?: string
    triggerCommand?: string
    triggerError?: string
  } | null
  createdAt: string
  results: Array<{ _id: string; title: string; weight?: number }>
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000))
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

export default function RecallPopover() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LessonHit[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [source, setSource] = useState<Source>('agent')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setHistoryLoading(true)
    const url =
      source === 'all'
        ? '/api/l/recall-history?limit=10'
        : `/api/l/recall-history?source=${source}&limit=10`
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setHistory(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [open, source])

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      setSearchResults(null)
      setSearchError(null)
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const r = await fetch('/api/l/recall', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q }),
      })
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string }
        setSearchResults([])
        setSearchError(body?.error ?? `HTTP ${r.status}`)
      } else {
        const data = (await r.json()) as { lessons?: LessonHit[] }
        setSearchResults(Array.isArray(data?.lessons) ? data.lessons : [])
      }
    } catch (err) {
      setSearchError((err as Error).message)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setSearchResults(null)
    setSearchError(null)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-neutral-700 hover:bg-neutral-200/70 transition"
        aria-label="Recall"
        title="Recall"
        aria-expanded={open}
      >
        <SearchIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Recall</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[420px] max-w-[95vw] bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <form onSubmit={runSearch} className="p-3 border-b border-neutral-100 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your lessons…"
              className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-3 py-1.5 text-sm bg-black text-white rounded-md disabled:opacity-50"
            >
              {searching ? '…' : 'Go'}
            </button>
            {(query || searchResults) && (
              <button
                type="button"
                onClick={clearSearch}
                className="px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-900"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </form>

          {searchResults !== null ? (
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="px-4 py-2 text-xs text-neutral-500 border-b border-neutral-100">
                Search results
                {searchError && (
                  <span className="text-red-600 ml-2">· {searchError}</span>
                )}
              </div>
              {searchResults.length === 0 ? (
                <div className="px-4 py-8 text-sm text-neutral-500 text-center">
                  No lessons close enough yet.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {searchResults.map((l) => (
                    <li key={l._id}>
                      <Link
                        href={`/l/${l._id}`}
                        className="block px-4 py-3 hover:bg-neutral-50"
                        onClick={() => setOpen(false)}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-sm leading-snug flex-1">
                            {l.title}
                          </span>
                          {typeof l.score === 'number' && (
                            <span className="text-[10px] font-mono text-neutral-400">
                              {l.score.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {l.trigger && (
                          <p className="text-xs text-neutral-500 italic line-clamp-1 mt-1">
                            {l.trigger}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="px-4 py-2 text-xs text-neutral-500 flex items-center justify-between border-b border-neutral-100">
                <span>Recent recalls</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as Source)}
                  className="text-xs bg-transparent border border-neutral-200 rounded px-1.5 py-0.5"
                >
                  <option value="agent">agent</option>
                  <option value="web">web</option>
                  <option value="all">all</option>
                </select>
              </div>

              {historyLoading ? (
                <div className="px-4 py-8 text-sm text-neutral-400 text-center">
                  Loading…
                </div>
              ) : !history || history.length === 0 ? (
                <div className="px-4 py-8 text-sm text-neutral-500 text-center">
                  No {source !== 'all' ? source : ''} recalls yet.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {history.map((h) => {
                    const isOpen = expandedId === h._id
                    const project = h.agentContext?.project
                    const command = h.agentContext?.triggerCommand ?? h.query
                    return (
                      <li key={h._id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((id) => (id === h._id ? null : h._id))
                          }
                          className="w-full text-left px-4 py-3 hover:bg-neutral-50"
                        >
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <span>{h.source === 'agent' ? '🤖' : '👤'}</span>
                            <span>{timeAgo(h.createdAt)}</span>
                            {project && (
                              <>
                                <span className="text-neutral-300">·</span>
                                <span className="font-mono truncate">
                                  {project}
                                </span>
                              </>
                            )}
                            <span className="ml-auto">
                              {h.resultCount === 0 ? (
                                <span className="text-amber-600">
                                  ⚠ no match
                                </span>
                              ) : (
                                <>
                                  {h.resultCount} hit
                                  {h.resultCount === 1 ? '' : 's'}
                                  {typeof h.topScore === 'number' && (
                                    <span className="text-neutral-400 ml-1">
                                      · {h.topScore.toFixed(2)}
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="text-sm text-neutral-800 mt-1 font-mono line-clamp-1">
                            {truncate(command, 100)}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-3 -mt-1 space-y-2">
                            {h.agentContext?.cwd && (
                              <div className="text-[11px] text-neutral-500">
                                <span className="text-neutral-400">cwd: </span>
                                <span className="font-mono">
                                  {h.agentContext.cwd}
                                </span>
                              </div>
                            )}
                            {h.agentContext?.triggerError && (
                              <pre className="text-[11px] bg-neutral-50 border border-neutral-200 rounded p-2 whitespace-pre-wrap break-words font-mono text-neutral-700 max-h-32 overflow-y-auto">
                                {truncate(h.agentContext.triggerError, 600)}
                              </pre>
                            )}
                            {h.results.length === 0 ? (
                              <div className="text-xs text-neutral-500 italic">
                                No lesson matched. Consider running{' '}
                                <code className="font-mono bg-neutral-100 px-1 rounded">
                                  /lesson
                                </code>{' '}
                                next time you encounter this.
                              </div>
                            ) : (
                              <ul className="space-y-1">
                                {h.results.map((r) => (
                                  <li key={r._id}>
                                    <Link
                                      href={`/l/${r._id}`}
                                      onClick={() => setOpen(false)}
                                      className="flex items-baseline gap-2 text-xs hover:underline"
                                    >
                                      <span className="text-neutral-400 font-mono">
                                        {'★'.repeat(r.weight ?? 3)}
                                        {'·'.repeat(5 - (r.weight ?? 3))}
                                      </span>
                                      <span className="flex-1 truncate">
                                        {r.title}
                                      </span>
                                      <span className="text-neutral-300">
                                        →
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
