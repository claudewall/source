'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

async function main() {
  const query = process.argv[3]
  if (!query) {
    console.error('Usage: claudewall recall "<query>"')
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

  const api = cfg.api || 'https://claudewall.com'
  const url = `${api}/api/l/recall?q=${encodeURIComponent(query)}`

  let res
  try {
    res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + cfg.token },
    })
  } catch (err) {
    console.error(`Network error: ${err.message}`)
    process.exit(2)
  }

  const text = await res.text()
  if (!res.ok) {
    if (res.status === 401) {
      console.error('401 Unauthorized — run: npx claudewall init')
    } else if (res.status === 503) {
      console.error('Recall is offline — embedding service unavailable.')
    } else {
      console.error(`HTTP ${res.status}: ${text}`)
    }
    process.exit(res.status === 401 ? 1 : 3)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error('Could not parse recall response.')
    process.exit(3)
  }

  const lessons = Array.isArray(data?.lessons) ? data.lessons : []
  if (lessons.length === 0) {
    console.log('no relevant lessons.')
    return
  }

  for (const l of lessons) {
    const score =
      typeof l.score === 'number' ? `  (score ${l.score.toFixed(3)})` : ''
    console.log(`### ${l.title}${score}`)
    if (l.trigger) console.log(`**Trigger:** ${l.trigger}`)
    if (l.detection) console.log(`**Detection:** ${l.detection}`)
    if (l.mistake) console.log(`**Mistake:** ${l.mistake}`)
    if (l.replacement) console.log(`**Replacement:** ${l.replacement}`)
    if (l.verification) console.log(`**Verification:** ${l.verification}`)
    if (Array.isArray(l.tags) && l.tags.length > 0) {
      console.log(`**Tags:** ${l.tags.join(', ')}`)
    }
    console.log('')
    console.log('---')
    console.log('')
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
