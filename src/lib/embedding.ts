// Generates 512-dim embeddings via Voyage AI (voyage-3-lite).
// Voyage is Anthropic's recommended embedding partner and runs cheap/fast
// on short text. Fails open: returns null on any error so the calling site
// can decide whether to skip the embedding or hard-fail.

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'
const MODEL = 'voyage-3-lite'

export const EMBEDDING_DIMS = 512

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) return null

  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  try {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: trimmed.slice(0, 16000),
        model: MODEL,
      }),
    })
    if (!res.ok) {
      console.warn(`voyage embed: HTTP ${res.status}`)
      return null
    }
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>
    }
    const vec = data.data?.[0]?.embedding
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
      console.warn('voyage embed: malformed response')
      return null
    }
    return vec
  } catch (err) {
    console.warn('voyage embed:', (err as Error).message)
    return null
  }
}
