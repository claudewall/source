import { ImageResponse } from 'next/og'
import { db } from '@/lib/mongo'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params

  let _id: ObjectId
  try {
    _id = new ObjectId(postId)
  } catch {
    return new Response('not found', { status: 404 })
  }

  const post = await (await db()).collection('posts').findOne({ _id })
  if (!post) return new Response('not found', { status: 404 })

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
    { width: 1024, height: 540 },
  )
}
