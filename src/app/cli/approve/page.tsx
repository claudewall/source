import { auth, signIn } from '@/lib/auth'
import { db } from '@/lib/mongo'
import { ObjectId } from 'mongodb'
import crypto from 'node:crypto'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function approveAction(formData: FormData) {
  'use server'
  const session = await auth()
  const u = session?.user as { id?: string; handle?: string; name?: string } | undefined
  if (!u?.id) {
    redirect('/api/auth/signin')
  }

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  if (!code) redirect('/cli/approve?error=missing-code')

  const d = await db()
  const row = await d.collection('cli_codes').findOne({ user_code: code, approved: false })
  if (!row) redirect('/cli/approve?error=invalid-or-used')
  if (row!.expiresAt < new Date()) redirect('/cli/approve?error=expired')

  const cliToken = crypto.randomBytes(32).toString('hex')
  const userId = new ObjectId(u!.id)

  await d.collection('cli_tokens').insertOne({
    token: cliToken,
    userId,
    createdAt: new Date(),
  })

  await d.collection('cli_codes').updateOne(
    { _id: row!._id },
    {
      $set: {
        approved: true,
        cliToken,
        userId,
        handle: u!.handle,
        name: u!.name,
      },
    },
  )

  redirect('/cli/approve?ok=1')
}

async function signInAction(formData: FormData) {
  'use server'
  const code = String(formData.get('code') ?? '')
  await signIn('github', { redirectTo: `/cli/approve?code=${encodeURIComponent(code)}` })
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; ok?: string; error?: string }>
}) {
  const sp = await searchParams
  const session = await auth()
  const u = session?.user as { handle?: string; name?: string } | undefined

  if (sp.ok) {
    return (
      <main className="min-h-screen bg-[#faf6ec] flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-serif">Authorized</h1>
          <p className="text-neutral-600">
            You can close this tab and return to your terminal.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#faf6ec] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 space-y-5">
        <h1 className="text-2xl font-serif">Authorize Claude Code</h1>
        {sp.error && (
          <p className="text-sm text-red-600">
            {sp.error === 'expired'
              ? 'That code has expired. Run npx claudewall init again.'
              : sp.error === 'invalid-or-used'
                ? 'That code is invalid or already used.'
                : 'Missing code.'}
          </p>
        )}
        {!u ? (
          <form action={signInAction} className="space-y-4">
            <p className="text-neutral-600 text-sm">
              Sign in with GitHub to link this device to your claudewall account.
            </p>
            <input type="hidden" name="code" defaultValue={sp.code ?? ''} />
            <button className="w-full px-4 py-2 bg-black text-white rounded-md text-sm">
              Continue with GitHub
            </button>
          </form>
        ) : (
          <form action={approveAction} className="space-y-4">
            <p className="text-neutral-600 text-sm">
              Linking <strong>@{u.handle}</strong> to a Claude Code session. Confirm
              the code shown in your terminal:
            </p>
            <input
              name="code"
              defaultValue={sp.code ?? ''}
              className="w-full border rounded-md px-3 py-2 font-mono text-center tracking-widest uppercase"
              autoFocus
            />
            <button className="w-full px-4 py-2 bg-black text-white rounded-md text-sm">
              Authorize
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
