'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const HOOK_COMMAND = 'npx claudewall@latest hook recall'
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

function readSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw new Error(
      `Could not parse ${SETTINGS_PATH}: ${err.message}. Aborting to avoid clobbering existing settings.`,
    )
  }
}

function writeSettings(obj) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  const out = JSON.stringify(obj, null, 2) + '\n'
  fs.writeFileSync(SETTINGS_PATH, out)
}

function isClaudewallEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  const inner = Array.isArray(entry.hooks) ? entry.hooks : []
  return inner.some(
    (h) =>
      h &&
      typeof h.command === 'string' &&
      /\bclaudewall(@[^\s]+)?\s+hook\s+recall\b/.test(h.command),
  )
}

function install() {
  const settings = readSettings()
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {}
  const post = Array.isArray(settings.hooks.PostToolUse)
    ? settings.hooks.PostToolUse
    : []

  // Find existing Bash matcher entry; merge into it if found.
  let bashEntry = post.find(
    (e) => e && typeof e === 'object' && e.matcher === 'Bash',
  )
  if (!bashEntry) {
    bashEntry = { matcher: 'Bash', hooks: [] }
    post.push(bashEntry)
  }
  if (!Array.isArray(bashEntry.hooks)) bashEntry.hooks = []

  const already = bashEntry.hooks.some(
    (h) =>
      h &&
      typeof h.command === 'string' &&
      /\bclaudewall(@[^\s]+)?\s+hook\s+recall\b/.test(h.command),
  )
  if (already) {
    console.log('claudewall PostToolUse hook is already installed.')
    return
  }

  bashEntry.hooks.push({ type: 'command', command: HOOK_COMMAND })
  settings.hooks.PostToolUse = post
  writeSettings(settings)

  console.log(`✓ Installed PostToolUse hook in ${SETTINGS_PATH}`)
  console.log(
    '  On any Bash failure, claudewall will inject your matching past lessons',
  )
  console.log('  into the next turn so you stop improvising blind.')
  console.log('')
  console.log('  Uninstall: npx claudewall hooks uninstall')
}

function uninstall() {
  let settings
  try {
    settings = readSettings()
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
  const post = Array.isArray(settings?.hooks?.PostToolUse)
    ? settings.hooks.PostToolUse
    : []

  let removed = 0
  for (const entry of post) {
    if (!entry || !Array.isArray(entry.hooks)) continue
    const before = entry.hooks.length
    entry.hooks = entry.hooks.filter(
      (h) =>
        !(
          h &&
          typeof h.command === 'string' &&
          /\bclaudewall(@[^\s]+)?\s+hook\s+recall\b/.test(h.command)
        ),
    )
    removed += before - entry.hooks.length
  }
  // Drop matcher entries that have no remaining hooks.
  settings.hooks.PostToolUse = post.filter(
    (e) => e && Array.isArray(e.hooks) && e.hooks.length > 0,
  )
  if (settings.hooks.PostToolUse.length === 0) {
    delete settings.hooks.PostToolUse
  }
  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks
  }
  writeSettings(settings)

  if (removed === 0) {
    console.log('No claudewall hooks were installed.')
  } else {
    console.log(`✓ Removed ${removed} claudewall hook entr${removed === 1 ? 'y' : 'ies'} from ${SETTINGS_PATH}`)
  }
}

function status() {
  const settings = readSettings()
  const post = Array.isArray(settings?.hooks?.PostToolUse)
    ? settings.hooks.PostToolUse
    : []
  const installed = post.some(isClaudewallEntry)
  if (installed) {
    console.log('claudewall PostToolUse hook: installed')
    console.log(`  settings: ${SETTINGS_PATH}`)
    console.log(`  command:  ${HOOK_COMMAND}`)
  } else {
    console.log('claudewall PostToolUse hook: not installed')
    console.log('  install: npx claudewall hooks install')
  }
}

module.exports = { install, uninstall, status, SETTINGS_PATH, HOOK_COMMAND }

function isEntryPoint() {
  // Invoked via `claudewall hooks ...` from bin/claudewall.js? Then the
  // require chain is bin → this module. Treat any direct require from the
  // bin shim as entry-point execution.
  try {
    const parent = require.main && require.main.filename
    return Boolean(parent && parent.endsWith('claudewall.js'))
  } catch {
    return false
  }
}

if (isEntryPoint() && process.argv[2] === 'hooks') {
  const sub = process.argv[3]
  try {
    if (sub === 'install') install()
    else if (sub === 'uninstall' || sub === 'remove') uninstall()
    else if (sub === 'status' || !sub) status()
    else {
      console.error(`Unknown hooks subcommand: ${sub}`)
      console.error('Try: npx claudewall hooks [install|uninstall|status]')
      process.exit(1)
    }
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}
