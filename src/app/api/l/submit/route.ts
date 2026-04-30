import type { NextRequest } from 'next/server'
import { db, ensureIndexes } from '@/lib/mongo'
import { embedText } from '@/lib/embedding'

const MAX_TITLE = 140
const MAX_TRIGGER = 500
const MAX_DETECTION = 600
const MAX_MISTAKE = 1000
const MAX_REPLACEMENT = 1000
const MAX_VERIFICATION = 400
const MAX_PROJECT = 100
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
    trigger?: unknown
    detection?: unknown
    mistake?: unknown
    replacement?: unknown
    verification?: unknown
    project?: unknown
    tags?: unknown
    weight?: unknown
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

  const trigger = String(body.trigger ?? '').trim()
  if (!trigger || trigger.length > MAX_TRIGGER) {
    return Response.json(
      { error: `trigger must be 1..${MAX_TRIGGER} chars` },
      { status: 400 },
    )
  }

  const detection = String(body.detection ?? '').trim()
  if (!detection || detection.length > MAX_DETECTION) {
    return Response.json(
      { error: `detection must be 1..${MAX_DETECTION} chars` },
      { status: 400 },
    )
  }

  const mistake = String(body.mistake ?? '').trim()
  if (!mistake || mistake.length > MAX_MISTAKE) {
    return Response.json(
      { error: `mistake must be 1..${MAX_MISTAKE} chars` },
      { status: 400 },
    )
  }

  const replacement = String(body.replacement ?? '').trim()
  if (!replacement || replacement.length > MAX_REPLACEMENT) {
    return Response.json(
      { error: `replacement must be 1..${MAX_REPLACEMENT} chars` },
      { status: 400 },
    )
  }

  const verificationRaw = body.verification
    ? String(body.verification).trim()
    : ''
  const verification =
    verificationRaw.length > 0
      ? verificationRaw.slice(0, MAX_VERIFICATION)
      : undefined

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

  const weight = Math.max(
    1,
    Math.min(5, Number((body as { weight?: number }).weight) || 3),
  )

  const projectRaw = body.project ? String(body.project).trim() : ''
  const project =
    projectRaw.length > 0 ? projectRaw.slice(0, MAX_PROJECT) : undefined

  await ensureIndexes()

  // Embed trigger + detection + mistake + replacement + tags. The trigger
  // and mistake carry the natural-language semantics that match user
  // queries; detection and replacement carry the concrete agent-actionable
  // patterns that match implementation queries. Title and verification stay
  // out — title is editorial, verification is a post-action check that
  // rarely matches a recall query.
  const corpus = [trigger, detection, mistake, replacement, tags.join(' ')]
    .filter(Boolean)
    .join('\n')
  const embedding = await embedText(corpus)

  const lesson = {
    authorId: user._id,
    authorHandle: (user as { handle?: string }).handle,
    authorName: user.name,
    authorImage: user.image,
    title,
    trigger,
    detection,
    mistake,
    replacement,
    verification,
    project,
    tags,
    weight,
    model: body.model ? String(body.model).slice(0, 80) : undefined,
    embedding,
    createdAt: new Date(),
  }

  const r = await d.collection('lessons').insertOne(lesson)

  await d
    .collection('cli_tokens')
    .updateOne({ _id: tokenRow._id }, { $set: { lastUsedAt: new Date() } })

  const id = r.insertedId.toString()
  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || ''
  return Response.json({ id, url: `${origin}/l/${id}` })
}
