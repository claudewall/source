'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const STDIN_TIMEOUT_MS = 5000
const FETCH_TIMEOUT_MS = 8000
const QUERY_MAX = 500
const STDERR_TAIL = 300

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    let resolved = false
    const finish = () => {
      if (resolved) return
      resolved = true
      resolve(data)
    }
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', finish)
    process.stdin.on('error', finish)
    setTimeout(finish, STDIN_TIMEOUT_MS)
  })
}

function loadConfig() {
  const cfgPath = path.join(os.homedir(), '.claudewall', 'config.json')
  try {
    const raw = fs.readFileSync(cfgPath, 'utf8')
    const cfg = JSON.parse(raw)
    if (typeof cfg?.token !== 'string' || cfg.token.length === 0) return null
    return cfg
  } catch {
    return null
  }
}

function buildBashFailureQuery(payload) {
  if (payload?.tool_name !== 'Bash') return null
  const command = payload?.tool_input?.command
  if (typeof command !== 'string' || command.length === 0) return null

  const response = payload?.tool_response ?? {}
  const stderr = typeof response.stderr === 'string' ? response.stderr : ''
  const interrupted = response.interrupted === true
  const explicitFail = response.success === false || Boolean(response.error)
  const failed = explicitFail || interrupted || stderr.length > 0
  if (!failed) return null

  const tail = stderr.slice(-STDERR_TAIL)
  const cmdHead = command.slice(0, QUERY_MAX - tail.length - 2)
  return `${cmdHead}\n${tail}`.slice(0, QUERY_MAX)
}

async function main() {
  const subcmd = process.argv[3]
  if (subcmd !== 'recall') {
    process.exit(0)
  }

  let payload
  try {
    payload = JSON.parse(await readStdin())
  } catch {
    process.exit(0)
  }

  if (payload?.hook_event_name !== 'PostToolUse') process.exit(0)

  const query = buildBashFailureQuery(payload)
  if (!query) process.exit(0)

  const cfg = loadConfig()
  if (!cfg) process.exit(0)

  const api = cfg.api || 'https://claudewall.com'
  const url = `${api}/api/l/recall?q=${encodeURIComponent(query)}`

  let res
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + cfg.token },
      signal: ctrl.signal,
    })
    clearTimeout(timer)
  } catch {
    process.exit(0)
  }

  if (!res.ok) process.exit(0)

  let data
  try {
    data = await res.json()
  } catch {
    process.exit(0)
  }

  const lessons = Array.isArray(data?.lessons) ? data.lessons : []
  if (lessons.length === 0) process.exit(0)

  const lines = []
  lines.push('## claudewall — past lessons relevant to this failure')
  lines.push('')
  lines.push(
    'These are your own prior lessons that semantically match the command + stderr that just failed. Read them before deciding the next action.',
  )
  lines.push('')
  for (const l of lessons) {
    lines.push(`### ${l.title}`)
    if (l.trigger) lines.push(`**Trigger:** ${l.trigger}`)
    if (l.detection) lines.push(`**Detection:** ${l.detection}`)
    if (l.replacement) lines.push(`**Replacement:** ${l.replacement}`)
    if (l.verification) lines.push(`**Verification:** ${l.verification}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }
  process.stdout.write(lines.join('\n'))
  process.exit(0)
}

main().catch(() => process.exit(0))
