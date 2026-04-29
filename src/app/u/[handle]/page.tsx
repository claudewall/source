import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import FollowButton from './FollowButton'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const d = await db()
  const user = await d.collection('users').findOne({ handle })
  if (!user) notFound()

  const session = await auth()
  const sessionUser = session?.user as
    | { id?: string; handle?: string }
    | undefined
  const isOwn = sessionUser?.handle === handle

  let isFollowing = false
  if (sessionUser?.id && !isOwn) {
    const followerId = new ObjectId(sessionUser.id)
    isFollowing = !!(await d.collection('follows').findOne({
      followerId,
      followeeId: user!._id,
    }))
  }

  const [posts, followers, following] = await Promise.all([
    d
      .collection('posts')
      .find({ authorId: user!._id })
      .sort({ createdAt: -1 })
      .limit(60)
      .toArray(),
    d.collection('follows').countDocuments({ followeeId: user!._id }),
    d.collection('follows').countDocuments({ followerId: user!._id }),
  ])

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <header className="px-6 py-4 border-b border-neutral-200/70">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-md"
          />
          <span className="font-serif text-2xl tracking-tight">claudewall</span>
        </Link>
      </header>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          {user!.image && (
            <img
              src={user!.image as string}
              alt=""
              className="w-16 h-16 rounded-full"
            />
          )}
          <div>
            <h1 className="text-2xl">@{(user as unknown as { handle: string }).handle}</h1>
            {user!.name && (
              <div className="text-neutral-600">{user!.name as string}</div>
            )}
            <div className="text-sm text-neutral-500 mt-1">
              {followers} follower{followers === 1 ? '' : 's'} ·{' '}
              {following} following · {posts.length} quote
              {posts.length === 1 ? '' : 's'}
            </div>
          </div>
          {!isOwn && sessionUser?.id && (
            <div className="ml-auto">
              <FollowButton handle={handle} initial={isFollowing} />
            </div>
          )}
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-neutral-500 mt-16">No quotes yet.</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {posts.map((p) => {
              const id = String(
                (p as { _id: { toString(): string } })._id,
              )
              const quote = String((p as { quote?: string }).quote ?? '')
              return (
                <div
                  key={id}
                  className="mb-4 break-inside-avoid bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  <Link href={`/p/${id}`}>
                    <img
                      src={`/api/og/${id}`}
                      alt={quote}
                      className="w-full block"
                      loading="lazy"
                    />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
