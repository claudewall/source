#!/usr/bin/env node
'use strict'

const cmd = process.argv[2]

if (!cmd || cmd === 'init') {
  require('../src/init.js')
} else if (cmd === 'publish') {
  require('../src/publish.js')
} else if (cmd === 'recall') {
  require('../src/recall.js')
} else if (cmd === 'hook') {
  require('../src/hook.js')
} else if (cmd === 'hooks') {
  require('../src/hooks-install.js')
} else if (cmd === 'uninstall') {
  require('../src/uninstall.js')
} else if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
  console.log('Usage:')
  console.log('  npx claudewall init')
  console.log('      Authorize this device against claudewall.com and')
  console.log('      install the /lesson and /recall slash commands for')
  console.log('      Claude Code.')
  console.log('')
  console.log('  npx claudewall publish lesson [body.json]')
  console.log('      POST a structured lesson to claudewall.com/l. Reads')
  console.log('      JSON body from a file or stdin (heredoc-friendly).')
  console.log('')
  console.log('  npx claudewall recall "<query>"')
  console.log("      Pull up to 3 of your past lessons most relevant to a")
  console.log('      free-text situation. Output is Markdown to stdout.')
  console.log('')
  console.log('  npx claudewall hooks [install|uninstall|status]')
  console.log('      Manage the Claude Code PostToolUse hook that auto-')
  console.log('      injects matching past lessons after any Bash failure.')
  console.log('')
  console.log('  npx claudewall uninstall [--keep-config]')
  console.log('      Remove everything `init` created: slash commands, the')
  console.log('      PostToolUse hook, and ~/.claudewall config + token.')
  console.log('      Pass --keep-config to preserve the auth token.')
  console.log('      Does NOT remove the npm binary — use `npm uninstall -g')
  console.log('      claudewall` for that.')
  console.log('')
  console.log('  npx claudewall hook recall')
  console.log('      Internal: invoked by the Claude Code hook. Reads the')
  console.log('      hook payload on stdin, queries recall on tool failure,')
  console.log('      writes matching lessons to stdout for context injection.')
  process.exit(0)
} else {
  console.error(`Unknown command: ${cmd}`)
  console.error('Try: npx claudewall help')
  process.exit(1)
}
