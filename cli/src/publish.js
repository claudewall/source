'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const ENDPOINTS = {
  lesson: '/api/l/submit',
}

function readBody(bodyPath) {
  if (bodyPath && bodyPath !== '-') {
    try {
      return fs.readFileSync(bodyPath)
    } catch (err) {
      console.error(`Could not read body file ${bodyPath}: ${err.message}`)
      process.exit(1)
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    process.stdin.on('data', (chunk) => chunks.push(chunk))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)))
    process.stdin.on('error', reject)
  })
}

// Best-effort detection of "what project am I in?" so /lesson captures
// don't all collapse to anonymous. Walks up from the cwd looking for a
// git repo and pulls "owner/repo" out of the remote URL; falls back to
// the cwd's directory basename when there's no repo. Doesn't look at
// package.json — many sessions aren't in a Node project at all, and a
// stale "name" field would mislead more than help.
//
// Caller can override by including a "project" field in the JSON body.
function detectProject() {
  const cwd = process.cwd()
  let dir = cwd
  while (true) {
    try {
      const gitConfigPath = path.join(dir, '.git', 'config')
      if (fs.existsSync(gitConfigPath)) {
        try {
          const text = fs.readFileSync(gitConfigPath, 'utf8')
          const m = text.match(/^\s*url\s*=\s*(\S+?)\s*$/m)
          if (m) {
            const url = m[1].replace(/\.git$/, '').replace(/\/$/, '')
            const parts = url.split(/[/:]/).filter(Boolean)
            if (parts.length >= 2) {
              return parts.slice(-2).join('/').slice(0, 100)
            }
          }
        } catch {
          // fall through to repo-dir basename
        }
        return path.basename(dir).slice(0, 100)
      }
    } catch {
      // ignore stat errors and keep walking
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.basename(cwd).slice(0, 100)
}

async function main() {
  const kind = process.argv[3]
  const bodyPath = process.argv[4]

  if (!kind || !Object.hasOwn(ENDPOINTS, kind)) {
    console.error('Usage:')
    console.error('  claudewall publish lesson [body.json]   # body via stdin if omitted')
    process.exit(1)
  }

  const cfgPath = path.join(os.homedir(), '.claudewall', 'config.json')
  let cfg
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  } catch {
    console.error(
      `No claudewall config at ${cfgPath}. Run: npx claudewall init`,
    )
    process.exit(1)
  }
  if (!cfg || typeof cfg.token !== 'string' || cfg.token.length === 0) {
    console.error(
      'Invalid claudewall config — missing token. Run: npx claudewall init',
    )
    process.exit(1)
  }

  const bodyBuf = await readBody(bodyPath)
  if (!bodyBuf || bodyBuf.length === 0) {
    console.error('Empty body. Pipe JSON to stdin or pass a body file.')
    process.exit(1)
  }

  // Parse the JSON so we can fold in an auto-detected project field
  // if the caller didn't set one.
  let payload
  try {
    payload = JSON.parse(bodyBuf.toString('utf8'))
  } catch (err) {
    console.error(`Body is not valid JSON: ${err.message}`)
    process.exit(1)
  }

  if (
    kind === 'lesson' &&
    (typeof payload.project !== 'string' || payload.project.trim().length === 0)
  ) {
    payload.project = detectProject()
  }

  const api = cfg.api || 'https://claudewall.com'
  const url = api + ENDPOINTS[kind]

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + cfg.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error(`Network error: ${err.message}`)
    process.exit(2)
  }

  const text = await res.text()

  if (!res.ok) {
    if (res.status === 401) {
      console.error('401 Unauthorized — run: npx claudewall init')
    } else {
      console.error(`HTTP ${res.status}: ${text}`)
    }
    process.exit(res.status === 401 ? 1 : 3)
  }

  try {
    const data = JSON.parse(text)
    if (data && typeof data.url === 'string') {
      console.log(data.url)
      return
    }
  } catch {
    // fall through
  }
  console.log(text)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
