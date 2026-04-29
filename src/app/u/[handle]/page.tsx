import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/mongo'
import { auth } from '@/lib/auth'
import SiteHeader from '../../_components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const d = await db()
  const user = await d.collection('users').findOne({ handle })
  if (!user) notFound()

  const session = await auth()
  const sessionUser = session?.user as { handle?: string } | undefined
  const isOwn = sessionUser?.handle === handle

  // Lessons are private — only show count to others, full list to owner.
  const lessonCount = await d
    .collection('lessons')
    .countDocuments({ authorId: user!._id })

  const lessons = isOwn
    ? await d
        .collection('lessons')
        .find({ authorId: user!._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray()
    : []

  return (
    <main className="flex-1 bg-[#faf6ec] text-neutral-900">
      <SiteHeader />

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          {user!.image && (
            <img
              src={user!.image as string}
              alt=""
              className="w-16 h-16 rounded-full"
            />
          )}
          <div>
            <h1 className="text-2xl">
              @{(user as unknown as { handle: string }).handle}
            </h1>
            {user!.name && (
              <div className="text-neutral-600">{user!.name as string}</div>
            )}
            <div className="text-sm text-neutral-500 mt-1">
              {lessonCount} lesson{lessonCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {!isOwn && (
          <p className="text-sm text-neutral-500 italic">
            Lessons are private to their author.
          </p>
        )}

        {isOwn && lessons.length > 0 && (
          <div className="space-y-3">
            {lessons.map((l) => {
              const id = String((l as { _id: { toString(): string } })._id)
              const title = String((l as { title?: string }).title ?? '')
              const trigger = String(
                (l as { trigger?: string }).trigger ?? '',
              )
              const tags = ((l as { tags?: unknown }).tags ?? []) as string[]
              return (
                <Link
                  key={id}
                  href={`/l/${id}`}
                  className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition p-4 space-y-2"
                >
                  <h3 className="font-serif text-base leading-snug">
                    {title}
                  </h3>
                  <p className="text-xs text-neutral-500 italic line-clamp-1">
                    when: {trigger}
                  </p>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tg) => (
                        <span
                          key={tg}
                          className="text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded"
                        >
                          #{tg}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
