'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

export default function HeaderTabs() {
  const pathname = usePathname() ?? '/'
  // Search lives in tip-territory (it queries the tips index), so /search
  // counts as Tips for active-tab purposes.
  const onTips =
    pathname.startsWith('/tips') || pathname.startsWith('/search')

  const baseTab =
    'py-1.5 border-b-2 text-sm transition whitespace-nowrap'
  const activeTab = 'border-neutral-900 text-neutral-900 font-medium'
  const inactiveTab =
    'border-transparent text-neutral-500 hover:text-neutral-900'

  return (
    <div className="flex items-center gap-4 sm:gap-5">
      <Link
        href="/"
        className={`${baseTab} ${!onTips ? activeTab : inactiveTab}`}
      >
        Quotes
      </Link>
      <Link
        href="/tips"
        className={`${baseTab} ${onTips ? activeTab : inactiveTab}`}
      >
        Tips
      </Link>
      {onTips && (
        <Link
          href="/search"
          className="text-neutral-500 hover:text-neutral-900 transition py-1.5"
          aria-label="Search tips"
          title="Search tips"
        >
          <SearchIcon className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
