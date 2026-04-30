import type { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

async function callerAuthorId(req: NextRequest): Promise<ObjectId | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (!token) return null
    const d = await db()
    const tokenRow = await d.collection('cli_tokens').findOne({ token })
    if (!tokenRow) return null
    return tokenRow.userId as ObjectId
  }
  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) return null
  return new ObjectId(sessionUser.id)
}

export async function GET(req: NextRequest) {
  const authorId = await callerAuthorId(req)
  if (!authorId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const sourceParam = (sp.get('source') ?? 'all').toLowerCase()
  const source =
    sourceParam === 'agent' || sourceParam === 'web' ? sourceParam : null
  const limitRaw = Number(sp.get('limit') ?? DEFAULT_LIMIT)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
  )

  const filter: Record<string, unknown> = { authorId }
  if (source) filter.source = source

  const d = await db()
  const rows = await d
    .collection('recall_history')
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()

  // Hydrate lesson titles for each recall so the popover doesn't need a
  // round-trip per row. Only fetch titles for the union of resultIds.
  const allResultIds = new Set<string>()
  for (const r of rows) {
    const ids = (r as { resultIds?: ObjectId[] }).resultIds ?? []
    for (const id of ids) allResultIds.add(id.toString())
  }
  let lessonsById: Record<string, { title: string; weight?: number }> = {}
  if (allResultIds.size > 0) {
    const lessons = await d
      .collection('lessons')
      .find(
        { _id: { $in: Array.from(allResultIds).map((s) => new ObjectId(s)) } },
        { projection: { title: 1, weight: 1 } },
      )
      .toArray()
    lessonsById = Object.fromEntries(
      lessons.map((l) => [
        (l._id as ObjectId).toString(),
        {
          title: String((l as { title?: string }).title ?? '(untitled)'),
          weight: (l as { weight?: number }).weight,
        },
      ]),
    )
  }

  const items = rows.map((r) => {
    const o = r as Record<string, unknown> & { _id: ObjectId }
    const resultIds = ((o.resultIds as ObjectId[] | undefined) ?? []).map((id) =>
      id.toString(),
    )
    return {
      _id: o._id.toString(),
      source: o.source,
      query: o.query,
      resultCount: o.resultCount,
      topScore: o.topScore,
      agentContext: o.agentContext ?? null,
      createdAt: o.createdAt,
      results: resultIds.map((id) => ({
        _id: id,
        title: lessonsById[id]?.title ?? '(deleted lesson)',
        weight: lessonsById[id]?.weight,
      })),
    }
  })

  return Response.json({ items })
}
