#!/usr/bin/env node
'use strict'

const cmd = process.argv[2]

if (!cmd || cmd === 'init') {
  require('../src/init.js')
} else if (cmd === 'publish') {
  require('../src/publish.js')
} else if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
  console.log('Usage:')
  console.log('  npx claudewall init')
  console.log('      Authorize this device against claudewall.com and')
  console.log('      install the /wall and /tip slash commands for')
  console.log('      Claude Code.')
  console.log('')
  console.log('  npx claudewall publish <quote|tip> <path-to-body.json>')
  console.log('      Internal helper invoked by the /wall and /tip')
  console.log('      slash commands. Reads the bearer token from')
  console.log('      ~/.claudewall/config.json at runtime and POSTs the')
  console.log('      body file to claudewall.com.')
  process.exit(0)
} else {
  console.error(`Unknown command: ${cmd}`)
  console.error('Try: npx claudewall help')
  process.exit(1)
}
