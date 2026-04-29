'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Variant = 'card' | 'inline'

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
  signedIn,
  variant = 'card',
}: {
  postId: string
  initialLiked: boolean
  initialCount: number
  signedIn: boolean
  variant?: Variant
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) {
      router.push('/api/auth/signin')
      return
    }
    if (pending) return

    const wasLiked = liked
    setLiked(!wasLiked)
    setCount((c) => c + (wasLiked ? -1 : 1))

    startTransition(async () => {
      try {
        const res = await fetch('/api/p/like', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ postId }),
        })
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as {
          liked: boolean
          likeCount: number
        }
        setLiked(data.liked)
        setCount(data.likeCount)
      } catch {
        // Revert optimistic update on failure.
        setLiked(wasLiked)
        setCount((c) => c + (wasLiked ? 1 : -1))
      }
    })
  }

  const sizeClasses =
    variant === 'inline' ? 'text-sm gap-1.5 px-1' : 'text-xs gap-1'
  const iconSize = variant === 'inline' ? 'w-5 h-5' : 'w-4 h-4'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={liked ? 'Unlike' : 'Like'}
      title={signedIn ? (liked ? 'Unlike' : 'Like') : 'Sign in to like'}
      className={`inline-flex items-center ${sizeClasses} transition disabled:opacity-50 ${
        liked
          ? 'text-red-600'
          : 'text-neutral-500 hover:text-red-600'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={iconSize}
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
      <span>{count}</span>
    </button>
  )
}
