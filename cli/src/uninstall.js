'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const args = process.argv.slice(3)
const keepConfig = args.includes('--keep-config')

const cmdsDir = path.join(os.homedir(), '.claude', 'commands')
const cfgDir = path.join(os.homedir(), '.claudewall')
const slashCommands = ['lesson.md', 'recall.md']

let removedSlash = 0
for (const name of slashCommands) {
  const p = path.join(cmdsDir, name)
  try {
    fs.unlinkSync(p)
    console.log(`✓ Removed slash command: ${p}`)
    removedSlash++
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.log(`  (warn) could not remove ${p}: ${err.message}`)
    }
  }
}
if (removedSlash === 0) {
  console.log('  (no slash commands to remove)')
}

try {
  const hooks = require('./hooks-install.js')
  if (hooks.isInstalled()) {
    hooks.uninstall()
  } else {
    console.log('  (PostToolUse hook was not installed)')
  }
} catch (err) {
  console.log(`  (warn) hook removal failed: ${err.message}`)
}

if (keepConfig) {
  console.log(`✓ Kept config + token at ${cfgDir} (--keep-config)`)
} else {
  let removedConfig = 0
  if (fs.existsSync(cfgDir)) {
    try {
      fs.rmSync(cfgDir, { recursive: true, force: true })
      console.log(`✓ Removed config + token: ${cfgDir}`)
      removedConfig++
    } catch (err) {
      console.log(`  (warn) could not remove ${cfgDir}: ${err.message}`)
    }
  }
  if (removedConfig === 0) {
    console.log('  (no config dir to remove)')
  }
}

console.log('')
console.log('Done. To also remove the npm binary:')
console.log('  npm uninstall -g claudewall')
console.log('')
console.log('Reinstall any time: npx claudewall init')
