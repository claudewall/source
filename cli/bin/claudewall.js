#!/usr/bin/env node
'use strict'

const cmd = process.argv[2]

if (!cmd || cmd === 'init') {
  require('../src/init.js')
} else if (cmd === 'publish') {
  require('../src/publish.js')
} else if (cmd === 'recall') {
  require('../src/recall.js')
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
  process.exit(0)
} else {
  console.error(`Unknown command: ${cmd}`)
  console.error('Try: npx claudewall help')
  process.exit(1)
}
