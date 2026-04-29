import { ImageResponse } from 'next/og'
import { db } from '@/lib/mongo'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

let fontsCache: Promise<{ regular: ArrayBuffer; italic: ArrayBuffer }> | null = null

function loadFonts(origin: string) {
  if (!fontsCache) {
    fontsCache = Promise.all([
      fetch(`${origin}/fonts/Lora-Regular.ttf`, { cache: 'force-cache' }).then(
        (r) => {
          if (!r.ok) throw new Error(`Lora-Regular: HTTP ${r.status}`)
          return r.arrayBuffer()
        },
      ),
      fetch(`${origin}/fonts/Lora-Italic.ttf`, { cache: 'force-cache' }).then(
        (r) => {
          if (!r.ok) throw new Error(`Lora-Italic: HTTP ${r.status}`)
          return r.arrayBuffer()
        },
      ),
    ])
      .then(([regular, italic]) => ({ regular, italic }))
      .catch((err) => {
        // Allow a retry on the next call.
        fontsCache = null
        throw err
      })
  }
  return fontsCache
}

export async function GET(
  req: Request,
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

  let fonts: { regular: ArrayBuffer; italic: ArrayBuffer } | null = null
  try {
    fonts = await loadFonts(new URL(req.url).origin)
  } catch (e) {
    console.warn('og: font load failed', (e as Error).message)
  }

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
          fontFamily: fonts ? 'Lora' : 'serif',
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
      ...(fonts && {
        fonts: [
          {
            name: 'Lora',
            data: fonts.regular,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Lora',
            data: fonts.italic,
            weight: 400,
            style: 'italic',
          },
        ],
      }),
    },
  )
}
