'use client'

import { useState, useTransition } from 'react'

export default function FollowButton({
  handle,
  initial,
}: {
  handle: string
  initial: boolean
}) {
  const [following, setFollowing] = useState(initial)
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          action: following ? 'unfollow' : 'follow',
        }),
      })
      if (res.ok) setFollowing((v) => !v)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`px-4 py-1.5 rounded-full text-sm transition ${
        following
          ? 'bg-neutral-200 text-neutral-800'
          : 'bg-black text-white'
      } disabled:opacity-50`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
