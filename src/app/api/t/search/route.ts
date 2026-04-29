import type { NextRequest } from 'next/server'
import { db } from '@/lib/mongo'
import { embedText } from '@/lib/embedding'

const VECTOR_INDEX = 'tips_vector_index'
const NUM_CANDIDATES = 100
const LIMIT = 20

// Vector search returns a ranked list with no built-in cutoff. These filters
// turn it into a relevance-gated list: drop anything below an absolute
// floor (the model is basically guessing below this), and drop anything
// not within MIN_SCORE_RATIO of the top result (so a single great hit
// doesn't drag along weak ones, but a band of similarly-good hits all
// show through).
const MIN_SCORE = 0.55
const MIN_SCORE_RATIO = 0.85

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

  const topScore =
    typeof (tips[0] as { score?: number } | undefined)?.score === 'number'
      ? ((tips[0] as { score: number }).score)
      : 0
  const cutoff = Math.max(MIN_SCORE, topScore * MIN_SCORE_RATIO)

  const filtered = tips.filter((t) => {
    const s = (t as { score?: number }).score
    return typeof s === 'number' && s >= cutoff
  })

  return Response.json({
    q,
    tips: filtered.map((t) => {
      const o = t as { _id: { toString(): string } } & Record<string, unknown>
      return { ...o, _id: o._id.toString() }
    }),
  })
}
