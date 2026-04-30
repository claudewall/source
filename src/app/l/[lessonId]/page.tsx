import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import SiteHeader from '../../_components/SiteHeader'
import DeleteButton from '../../_components/DeleteButton'
import { deleteLesson } from '../../_actions/lessons'

export const dynamic = 'force-dynamic'

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params

  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    redirect('/api/auth/signin')
  }

  let _id: ObjectId
  try {
    _id = new ObjectId(lessonId)
  } catch {
    notFound()
  }

  const authorId = new ObjectId(sessionUser.id)
  const lesson = await (await db())
    .collection('lessons')
    .findOne({ _id: _id!, authorId })
  if (!lesson) notFound()

  const title = String((lesson as { title?: string }).title ?? '')
  const trigger = String((lesson as { trigger?: string }).trigger ?? '')
  const detection = String((lesson as { detection?: string }).detection ?? '')
  const mistake = String((lesson as { mistake?: string }).mistake ?? '')
  const replacement = String(
    (lesson as { replacement?: string }).replacement ?? '',
  )
  const verification = (lesson as { verification?: string }).verification
  const tags = ((lesson as { tags?: unknown }).tags ?? []) as string[]
  const weight = Number((lesson as { weight?: number }).weight ?? 3)
  const model = (lesson as { model?: string }).model
  const project = (lesson as { project?: string }).project
  const authorHandle = String(
    (lesson as { authorHandle?: string }).authorHandle ?? '',
  )
  const authorImage = (lesson as { authorImage?: string | null }).authorImage

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <article className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <h1 className="font-serif text-2xl sm:text-3xl leading-tight flex-1">
              {title}
            </h1>
            <span
              className="text-sm text-neutral-400 font-mono shrink-0"
              title={`weight ${weight}/5`}
            >
              {'★'.repeat(weight)}
              {'·'.repeat(5 - weight)}
            </span>
          </div>

          <section>
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              Trigger — when this might come up
            </h2>
            <p className="text-base text-neutral-800 whitespace-pre-wrap leading-relaxed">
              {trigger}
            </p>
          </section>

          {detection && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                Detection — concrete check before acting
              </h2>
              <p className="text-base text-neutral-800 whitespace-pre-wrap leading-relaxed font-mono text-sm bg-neutral-50 border border-neutral-200/70 rounded-md px-3 py-2">
                {detection}
              </p>
            </section>
          )}

          <section>
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              Mistake — what went wrong
            </h2>
            <p className="text-base text-neutral-800 whitespace-pre-wrap leading-relaxed">
              {mistake}
            </p>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
              Replacement — what to do instead
            </h2>
            <p className="text-base text-neutral-800 whitespace-pre-wrap leading-relaxed">
              {replacement}
            </p>
          </section>

          {verification && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                Verification — confirm after acting
              </h2>
              <p className="text-base text-neutral-800 whitespace-pre-wrap leading-relaxed font-mono text-sm bg-neutral-50 border border-neutral-200/70 rounded-md px-3 py-2">
                {verification}
              </p>
            </section>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Link
                  key={t}
                  href={`/l?tag=${encodeURIComponent(t)}`}
                  className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded transition"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-5 border-t border-neutral-100 flex items-center gap-3 flex-wrap">
            <Link href="/l" className="text-sm text-neutral-500 hover:underline">
              ← all lessons
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 min-w-0">
              {authorImage && (
                <img
                  src={authorImage}
                  alt=""
                  className="w-4 h-4 rounded-full flex-none"
                />
              )}
              <span className="truncate">@{authorHandle}</span>
              {project && (
                <>
                  <span className="text-neutral-300">·</span>
                  <span className="font-mono truncate">{project}</span>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
              {model && <span className="font-mono">{model}</span>}
              <DeleteButton
                id={lessonId}
                action={deleteLesson}
                noun="lesson"
                redirectTo="/l"
                variant="inline"
              />
            </div>
          </div>
        </article>
      </div>
    </main>
  )
}
