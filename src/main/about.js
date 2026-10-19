// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The About window and the Open Source Licenses window, which lists the
// bundled packages and the board's fonts from the generated legal/ bundle
// (see the handbook's electron-tooling.md). Neither reaches the network: the
// app makes no update check (R5.4), and a link opens in the system's browser.

import { app, BrowserWindow, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import icon from '../../build/icon.png?asset'

const SOURCE_URL = 'https://github.com/garycoding/garnet-scoping'
const RELEASES_URL = `${SOURCE_URL}/releases`

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const STYLE = `
  :root{--bg:#1e1f22;--panel:#17181a;--fg:#dcddde;--muted:#8b8e94;--line:#2a2c30;--accent:#d0607a}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font:13px/1.55 system-ui,sans-serif}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}`

// Escape dismisses both windows, as it does a dialog.
const CLOSE_ON_ESCAPE = `<script>addEventListener('keydown', (e) => { if (e.key === 'Escape') window.close() })</script>`

// Links open in the system's browser or application, never inside the app.
function lockDown(win) {
  const open = (url) => (url.startsWith('file:') ? shell.openPath(fileURLToPath(url)) : shell.openExternal(url))
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|file):/i.test(url)) open(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    if (/^(https?|file):/i.test(url)) open(url)
  })
}

function pngData(file) {
  try {
    return readFileSync(file).toString('base64')
  } catch {
    return ''
  }
}

let aboutWin = null
export function openAboutWindow() {
  if (aboutWin && !aboutWin.isDestroyed()) return aboutWin.focus()
  const html = `<!doctype html><meta charset="utf-8"><title>About garnet-scoping</title><style>${STYLE}
  html,body{overflow:hidden}
  .wrap{padding:26px 34px 28px;display:flex;flex-direction:column;align-items:center;text-align:center;-webkit-user-select:none;cursor:default}
  img{width:96px;height:96px;margin-bottom:10px}
  h1{margin:0;font-size:18px;font-weight:600}
  .ver{margin:3px 0 14px;color:var(--muted);font-size:12px}
  p{margin:0 0 10px;max-width:32em}
  .muted{color:var(--muted);font-size:12px}
  .copy{margin:12px 0 10px;font-size:11px;color:var(--muted)}
  .links{display:flex;gap:18px;font-size:12px}
</style>
<div class="wrap">
  <img src="data:image/png;base64,${pngData(icon)}" alt="">
  <h1>garnet-scoping</h1>
  <div class="ver">Version ${esc(app.getVersion())}</div>
  <p>A desk for each Claude Code session, read from its transcript, beside a board shared by the person and the agent.</p>
  <p class="muted">The app makes no network connection, so it does not check for newer versions; they are listed on the releases page.</p>
  <div class="copy">© 2026 Gary Frattarola · AGPL-3.0-or-later</div>
  <div class="links"><a href="${SOURCE_URL}" target="_blank">Source code on GitHub</a><a href="${RELEASES_URL}" target="_blank">Releases</a></div>
</div>
${CLOSE_ON_ESCAPE}`
  aboutWin = new BrowserWindow({
    width: 460,
    height: 380,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#1e1f22',
    title: 'About garnet-scoping',
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  lockDown(aboutWin)
  aboutWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  aboutWin.on('closed', () => {
    aboutWin = null
  })
}

// The packaged legal/ bundle (made by `npm run legal`): in development the
// repository root's legal/, in the packaged app resourcesPath/legal.
function legalDir() {
  return app.isPackaged ? join(process.resourcesPath, 'legal') : join(__dirname, '../../legal')
}

const HIGHLIGHTS = [
  { pkg: 'electron', label: 'Electron', role: 'Desktop runtime (Chromium and Node.js)', note: 'MIT · bundles Chromium and Node.js', repo: 'https://github.com/electron/electron' },
  { pkg: '@excalidraw/excalidraw', label: 'Excalidraw', role: 'The board' },
  { pkg: 'react', label: 'React', role: 'Runs the board' },
  { pkg: 'marked', label: 'Marked', role: 'Markdown in memory notes' },
  { pkg: 'dompurify', label: 'DOMPurify', role: 'Sanitising rendered HTML' },
  { pkg: 'yaml', label: 'yaml', role: 'Memory notes’ frontmatter' },
]

const FONTS =
  'Excalidraw’s fonts, bundled with the board: Excalifont, Virgil, Assistant, Cascadia Code, Liberation, Lilita One, Nunito and Xiaolai under the SIL Open Font License 1.1; Comic Shanns under the MIT licence. Their notices are in Excalidraw’s package, listed below.'

let licWin = null
export function openLicensesWindow() {
  if (licWin && !licWin.isDestroyed()) return licWin.focus()
  const dir = legalDir()
  const href = (f) => esc(pathToFileURL(join(dir, f)).href)
  const listPath = join(dir, 'oss-licenses.json')
  let body
  if (existsSync(listPath)) {
    const list = JSON.parse(readFileSync(listPath, 'utf8'))
    const byName = Object.fromEntries(list.map((p) => [p.name, p]))
    const cards = HIGHLIGHTS.map((h) => {
      const p = byName[h.pkg]
      const meta = h.note || (p ? `${esc(p.license)}${p.version ? ' · v' + esc(p.version) : ''}` : '')
      const repo = p?.repository || h.repo
      return `<div class="card"><div class="hn">${esc(h.label)}</div><div class="hr">${esc(h.role)}</div><div class="hm">${meta}${repo ? ` · <a href="${esc(repo)}" target="_blank">repository</a>` : ''}</div></div>`
    }).join('')
    const rows = list
      .map((p) => `<tr><td>${p.repository ? `<a href="${esc(p.repository)}" target="_blank">${esc(p.name)}</a>` : esc(p.name)}</td><td class="m">${esc(p.version)}</td><td class="m">${esc(p.license)}</td></tr>`)
      .join('')
    body =
      `<div class="st">Key components</div><div class="cards">${cards}</div>` +
      `<div class="st">Fonts</div><div class="cards"><div class="card"><div class="hr">${esc(FONTS)}</div></div></div>` +
      `<div class="st">All bundled packages (${list.length})</div>` +
      `<table><thead><tr><th>Package</th><th>Version</th><th>Licence</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<p class="foot">Chromium and Node.js notices: <a href="${href('LICENSES.chromium.html')}" target="_blank">LICENSES.chromium.html</a> · full texts: <a href="${href('THIRD-PARTY-NOTICES.txt')}" target="_blank">THIRD-PARTY-NOTICES.txt</a> · this app: <a href="${href('LICENSE.txt')}" target="_blank">AGPL-3.0-or-later</a></p>`
  } else {
    body = '<div class="missing">The licence notices are generated when the app is packaged.<br>Run <code>npm run legal</code> in the project, then reopen this window.</div>'
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Open Source Licenses</title><style>${STYLE}
  body{display:flex;flex-direction:column}
  header{padding:16px 22px 12px;border-bottom:1px solid var(--line)}
  h1{margin:0;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .sub{margin-top:4px;font-size:12px;color:var(--muted)}
  main{flex:1;overflow-y:auto;padding:2px 22px 24px;-webkit-user-select:text}
  .st{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:20px 0 10px}
  .cards{display:flex;flex-direction:column;gap:8px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:9px 13px}
  .hn{font-weight:600} .hr{font-size:12px;color:var(--muted)} .hm{font-size:11px;color:var(--muted)}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid var(--line);padding:5px 10px;text-align:left;font-size:12px}
  th{color:var(--muted)} td.m{color:var(--muted);white-space:nowrap}
  .foot{margin-top:18px;font-size:11px;color:var(--muted);line-height:1.7}
  .missing{padding:48px 0;text-align:center;color:var(--muted);line-height:1.9}
  code{background:var(--panel);padding:1px 6px;border-radius:3px}
</style>
<header><h1>Open Source Licenses</h1><div class="sub">garnet-scoping includes the open-source software below.</div></header>
<main>${body}</main>
${CLOSE_ON_ESCAPE}`
  licWin = new BrowserWindow({
    width: 760,
    height: 660,
    minWidth: 460,
    minHeight: 360,
    backgroundColor: '#1e1f22',
    title: 'Open Source Licenses',
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  lockDown(licWin)
  licWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  licWin.on('closed', () => {
    licWin = null
  })
}
