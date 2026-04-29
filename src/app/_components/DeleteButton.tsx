'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Variant = 'overlay' | 'inline'

export default function DeleteButton({
  id,
  action,
  noun = 'item',
  redirectTo,
  variant = 'overlay',
}: {
  id: string
  action: (id: string) => Promise<void>
  noun?: string
  redirectTo?: string
  variant?: Variant
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    if (!window.confirm(`Delete this ${noun}? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        await action(id)
        if (redirectTo) router.push(redirectTo)
        else router.refresh()
      } catch (err) {
        window.alert(`Delete failed: ${(err as Error).message}`)
      }
    })
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="px-3 py-1.5 text-sm rounded-md text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Delete this ${noun}`}
      title="Delete"
      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white hover:bg-red-600 flex items-center justify-center backdrop-blur-sm transition opacity-100 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50 z-10"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  )
}
