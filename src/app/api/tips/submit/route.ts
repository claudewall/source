import type { NextRequest } from 'next/server'
import { db } from '@/lib/mongo'

const MAX_TITLE = 120
const MAX_BODY = 1000
const MAX_CODE = 1500
const MAX_LANG = 30
const MAX_TAGS = 5
const MAX_TAG_LEN = 30
const MIN_TAG_LEN = 2

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

  let body: {
    title?: unknown
    body?: unknown
    code?: unknown
    lang?: unknown
    tags?: unknown
    model?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim()
  if (!title || title.length > MAX_TITLE) {
    return Response.json(
      { error: `title must be 1..${MAX_TITLE} chars` },
      { status: 400 },
    )
  }

  const tipBody = String(body.body ?? '').trim()
  if (!tipBody || tipBody.length > MAX_BODY) {
    return Response.json(
      { error: `body must be 1..${MAX_BODY} chars` },
      { status: 400 },
    )
  }

  const codeRaw = body.code ? String(body.code) : ''
  const code = codeRaw.length > 0 ? codeRaw.slice(0, MAX_CODE) : undefined

  const langRaw = body.lang ? String(body.lang).toLowerCase().trim() : ''
  const lang =
    langRaw.length > 0 && langRaw.length <= MAX_LANG ? langRaw : undefined

  let tags: string[] = []
  if (Array.isArray(body.tags)) {
    const seen = new Set<string>()
    for (const raw of body.tags) {
      const t = String(raw).toLowerCase().trim()
      if (
        t.length >= MIN_TAG_LEN &&
        t.length <= MAX_TAG_LEN &&
        /^[a-z0-9][a-z0-9-]*$/.test(t) &&
        !seen.has(t)
      ) {
        seen.add(t)
        tags.push(t)
        if (tags.length >= MAX_TAGS) break
      }
    }
  }
  if (tags.length === 0) {
    return Response.json(
      { error: 'at least one tag required' },
      { status: 400 },
    )
  }

  const tip = {
    authorId: user._id,
    authorHandle: (user as { handle?: string }).handle,
    authorName: user.name,
    authorImage: user.image,
    title,
    body: tipBody,
    code,
    lang,
    tags,
    model: body.model ? String(body.model).slice(0, 80) : undefined,
    likeCount: 0,
    createdAt: new Date(),
  }
  const r = await d.collection('tips').insertOne(tip)

  await d
    .collection('cli_tokens')
    .updateOne({ _id: tokenRow._id }, { $set: { lastUsedAt: new Date() } })

  const id = r.insertedId.toString()
  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || ''
  return Response.json({
    id,
    url: `${origin}/tips/${id}`,
  })
}
