import { auth } from '@/lib/auth'
import { db } from '@/lib/mongo'
import { ObjectId } from 'mongodb'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  const sessionUser = session?.user as { id?: string; handle?: string } | undefined
  if (!sessionUser?.id) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { handle?: string; action?: string }
  const handle = String(body.handle ?? '').trim()
  if (!handle) return Response.json({ error: 'missing handle' }, { status: 400 })
  const action = body.action === 'unfollow' ? 'unfollow' : 'follow'

  const d = await db()
  const followee = await d.collection('users').findOne({ handle })
  if (!followee) return Response.json({ error: 'not found' }, { status: 404 })

  const followerId = new ObjectId(sessionUser.id)
  if (followerId.equals(followee._id)) {
    return Response.json({ error: 'cannot follow self' }, { status: 400 })
  }

  if (action === 'follow') {
    await d.collection('follows').updateOne(
      { followerId, followeeId: followee._id },
      { $setOnInsert: { followerId, followeeId: followee._id, createdAt: new Date() } },
      { upsert: true },
    )
  } else {
    await d.collection('follows').deleteOne({ followerId, followeeId: followee._id })
  }

  return Response.json({ ok: true, following: action === 'follow' })
}
