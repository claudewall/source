import Link from 'next/link'

const VISIBLE = 15

function Pill({
  tag,
  count,
  active,
}: {
  tag: string
  count: number
  active: boolean
}) {
  // Active pill links back to /t (clears the filter); inactive pills set it.
  const href = active ? '/t' : `/t?tag=${encodeURIComponent(tag)}`
  return (
    <Link
      href={href}
      className={`inline-flex items-center text-xs rounded px-2 py-0.5 transition whitespace-nowrap ${
        active
          ? 'bg-neutral-900 text-white'
          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
      }`}
    >
      <span>#{tag}</span>
      <span className="ml-1 opacity-60">{count}</span>
    </Link>
  )
}

export default function TagCloud({
  tags,
  activeTag,
}: {
  tags: Array<{ tag: string; count: number }>
  activeTag: string
}) {
  if (tags.length === 0) return null

  const visible = tags.slice(0, VISIBLE)
  const hidden = tags.slice(VISIBLE)

  return (
    <div className="px-4 sm:px-6 pt-1 pb-3">
      {hidden.length === 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visible.map((t) => (
            <Pill
              key={t.tag}
              tag={t.tag}
              count={t.count}
              active={t.tag === activeTag}
            />
          ))}
        </div>
      ) : (
        <details className="group">
          <summary className="list-none cursor-default flex flex-wrap items-center gap-1.5">
            {visible.map((t) => (
              <Pill
                key={t.tag}
                tag={t.tag}
                count={t.count}
                active={t.tag === activeTag}
              />
            ))}
            <span className="cursor-pointer select-none text-xs text-neutral-500 hover:text-neutral-900 transition px-1">
              <span className="group-open:hidden">
                ▾ show {hidden.length} more
              </span>
              <span className="hidden group-open:inline">▴ show fewer</span>
            </span>
          </summary>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {hidden.map((t) => (
              <Pill
                key={t.tag}
                tag={t.tag}
                count={t.count}
                active={t.tag === activeTag}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
