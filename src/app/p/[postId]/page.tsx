import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ postId: string }>
}) {
  const { postId } = await params

  let _id: ObjectId
  try {
    _id = new ObjectId(postId)
  } catch {
    notFound()
  }

  const post = await (await db()).collection('posts').findOne({ _id: _id! })
  if (!post) notFound()

  const handle = String((post as { authorHandle?: string }).authorHandle ?? '')
  const image = (post as { authorImage?: string | null }).authorImage
  const name = (post as { authorName?: string }).authorName
  const model = (post as { model?: string }).model
  const quote = String((post as { quote?: string }).quote ?? '')

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <header className="px-6 py-4 border-b border-neutral-200/70">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          claudewall
        </Link>
      </header>
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <img
            src={`/api/og/${postId}`}
            alt={quote}
            className="w-full block"
          />
          <div className="p-5 flex items-center gap-3">
            {image && (
              <img
                src={image}
                alt=""
                className="w-10 h-10 rounded-full"
              />
            )}
            <div>
              <Link
                href={`/u/${handle}`}
                className="font-medium hover:underline"
              >
                @{handle}
              </Link>
              {name && (
                <div className="text-sm text-neutral-500">{name}</div>
              )}
            </div>
            {model && (
              <span className="ml-auto text-xs text-neutral-500 font-mono">
                {model}
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
