import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import SiteHeader from '../../_components/SiteHeader'
import DeleteButton from '../../_components/DeleteButton'
import { deleteTip } from '../../_actions/tips'

export const dynamic = 'force-dynamic'

export default async function TipDetailPage({
  params,
}: {
  params: Promise<{ tipId: string }>
}) {
  const { tipId } = await params

  let _id: ObjectId
  try {
    _id = new ObjectId(tipId)
  } catch {
    notFound()
  }

  const tip = await (await db()).collection('tips').findOne({ _id: _id! })
  if (!tip) notFound()

  const session = await auth()
  const sessionHandle = (session?.user as { handle?: string } | undefined)
    ?.handle

  const title = String((tip as { title?: string }).title ?? '')
  const body = String((tip as { body?: string }).body ?? '')
  const code = (tip as { code?: string }).code
  const lang = (tip as { lang?: string }).lang
  const tags = ((tip as { tags?: unknown }).tags ?? []) as string[]
  const handle = String((tip as { authorHandle?: string }).authorHandle ?? '')
  const name = (tip as { authorName?: string }).authorName
  const image = (tip as { authorImage?: string | null }).authorImage
  const model = (tip as { model?: string }).model
  const isOwn = sessionHandle !== undefined && sessionHandle === handle

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <article className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
          <h1 className="font-serif text-2xl sm:text-3xl leading-tight">
            {title}
          </h1>

          <p className="text-base text-neutral-800 whitespace-pre-wrap leading-relaxed">
            {body}
          </p>

          {code && (
            <pre className="bg-neutral-50 border border-neutral-200/70 rounded-lg px-4 py-3 text-sm font-mono whitespace-pre overflow-x-auto leading-relaxed">
              {code}
            </pre>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Link
                  key={t}
                  href={`/tips?tag=${encodeURIComponent(t)}`}
                  className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded transition"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-5 border-t border-neutral-100 flex items-center gap-3 flex-wrap">
            {image && (
              <img src={image} alt="" className="w-9 h-9 rounded-full" />
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
            <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
              {lang && <span className="font-mono">{lang}</span>}
              {model && <span className="font-mono">{model}</span>}
              {isOwn && (
                <DeleteButton
                  id={tipId}
                  action={deleteTip}
                  noun="tip"
                  redirectTo="/tips"
                  variant="inline"
                />
              )}
            </div>
          </div>
        </article>
      </div>
    </main>
  )
}
