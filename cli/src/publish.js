'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const ENDPOINTS = {
  quote: '/api/p/submit',
  tip: '/api/t/submit',
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
  // Read from stdin (so slash commands can pipe a heredoc).
  return new Promise((resolve, reject) => {
    const chunks = []
    process.stdin.on('data', (chunk) => chunks.push(chunk))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)))
    process.stdin.on('error', reject)
  })
}

async function main() {
  // argv[0] = node
  // argv[1] = path to claudewall.js
  // argv[2] = "publish"
  // argv[3] = "quote" | "tip"
  // argv[4] = optional path to body file (or "-" / omitted to read stdin)
  const kind = process.argv[3]
  const bodyPath = process.argv[4]

  if (!kind || !Object.hasOwn(ENDPOINTS, kind)) {
    console.error('Usage:')
    console.error('  claudewall publish <quote|tip> <path-to-body.json>')
    console.error('  claudewall publish <quote|tip>            # reads JSON from stdin')
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

  const body = await readBody(bodyPath)
  if (!body || body.length === 0) {
    console.error(
      'Empty body. Pass a file path or pipe JSON to stdin (e.g. via heredoc).',
    )
    process.exit(1)
  }

  const api = cfg.api || 'https://claudewall.com'
  const url = api + ENDPOINTS[kind]

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        // Token is read from disk at runtime — never inlined into the
        // shell command or the slash-command markdown.
        Authorization: 'Bearer ' + cfg.token,
        'Content-Type': 'application/json',
      },
      body,
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
    // Fall through.
  }
  console.log(text)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
