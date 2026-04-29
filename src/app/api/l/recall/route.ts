import type { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { embedText } from '@/lib/embedding'
import { auth } from '@/lib/auth'

const VECTOR_INDEX = 'lessons_vector_index'
const NUM_CANDIDATES = 50
const FETCH_LIMIT = 5
const MIN_SCORE = 0.65
const MAX_RESULTS = 3

// Auth flexibly: Bearer token (CLI calls) or session cookie (browser calls).
// Either way we pin the search to the caller's own authorId.
async function callerAuthorId(req: NextRequest): Promise<ObjectId | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (!token) return null
    const d = await db()
    const tokenRow = await d.collection('cli_tokens').findOne({ token })
    if (!tokenRow) return null
    await d
      .collection('cli_tokens')
      .updateOne({ _id: tokenRow._id }, { $set: { lastUsedAt: new Date() } })
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

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 500)
  if (!q) return Response.json({ q: '', lessons: [] })

  const queryVec = await embedText(q)
  if (!queryVec) {
    return Response.json(
      {
        error:
          'Recall unavailable — embedding service is down or VOYAGE_API_KEY is not set.',
      },
      { status: 503 },
    )
  }

  const d = await db()

  let raw: Array<Record<string, unknown>> = []
  try {
    raw = await d
      .collection('lessons')
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: 'embedding',
            queryVector: queryVec,
            numCandidates: NUM_CANDIDATES,
            limit: FETCH_LIMIT,
            filter: { authorId: { $eq: authorId } },
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            trigger: 1,
            mistake: 1,
            correction: 1,
            tags: 1,
            weight: 1,
            createdAt: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray()
  } catch (err) {
    console.warn('lessons recall failed:', (err as Error).message)
    return Response.json(
      {
        error:
          'Recall index not configured. Create lessons_vector_index in Atlas Search → Vector Search.',
      },
      { status: 503 },
    )
  }

  const filtered = raw
    .filter((l) => ((l as { score?: number }).score ?? 0) >= MIN_SCORE)
    .slice(0, MAX_RESULTS)
    .map((l) => {
      const o = l as { _id: { toString(): string } } & Record<string, unknown>
      return { ...o, _id: o._id.toString() }
    })

  return Response.json({ q, lessons: filtered })
}
