'use server'

import { ObjectId } from 'mongodb'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/mongo'

export async function deletePost(postId: string) {
  const session = await auth()
  const sessionUser = session?.user as
    | { id?: string; handle?: string }
    | undefined
  if (!sessionUser?.id) {
    throw new Error('unauthorized')
  }

  let _id: ObjectId
  try {
    _id = new ObjectId(postId)
  } catch {
    throw new Error('invalid id')
  }

  const authorId = new ObjectId(sessionUser.id)

  const result = await (await db())
    .collection('posts')
    .deleteOne({ _id, authorId })

  if (result.deletedCount === 0) {
    throw new Error('not found or not yours')
  }

  revalidatePath('/')
  if (sessionUser.handle) {
    revalidatePath(`/u/${sessionUser.handle}`)
  }
  revalidatePath(`/p/${postId}`)
}
