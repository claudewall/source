import { ImageResponse } from 'next/og'
import { db } from '@/lib/mongo'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params

  // Short cache on 404s so a transient miss (e.g. just-deleted post)
  // doesn't pin a stale answer at the edge for long.
  const NOT_FOUND_HEADERS = {
    'Cache-Control': 'public, max-age=60, s-maxage=60',
  }

  let _id: ObjectId
  try {
    _id = new ObjectId(postId)
  } catch {
    return new Response('not found', { status: 404, headers: NOT_FOUND_HEADERS })
  }

  const post = await (await db()).collection('posts').findOne({ _id })
  if (!post) return new Response('not found', { status: 404, headers: NOT_FOUND_HEADERS })

  const quote = String(post.quote ?? '')
  const length = quote.length
  const fontSize = length > 220 ? 36 : length > 140 ? 44 : length > 80 ? 52 : 60

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f0e1',
          padding: '64px 96px',
          fontFamily: 'serif',
        }}
      >
        <div
          style={{
            fontSize,
            color: '#1a1a1a',
            textAlign: 'center',
            lineHeight: 1.35,
            maxWidth: '900px',
          }}
        >
          {quote}
        </div>
        <div
          style={{
            fontSize: 64,
            fontStyle: 'italic',
            color: '#1a1a1a',
            marginTop: 36,
          }}
        >
          —Claude
        </div>
      </div>
    ),
    {
      width: 1024,
      height: 540,
      headers: {
        // The rendered PNG is deterministic from the post — once a quote
        // is published the bytes don't change. Cache aggressively at the
        // CDN; let the browser hold a day; serve stale-while-revalidate
        // for a week to absorb any post-publish edits.
        'Cache-Control':
          'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
      },
    },
  )
}
