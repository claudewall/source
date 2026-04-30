'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')

const API = process.env.CLAUDEWALL_API || 'https://claudewall.com'

function openBrowser(url) {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      }).unref()
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
    }
  } catch {
    // best-effort
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function main() {
  console.log('claudewall: starting authentication…')

  const start = await postJSON(`${API}/api/cli/start`)
  if (start.status !== 200 || !start.data?.device_code) {
    throw new Error(`failed to start auth (HTTP ${start.status})`)
  }
  const { user_code, device_code, verification_uri, interval } = start.data

  console.log('')
  console.log(`  Visit:  ${verification_uri}`)
  console.log(`  Code:   ${user_code}`)
  console.log('')
  console.log('  Opening your browser…')
  openBrowser(verification_uri)

  const deadline = Date.now() + 10 * 60 * 1000
  const wait = (interval || 2) * 1000

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, wait))
    const poll = await postJSON(`${API}/api/cli/poll`, { device_code })
    if (poll.status === 410) throw new Error('authorization expired')
    if (poll.status !== 200) continue
    if (poll.data?.status === 'approved' && poll.data?.token) {
      const cfgDir = path.join(os.homedir(), '.claudewall')
      fs.mkdirSync(cfgDir, { recursive: true })
      const cfgPath = path.join(cfgDir, 'config.json')
      fs.writeFileSync(
        cfgPath,
        JSON.stringify(
          { api: API, handle: poll.data.handle, token: poll.data.token },
          null,
          2,
        ),
        { mode: 0o600 },
      )
      console.log(`✓ Authorized as @${poll.data.handle}`)

      const cmdsDir = path.join(os.homedir(), '.claude', 'commands')
      fs.mkdirSync(cmdsDir, { recursive: true })

      // Drop slash commands from older claudewall versions that no
      // longer correspond to live endpoints.
      const obsolete = ['wall.md', 'wall-auto.md', 'tip.md', 'tip-auto.md']
      for (const name of obsolete) {
        const p = path.join(cmdsDir, name)
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p)
            console.log(`  removed obsolete /${name.replace('.md', '')}`)
          } catch {
            // ignore
          }
        }
      }

      const slashCommands = [
        { src: 'lesson.md', label: '/lesson' },
        { src: 'recall.md', label: '/recall' },
      ]
      for (const cmd of slashCommands) {
        const srcPath = path.join(__dirname, cmd.src)
        const dstPath = path.join(cmdsDir, cmd.src)
        fs.copyFileSync(srcPath, dstPath)
        console.log(`✓ Installed ${cmd.label} at ${dstPath}`)
      }

      try {
        require('./hooks-install.js').install()
      } catch (err) {
        console.log('  (skip) hook install failed: ' + err.message)
        console.log('  retry later: npx claudewall hooks install')
      }

      console.log('')
      console.log('All set. Run /lesson to capture and /recall to retrieve.')
      console.log('Bash failures will auto-pull your matching past lessons.')
      console.log('Opt out: npx claudewall hooks uninstall')
      return
    }
  }

  throw new Error('timed out waiting for authorization')
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
