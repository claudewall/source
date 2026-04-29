import type { NextRequest } from 'next/server'
import { db } from '@/lib/mongo'
import { embedText } from '@/lib/embedding'

const VECTOR_INDEX = 'tips_vector_index'
const NUM_CANDIDATES = 100
const LIMIT = 20

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 500)
  if (!q) return Response.json({ q: '', tips: [] })

  const queryVec = await embedText(q)
  if (!queryVec) {
    return Response.json(
      {
        error:
          'Search unavailable — VOYAGE_API_KEY not set, or the embedding service is down.',
      },
      { status: 503 },
    )
  }

  const d = await db()

  let tips: Array<Record<string, unknown>> = []
  try {
    tips = await d
      .collection('tips')
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: 'embedding',
            queryVector: queryVec,
            numCandidates: NUM_CANDIDATES,
            limit: LIMIT,
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            body: 1,
            code: 1,
            lang: 1,
            tags: 1,
            authorHandle: 1,
            authorImage: 1,
            createdAt: 1,
            likeCount: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray()
  } catch (err) {
    console.warn('search aggregation failed:', (err as Error).message)
    return Response.json(
      {
        error:
          'Search index not configured. Create the tips_vector_index in Atlas Search → Vector Search.',
      },
      { status: 503 },
    )
  }

  return Response.json({
    q,
    tips: tips.map((t) => {
      const o = t as { _id: { toString(): string } } & Record<string, unknown>
      return { ...o, _id: o._id.toString() }
    }),
  })
}
