import type { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { db, ensureIndexes } from '@/lib/mongo'
import { embedText } from '@/lib/embedding'
import { auth } from '@/lib/auth'

const VECTOR_INDEX = 'lessons_vector_index'
const NUM_CANDIDATES = 50
const FETCH_LIMIT = 5
const MIN_SCORE = 0.65
const MAX_RESULTS = 3
const TRIGGER_COMMAND_MAX = 1000
const TRIGGER_ERROR_MAX = 1000
const PROJECT_MAX = 100
const SESSION_ID_MAX = 100
const CWD_MAX = 400

type AgentContext = {
  sessionId?: string
  cwd?: string
  project?: string
  triggerCommand?: string
  triggerError?: string
}

type Source = 'agent' | 'web'

type AuthResult =
  | { authorId: ObjectId; source: Source }
  | { authorId: null; source: Source }

// Auth flexibly: Bearer = agent (CLI/hook), session cookie = web.
async function callerAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (!token) return { authorId: null, source: 'agent' }
    const d = await db()
    const tokenRow = await d.collection('cli_tokens').findOne({ token })
    if (!tokenRow) return { authorId: null, source: 'agent' }
    await d
      .collection('cli_tokens')
      .updateOne({ _id: tokenRow._id }, { $set: { lastUsedAt: new Date() } })
    return { authorId: tokenRow.userId as ObjectId, source: 'agent' }
  }
  const session = await auth()
  const sessionUser = session?.user as { id?: string } | undefined
  if (!sessionUser?.id) return { authorId: null, source: 'web' }
  return { authorId: new ObjectId(sessionUser.id), source: 'web' }
}

function clampStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.slice(0, max)
}

function sanitizeAgentContext(raw: unknown): AgentContext | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const ctx: AgentContext = {
    sessionId: clampStr(r.sessionId, SESSION_ID_MAX) || undefined,
    cwd: clampStr(r.cwd, CWD_MAX) || undefined,
    project: clampStr(r.project, PROJECT_MAX) || undefined,
    triggerCommand:
      clampStr(r.triggerCommand, TRIGGER_COMMAND_MAX) || undefined,
    triggerError: clampStr(r.triggerError, TRIGGER_ERROR_MAX) || undefined,
  }
  // Drop the entire context if every field is empty (no signal to record).
  const hasAny = Object.values(ctx).some((v) => Boolean(v))
  return hasAny ? ctx : null
}

async function runRecall(
  authorId: ObjectId,
  q: string,
): Promise<
  | { ok: true; lessons: Array<Record<string, unknown>> }
  | { ok: false; status: number; error: string }
> {
  const queryVec = await embedText(q)
  if (!queryVec) {
    return {
      ok: false,
      status: 503,
      error:
        'Recall unavailable — embedding service is down or VOYAGE_API_KEY is not set.',
    }
  }

  const d = await db()
  let raw: Array<Record<string, unknown>> = []
  try {
    raw = await d
      .collection('lessons')
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: 'embedding',
            queryVector: queryVec,
            numCandidates: NUM_CANDIDATES,
            limit: FETCH_LIMIT,
            filter: { authorId: { $eq: authorId } },
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            trigger: 1,
            detection: 1,
            mistake: 1,
            replacement: 1,
            verification: 1,
            project: 1,
            tags: 1,
            weight: 1,
            createdAt: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray()
  } catch (err) {
    console.warn('lessons recall failed:', (err as Error).message)
    return {
      ok: false,
      status: 503,
      error:
        'Recall index not configured. Create lessons_vector_index in Atlas Search → Vector Search.',
    }
  }

  const filtered = raw
    .filter((l) => ((l as { score?: number }).score ?? 0) >= MIN_SCORE)
    .slice(0, MAX_RESULTS)
    .map((l) => {
      const o = l as { _id: { toString(): string } } & Record<string, unknown>
      return { ...o, _id: o._id.toString() }
    })

  return { ok: true, lessons: filtered }
}

async function writeHistory(args: {
  authorId: ObjectId
  source: Source
  query: string
  lessons: Array<Record<string, unknown>>
  agentContext: AgentContext | null
}): Promise<void> {
  try {
    await ensureIndexes()
    const d = await db()
    const resultIds = args.lessons
      .map((l) => {
        try {
          return new ObjectId(String((l as { _id: string })._id))
        } catch {
          return null
        }
      })
      .filter((v): v is ObjectId => v !== null)
    const topScore =
      args.lessons.length > 0
        ? Math.max(
            ...args.lessons.map(
              (l) => (l as { score?: number }).score ?? 0,
            ),
          )
        : null
    await d.collection('recall_history').insertOne({
      authorId: args.authorId,
      source: args.source,
      query: args.query.slice(0, 500),
      resultIds,
      resultCount: args.lessons.length,
      topScore,
      agentContext:
        args.source === 'agent' ? args.agentContext ?? null : null,
      createdAt: new Date(),
    })
  } catch (err) {
    // History writes should never break the recall response.
    console.warn('recall_history write failed:', (err as Error).message)
  }
}

export async function GET(req: NextRequest) {
  const { authorId, source } = await callerAuth(req)
  if (!authorId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 500)
  if (!q) return Response.json({ q: '', lessons: [] })

  const result = await runRecall(authorId, q)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }
  await writeHistory({
    authorId,
    source,
    query: q,
    lessons: result.lessons,
    agentContext: null,
  })
  return Response.json({ q, lessons: result.lessons })
}

export async function POST(req: NextRequest) {
  const { authorId, source } = await callerAuth(req)
  if (!authorId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { q?: unknown; agentContext?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const q = clampStr(body.q, 500).trim()
  if (!q) return Response.json({ q: '', lessons: [] })

  const result = await runRecall(authorId, q)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }
  await writeHistory({
    authorId,
    source,
    query: q,
    lessons: result.lessons,
    agentContext: sanitizeAgentContext(body.agentContext),
  })
  return Response.json({ q, lessons: result.lessons })
}
