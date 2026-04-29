import { db } from '@/lib/mongo'
import crypto from 'node:crypto'

export const runtime = 'nodejs'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function userCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

export async function POST() {
  const user_code = userCode()
  const device_code = crypto.randomBytes(32).toString('hex')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

  await (await db()).collection('cli_codes').insertOne({
    user_code,
    device_code,
    approved: false,
    createdAt: now,
    expiresAt,
  })

  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  return Response.json({
    user_code,
    device_code,
    verification_uri: `${origin}/cli/approve?code=${user_code}`,
    expires_in: 600,
    interval: 2,
  })
}
