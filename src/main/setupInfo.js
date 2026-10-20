// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The Set-up Info window: copyable text for starting to use garnet-scoping
// with Claude Code. First, a prompt that has Claude install the watcher, its
// session-start hook and the CLAUDE.md rule from files shipped in the app;
// second, the channel's configuration and the terminal command that loads it.

import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir, cp } from 'node:fs/promises'

// The channel's scripts are copied to the app's own folder at start, so that
// Claude Code finds them at one path whatever the install: an AppImage runs
// from a mount whose path changes on every launch.
export const CHANNEL_DIR = join(homedir(), '.garnet-scoping', 'channel')
export async function installChannel() {
  const from = join(app.isPackaged ? process.resourcesPath : join(__dirname, '../..'), 'channel')
  await mkdir(CHANNEL_DIR, { recursive: true })
  await cp(from, CHANNEL_DIR, { recursive: true, force: true })
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// The app's shipped files: Resources in the packaged app, the repository in
// development.
const resources = () => (app.isPackaged ? process.resourcesPath : join(__dirname, '../..'))

export function setupTexts() {
  const res = resources()
  const setup = join(res, 'setup')
  // The binary that runs the channel: the AppImage itself when the app runs
  // from one; otherwise the app's executable (in development, where the
  // installed app would be: the macOS bundle, or the Ubuntu package under /opt).
  const installed = process.platform === 'darwin' ? '/Applications/garnet-scoping.app/Contents/MacOS/garnet-scoping' : '/opt/garnet-scoping/garnet-scoping'
  const binary = process.env.APPIMAGE || (app.isPackaged ? process.execPath : installed)
  const channelScript = join(CHANNEL_DIR, 'garnet-channel.mjs')
  const mcpPath = join(homedir(), '.garnet-scoping', 'channel.mcp.json')
  const mcp = JSON.stringify({ mcpServers: { garnet: { command: binary, args: [channelScript], env: { ELECTRON_RUN_AS_NODE: '1' } } } }, null, 2)
  const prompt = `Please set up garnet-scoping for all my Claude Code sessions. Read each file before installing it.

1. Copy ${join(setup, 'garnet-watch.sh')}, ${join(setup, 'garnet-rewake.sh')} and ${join(setup, 'garnet-session-start.sh')} into ~/.claude/hooks/ and make them executable.
2. In ~/.claude/settings.json, keeping every hook already there, add three command hooks:
   - SessionStart, matcher "startup|resume": bash ~/.claude/hooks/garnet-session-start.sh
   - SessionStart, matcher "startup|resume": bash ~/.claude/hooks/garnet-rewake.sh, with "asyncRewake": true and "timeout": 86400
   - Stop: bash ~/.claude/hooks/garnet-rewake.sh, with "asyncRewake": true and "timeout": 86400
   The last two make Claude Code itself run the watcher, at session start and at the end of every turn, and wake the session when a signal arrives.
3. Append the section in ${join(setup, 'claude-md-section.md')} to ~/.claude/CLAUDE.md, unless a section "garnet-scoping signals" is already there.
4. Write ${mcpPath} with this content, for the channel (used only by terminal sessions started with it):
${mcp}
Nothing needs starting by hand: from the end of this turn on, Claude Code runs the watcher in every session.`
  const command = `claude --mcp-config ${mcpPath} --dangerously-load-development-channels server:garnet`
  return { prompt, mcp, mcpPath, command }
}

let win = null
export function openSetupInfo() {
  if (win && !win.isDestroyed()) return win.focus()
  const t = setupTexts()
  const block = (id, text) => `<div class="block"><pre id="${id}">${esc(text)}</pre><button data-copy="${id}">Copy</button></div>`
  const html = `<!doctype html><meta charset="utf-8"><title>Set-up Info</title><style>
  :root{--bg:#1e1f22;--panel:#17181a;--fg:#dcddde;--muted:#8b8e94;--line:#2a2c30;--accent:#d0607a}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.55 system-ui,sans-serif}
  main{padding:18px 24px 26px}
  h1{margin:0 0 4px;font-size:16px}
  h2{margin:22px 0 6px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  p{margin:0 0 8px;max-width:46em}
  .block{position:relative}
  pre{margin:0;padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:6px;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,Menlo,monospace;-webkit-user-select:text;user-select:text}
  button{position:absolute;top:6px;right:6px;font:inherit;font-size:12px;color:var(--fg);background:#26282c;border:1px solid var(--line);border-radius:5px;padding:2px 10px;cursor:pointer}
  button:hover{border-color:var(--accent)}
  code{font-family:ui-monospace,Menlo,monospace}
  a{color:var(--accent)}
</style><main>
<h1>Set-up Info</h1>
<p>garnet-scoping shows each session; these steps let your signals (Review on the board, Discuss on a row, Hold) reach Claude even when you send no message.</p>
<h2>1. Set up the watcher (once)</h2>
<p>Paste this into any Claude Code session. Claude installs the watcher, the hook that starts it in every new session, and the rule in your <code>~/.claude/CLAUDE.md</code> that says how to answer each signal.</p>
${block('prompt', t.prompt)}
<h2>2. The channel, for terminal sessions (optional)</h2>
<p>A channel delivers the signals at once, without the watcher. Claude Code supports channels only in the terminal for now, as a research preview; the desktop app does not load them yet. Step 1 writes this configuration to <code>${esc(t.mcpPath)}</code>:</p>
${block('mcp', t.mcp)}
<p>Start a terminal session with the channel by running this, and confirm the prompt about development channels:</p>
${block('command', t.command)}
</main>
<script>
document.addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.copy
  if (!id) return
  const r = document.createRange(); r.selectNodeContents(document.getElementById(id))
  const s = getSelection(); s.removeAllRanges(); s.addRange(r)
  document.execCommand('copy'); s.removeAllRanges()
  e.target.textContent = 'Copied'; setTimeout(() => (e.target.textContent = 'Copy'), 1200)
})
addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close() })
</script>`
  win = new BrowserWindow({ width: 760, height: 720, minWidth: 480, title: 'Set-up Info', backgroundColor: '#1e1f22', webPreferences: { contextIsolation: true, sandbox: true } })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  win.on('closed', () => (win = null))
}
