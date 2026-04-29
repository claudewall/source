import { db } from '@/lib/mongo'
import { ObjectId } from 'mongodb'
import type { NextRequest } from 'next/server'

const MAX_QUOTE = 500
const MAX_RATIONALE = 200

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7).trim()
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const d = await db()
  const tokenRow = await d.collection('cli_tokens').findOne({ token })
  if (!tokenRow) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const user = await d.collection('users').findOne({ _id: tokenRow.userId })
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  let body: { quote?: unknown; model?: unknown; rationale?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const quote = String(body.quote ?? '').trim()
  if (!quote || quote.length > MAX_QUOTE) {
    return Response.json({ error: `quote must be 1–${MAX_QUOTE} chars` }, { status: 400 })
  }

  const post = {
    authorId: user._id,
    authorHandle: (user as { handle?: string }).handle,
    authorName: user.name,
    authorImage: user.image,
    quote,
    model: body.model ? String(body.model).slice(0, 80) : undefined,
    rationale: body.rationale ? String(body.rationale).slice(0, MAX_RATIONALE) : undefined,
    likeCount: 0,
    createdAt: new Date(),
  }
  const r = await d.collection('posts').insertOne(post)

  await d.collection('cli_tokens').updateOne(
    { _id: tokenRow._id },
    { $set: { lastUsedAt: new Date() } },
  )

  const id = r.insertedId.toString()
  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || ''
  return Response.json({
    id,
    url: `${origin}/p/${id}`,
    image: `${origin}/api/p/og/${id}`,
  })
}
