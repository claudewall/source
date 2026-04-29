import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import SiteHeader from '../../_components/SiteHeader'
import DeleteQuoteButton from '../../_components/DeleteQuoteButton'
import LikeButton from '../../_components/LikeButton'
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

  let likedSet = new Set<string>()
  if (sessionUser?.id && posts.length > 0) {
    const ids = posts.map((p) => (p as { _id: ObjectId })._id)
    const liked = await d
      .collection('likes')
      .find({
        userId: new ObjectId(sessionUser.id),
        postId: { $in: ids },
      })
      .project({ postId: 1 })
      .toArray()
    likedSet = new Set(liked.map((l) => String(l.postId)))
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />
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
              const likeCount =
                (p as { likeCount?: number }).likeCount ?? 0
              return (
                <div
                  key={id}
                  className="relative mb-4 break-inside-avoid bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
                >
                  {isOwn && <DeleteQuoteButton postId={id} />}
                  <Link href={`/p/${id}`}>
                    <img
                      src={`/api/og/${id}`}
                      alt={quote}
                      className="w-full block"
                      loading="lazy"
                    />
                  </Link>
                  <div className="px-3 py-2 flex items-center justify-end">
                    <LikeButton
                      postId={id}
                      initialLiked={likedSet.has(id)}
                      initialCount={likeCount}
                      signedIn={!!sessionUser?.id}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
