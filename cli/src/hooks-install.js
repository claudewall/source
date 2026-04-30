'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const HOOK_COMMAND = 'npx claudewall@latest hook recall'
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')
// Only the failure path matters for the improvisation-loop fix —
// recall is most valuable when a command just failed and the model is
// about to try something else. PostToolUse (success) was wired earlier
// as belt-and-suspenders, but it produces recall traffic on every
// successful command with stderr (progress bars, deprecation warnings)
// for almost no benefit. Drop it.
const HOOK_EVENTS = ['PostToolUseFailure']

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
      /(^|\s)claudewall(@[^\s]+)?\s+hook\s+recall\b/.test(h.command),
  )
}

function install() {
  const settings = readSettings()
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {}

  let installedCount = 0
  for (const event of HOOK_EVENTS) {
    const list = Array.isArray(settings.hooks[event])
      ? settings.hooks[event]
      : []

    let bashEntry = list.find(
      (e) => e && typeof e === 'object' && e.matcher === 'Bash',
    )
    if (!bashEntry) {
      bashEntry = { matcher: 'Bash', hooks: [] }
      list.push(bashEntry)
    }
    if (!Array.isArray(bashEntry.hooks)) bashEntry.hooks = []

    const already = bashEntry.hooks.some(
      (h) =>
        h &&
        typeof h.command === 'string' &&
        /(^|\s)claudewall(@[^\s]+)?\s+hook\s+recall\b/.test(h.command),
    )
    if (already) continue

    bashEntry.hooks.push({ type: 'command', command: HOOK_COMMAND })
    settings.hooks[event] = list
    installedCount++
  }

  if (installedCount === 0) {
    console.log('claudewall hooks are already installed.')
    return
  }

  writeSettings(settings)

  console.log(`✓ Installed ${HOOK_EVENTS.join(' + ')} hooks in ${SETTINGS_PATH}`)
  console.log(
    '  On Bash success and failure, claudewall queries your past lessons',
  )
  console.log('  and injects matches into the next turn (failure path is the')
  console.log('  one that most often saves you from improvisation loops).')
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
  if (!settings.hooks || typeof settings.hooks !== 'object') {
    console.log('No claudewall hooks were installed.')
    return
  }

  let removed = 0
  for (const event of HOOK_EVENTS) {
    const list = Array.isArray(settings.hooks[event])
      ? settings.hooks[event]
      : []
    for (const entry of list) {
      if (!entry || !Array.isArray(entry.hooks)) continue
      const before = entry.hooks.length
      entry.hooks = entry.hooks.filter(
        (h) =>
          !(
            h &&
            typeof h.command === 'string' &&
            /(^|\s)claudewall(@[^\s]+)?\s+hook\s+recall\b/.test(h.command)
          ),
      )
      removed += before - entry.hooks.length
    }
    const pruned = list.filter(
      (e) => e && Array.isArray(e.hooks) && e.hooks.length > 0,
    )
    if (pruned.length === 0) {
      delete settings.hooks[event]
    } else {
      settings.hooks[event] = pruned
    }
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

function isInstalled() {
  let settings
  try {
    settings = readSettings()
  } catch {
    return false
  }
  // Considered installed if the hook is wired on the failure path
  // (PostToolUseFailure) — that's the load-bearing event for recall.
  const failureList = Array.isArray(settings?.hooks?.PostToolUseFailure)
    ? settings.hooks.PostToolUseFailure
    : []
  return failureList.some(isClaudewallEntry)
}

function status() {
  const settings = (() => {
    try {
      return readSettings()
    } catch {
      return {}
    }
  })()
  const states = HOOK_EVENTS.map((event) => {
    const list = Array.isArray(settings?.hooks?.[event])
      ? settings.hooks[event]
      : []
    return { event, installed: list.some(isClaudewallEntry) }
  })
  const anyOn = states.some((s) => s.installed)
  if (anyOn) {
    console.log(`claudewall hooks (settings: ${SETTINGS_PATH})`)
    for (const s of states) {
      console.log(`  ${s.event.padEnd(22)} ${s.installed ? 'installed' : 'not installed'}`)
    }
    console.log(`  command:               ${HOOK_COMMAND}`)
  } else {
    console.log('claudewall hooks: not installed')
    console.log('  install: npx claudewall hooks install')
  }
}

module.exports = { install, uninstall, status, isInstalled, SETTINGS_PATH, HOOK_COMMAND }

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
