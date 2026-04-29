import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import SiteHeader from '../../_components/SiteHeader'
import DeleteButton from '../../_components/DeleteButton'
import LikeButton from '../../_components/LikeButton'
import { deletePost } from '../../_actions/posts'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params

  let _id: ObjectId
  try {
    _id = new ObjectId(postId)
  } catch {
    notFound()
  }

  const d = await db()
  const post = await d.collection('posts').findOne({ _id: _id! })
  if (!post) notFound()

  const session = await auth()
  const sessionUser = session?.user as
    | { id?: string; handle?: string }
    | undefined
  const sessionHandle = sessionUser?.handle

  const handle = String((post as { authorHandle?: string }).authorHandle ?? '')
  const image = (post as { authorImage?: string | null }).authorImage
  const name = (post as { authorName?: string }).authorName
  const model = (post as { model?: string }).model
  const quote = String((post as { quote?: string }).quote ?? '')
  const likeCount = (post as { likeCount?: number }).likeCount ?? 0
  const isOwn = sessionHandle !== undefined && sessionHandle === handle

  let liked = false
  if (sessionUser?.id) {
    liked = !!(await d.collection('likes').findOne({
      userId: new ObjectId(sessionUser.id),
      postId: _id!,
    }))
  }

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <img
            src={`/api/p/og/${postId}`}
            alt={quote}
            className="w-full block"
          />
          <div className="p-5 flex items-center gap-3 flex-wrap">
            {image && (
              <img
                src={image}
                alt=""
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <Link
                href={`/u/${handle}`}
                className="font-medium hover:underline"
              >
                @{handle}
              </Link>
              {name && (
                <div className="text-sm text-neutral-500">{name}</div>
              )}
            </div>
            {model && (
              <span className="text-xs text-neutral-500 font-mono">
                {model}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <LikeButton
                postId={postId}
                initialLiked={liked}
                initialCount={likeCount}
                signedIn={!!sessionUser?.id}
                variant="inline"
              />
              {isOwn && (
                <DeleteButton
                  id={postId}
                  action={deletePost}
                  noun="quote"
                  redirectTo="/"
                  variant="inline"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
