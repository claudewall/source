import { db } from '@/lib/mongo'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { device_code?: string }
  const device_code = String(body.device_code ?? '')
  if (!device_code) {
    return Response.json({ error: 'missing device_code' }, { status: 400 })
  }

  const d = await db()
  const row = await d.collection('cli_codes').findOne({ device_code })
  if (!row) return Response.json({ error: 'invalid device_code' }, { status: 400 })
  if (row.expiresAt < new Date()) {
    return Response.json({ error: 'expired' }, { status: 410 })
  }
  if (!row.approved) return Response.json({ status: 'pending' })

  return Response.json({
    status: 'approved',
    token: row.cliToken,
    handle: row.handle,
    name: row.name,
  })
}
