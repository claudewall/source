#!/usr/bin/env node
'use strict'

const cmd = process.argv[2]

if (!cmd || cmd === 'init') {
  require('../src/init.js')
} else if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
  console.log('Usage: npx claudewall init')
  console.log('')
  console.log('  Registers the /wall slash command for Claude Code and')
  console.log('  authorizes it against claudewall.com via GitHub.')
  process.exit(0)
} else {
  console.error(`Unknown command: ${cmd}`)
  console.error('Usage: npx claudewall init')
  process.exit(1)
}
