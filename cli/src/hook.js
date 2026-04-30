'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const FETCH_TIMEOUT_MS = 8000
const QUERY_MAX = 500
const STDERR_TAIL = 300

function readStdinSync() {
  // Synchronous stdin read — avoids any async/event-loop weirdness on
  // Windows where the hook process may be killed before async resolves.
  // fs.readFileSync(0) reads fd 0 (stdin) until EOF or error.
  try {
    return fs.readFileSync(0, 'utf8')
  } catch (err) {
    return ''
  }
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

  // Claude Code's Bash PostToolUse payload only carries:
  //   { stdout, stderr, interrupted, isImage, noOutputExpected }
  // No exit code, no success flag. Treat non-empty stderr or interrupted
  // as the failure signal. (For commands where stderr is informational on
  // success — e.g. progress bars — this will produce false positives,
  // but a false-positive recall query is a tiny network call with no
  // user-visible effect unless lessons match.)
  const response = payload?.tool_response ?? {}
  const stderr = typeof response.stderr === 'string' ? response.stderr : ''
  const interrupted = response.interrupted === true
  const failed = interrupted || stderr.length > 0
  if (!failed) return null

  const tail = stderr.slice(-STDERR_TAIL)
  const cmdHead = command.slice(0, QUERY_MAX - tail.length - 2)
  return `${cmdHead}\n${tail}`.slice(0, QUERY_MAX)
}

function debugLog(stage, info) {
  // Unconditional small log to .claudewall/hook.log so the hook is
  // diagnosable post-hoc without cross-platform env-var prefix gymnastics.
  // Naive line-append; trim to last 200 lines on each entry to bound size.
  try {
    const dir = path.join(os.homedir(), '.claudewall')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'hook.log')
    const line =
      JSON.stringify({ ts: new Date().toISOString(), stage, ...info }) + '\n'
    fs.appendFileSync(file, line)
    try {
      const all = fs.readFileSync(file, 'utf8').split('\n')
      if (all.length > 220) {
        fs.writeFileSync(file, all.slice(-200).join('\n'))
      }
    } catch {
      // ignore rotation errors
    }
  } catch {
    // ignore
  }
}

async function main() {
  const subcmd = process.argv[3]
  debugLog('entry', { subcmd, argv: process.argv.slice(2) })
  if (subcmd !== 'recall') {
    process.exit(0)
  }

  const raw = readStdinSync()
  debugLog('stdin', { bytes: raw.length, head: raw.slice(0, 200) })
  let payload
  try {
    payload = JSON.parse(raw)
  } catch (err) {
    debugLog('stdin-parse-fail', { msg: err.message, rawLen: raw.length })
    process.exit(0)
  }

  if (payload?.hook_event_name !== 'PostToolUse') {
    debugLog('skip-event', { event: payload?.hook_event_name })
    process.exit(0)
  }

  debugLog('payload-shape', {
    tool_name: payload?.tool_name,
    tool_input_keys: payload?.tool_input ? Object.keys(payload.tool_input) : null,
    tool_response_keys: payload?.tool_response
      ? Object.keys(payload.tool_response)
      : null,
    tool_response_preview: payload?.tool_response
      ? JSON.stringify(payload.tool_response).slice(0, 600)
      : null,
  })

  const query = buildBashFailureQuery(payload)
  debugLog('query-built', { hasQuery: Boolean(query), tool: payload?.tool_name })
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

  if (!res.ok) {
    debugLog('recall-http-error', { status: res.status })
    process.exit(0)
  }

  let data
  try {
    data = await res.json()
  } catch (err) {
    debugLog('recall-json-fail', { msg: err.message })
    process.exit(0)
  }

  const lessons = Array.isArray(data?.lessons) ? data.lessons : []
  debugLog('lessons', { count: lessons.length })
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
  // Claude Code only injects PostToolUse hook output into the model's
  // context when the hook stdout is a JSON envelope with
  // `hookSpecificOutput.additionalContext`. Plain stdout is shown to the
  // user but never reaches the model. 10k-char cap on additionalContext.
  const additionalContext = lines.join('\n').slice(0, 9800)
  const envelope = {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext,
    },
  }
  debugLog('emit', { contextChars: additionalContext.length })
  process.stdout.write(JSON.stringify(envelope))
  process.exit(0)
}

main().catch(() => process.exit(0))
