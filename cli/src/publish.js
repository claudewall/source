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

  const body = await readBody(bodyPath)
  if (!body || body.length === 0) {
    console.error('Empty body. Pipe JSON to stdin or pass a body file.')
    process.exit(1)
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
    // fall through
  }
  console.log(text)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
