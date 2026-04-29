import type { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { db, ensureIndexes } from '@/lib/mongo'

export async function POST(req: NextRequest) {
  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { postId?: string }
  let postId: ObjectId
  try {
    postId = new ObjectId(String(body.postId ?? ''))
  } catch {
    return Response.json({ error: 'invalid postId' }, { status: 400 })
  }

  await ensureIndexes()

  const userId = new ObjectId(sessionUser.id)
  const d = await db()

  const existing = await d.collection('likes').findOneAndDelete({
    userId,
    postId,
  })

  if (existing) {
    const updated = await d
      .collection('posts')
      .findOneAndUpdate(
        { _id: postId },
        { $inc: { likeCount: -1 } },
        { returnDocument: 'after' },
      )
    return Response.json({
      liked: false,
      likeCount: Math.max(
        0,
        (updated as { likeCount?: number } | null)?.likeCount ?? 0,
      ),
    })
  }

  try {
    await d
      .collection('likes')
      .insertOne({ userId, postId, createdAt: new Date() })
  } catch {
    // Duplicate key (race) — treat as already liked.
    const post = await d.collection('posts').findOne({ _id: postId })
    return Response.json({
      liked: true,
      likeCount: (post as { likeCount?: number } | null)?.likeCount ?? 1,
    })
  }

  const updated = await d
    .collection('posts')
    .findOneAndUpdate(
      { _id: postId },
      { $inc: { likeCount: 1 } },
      { returnDocument: 'after' },
    )
  return Response.json({
    liked: true,
    likeCount: (updated as { likeCount?: number } | null)?.likeCount ?? 1,
  })
}
