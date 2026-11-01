// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The main process. It finds the session transcripts (R1), follows the one
// each session window shows (R1.3), lists the session's memory store (R4),
// and refuses every network request (R5.4). It never writes under the Claude
// configuration directory (R5.1).

import { app, BrowserWindow, ipcMain, session, shell, Menu } from 'electron'
import { join, resolve, sep, isAbsolute } from 'node:path'
import { homedir } from 'node:os'
import { watch, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { listSessions } from './transcript/sessions.js'
import { listMemory } from './transcript/memory.js'
import { follow } from './follower.js'
import { openBoard, inheritBoard } from './board.js'
import { openAboutWindow, openLicensesWindow } from './about.js'
import { loadSettings, saveSettings, clean } from './settings.js'
import { openSetupInfo, installChannel } from './setupInfo.js'

const CLAUDE = join(homedir(), '.claude')
const PROJECTS = join(CLAUDE, 'projects')
const PUSH_MS = 400
// Files the preview shows as text.
const TEXT_FILE = /\.(md|markdown|txt|text|log|json|csv|tsv|ya?ml|toml|ini|xml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|rb|rs|go|java|kt|swift|c|h|cpp|sh|zsh|sql)$/i

let listWindow = null
let settingsWindow = null
let settingsFile = null
let settings = null
const windows = new Map() // session id -> { win, follower, project }

function pageUrl(page, query = {}) {
  const q = new URLSearchParams(query).toString()
  if (process.env.ELECTRON_RENDERER_URL) return { url: `${process.env.ELECTRON_RENDERER_URL}/${page}.html${q ? `?${q}` : ''}` }
  return { file: join(__dirname, `../renderer/${page}.html`), query }
}

function load(win, page, query) {
  const target = pageUrl(page, query)
  if (target.url) win.loadURL(target.url)
  else win.loadFile(target.file, { query: target.query })
}

// plugins: Chromium's own PDF viewer, for previews of delivered PDFs.
const webPreferences = () => ({ preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true, plugins: true })

function createListWindow() {
  if (listWindow && !listWindow.isDestroyed()) return listWindow.focus()
  listWindow = new BrowserWindow({ width: 980, height: 760, title: 'garnet-scoping', backgroundColor: '#17181a', webPreferences: webPreferences() })
  load(listWindow, 'index')
  listWindow.on('closed', () => (listWindow = null))
}

// A session's window: its Desk and its board.
function openSession(info) {
  const open = windows.get(info.id)
  if (open && !open.win.isDestroyed()) return open.win.focus()
  const win = new BrowserWindow({ width: 1400, height: 900, title: info.title ?? info.id, backgroundColor: '#17181a', webPreferences: webPreferences() })
  let timer = null
  const push = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      if (!win.isDestroyed()) win.webContents.send('session:changed')
    }, PUSH_MS)
  }
  const follower = follow(info.id, info.file, push)
  const send = (channel, payload) => !win.isDestroyed() && win.webContents.send(channel, payload)
  const entry = { win, follower, board: null, project: info.project, file: info.file }
  // A session that continues an earlier one takes over its board first
  // (inheritBoard); the board is opened once that is settled.
  entry.boardReady = follower.ready
    .then(() => inheritBoard(info.id, follower.view().lineage))
    .catch(() => null)
    .then(() => {
      entry.board = openBoard(info.id, {
        title: info.title,
        onRequest: (r) => send('board:request', r),
        onExternal: (elements) => send('board:external', elements),
        onPending: () => send('board:pending'),
        onState: (state) => send('board:state', state),
      })
      if (win.isDestroyed()) entry.board.close()
      return entry.board
    })
  windows.set(info.id, entry)
  load(win, 'session', { id: info.id })
  // A link in rendered text opens in the system's browser; the window itself
  // never navigates away from the app's page.
  const openLink = (url) => /^https?:/i.test(url) && shell.openExternal(url)
  win.webContents.setWindowOpenHandler(({ url }) => (openLink(url), { action: 'deny' }))
  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    openLink(url)
  })
  win.on('closed', () => {
    entry.board?.close()
    follower.close()
    windows.delete(info.id)
  })
}

const entryOf = (e) => [...windows.values()].find((w) => w.win.webContents === e.sender)

// A path inside a directory, or null.
function inside(dir, p) {
  const full = resolve(p)
  return full === dir || full.startsWith(dir + sep) ? full : null
}

// The Settings window (one at a time).
function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow.focus()
  settingsWindow = new BrowserWindow({ width: 420, height: 230, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, title: 'Settings', backgroundColor: '#17181a', webPreferences: webPreferences() })
  load(settingsWindow, 'settings')
  settingsWindow.on('closed', () => (settingsWindow = null))
}

function registerIpc() {
  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:set', async (_e, next) => {
    settings = clean(next)
    await saveSettings(settingsFile, settings)
    for (const w of windows.values()) if (!w.win.isDestroyed()) w.win.webContents.send('settings:changed', settings)
    return settings
  })
  ipcMain.handle('sessions:list', () => listSessions(PROJECTS))
  ipcMain.handle('sessions:open', (_e, info) => openSession(info))
  ipcMain.handle('session:view', async (e) => {
    const w = entryOf(e)
    if (!w) return null
    await w.follower.ready
    const v = w.follower.view()
    // Each delivered file, with whether it still exists (scratch folders are
    // cleared in time).
    const deliveries = (v.deliveries ?? []).map((d) => ({ ...d, files: d.files.map((p) => ({ path: p, exists: existsSync(p) })) }))
    return { ...v, deliveries, project: w.project }
  })
  ipcMain.handle('session:detail', (e, actionId) => entryOf(e)?.follower.detail(actionId) ?? null)
  ipcMain.handle('memory:list', (e) => {
    const w = entryOf(e)
    return w ? listMemory(join(PROJECTS, w.project, 'memory')) : null
  })
  ipcMain.handle('memory:read', async (e, path) => {
    const w = entryOf(e)
    const full = w && inside(join(PROJECTS, w.project, 'memory'), path)
    return full && full.endsWith('.md') ? readFile(full, 'utf8') : null
  })
  ipcMain.handle('board:open', async (e) => {
    const w = entryOf(e)
    if (!w) return null
    const board = await w.boardReady
    const scene = await board.load()
    return { paths: board.paths, scene, state: await board.state(), inheritedFrom: scene?.inheritedFrom ?? null }
  })
  // The window may ask for a hold or release one; only the agent confirms it.
  ipcMain.handle('board:set-state', (e, next) => {
    const { hold, ...rest } = next ?? {}
    return entryOf(e)?.boardReady.then((b) => b.setState(hold === 'requested' || hold === 'off' ? { ...rest, hold } : rest))
  })
  ipcMain.handle('session:discuss', (e, op) => entryOf(e)?.boardReady.then((b) => b.discuss(op)))
  ipcMain.handle('board:save', (e, scene) => entryOf(e)?.boardReady.then((b) => b.save(scene)))
  ipcMain.handle('board:ready', (e) => entryOf(e)?.boardReady.then((b) => b.ready()))
  // Files the agent delivered in this session: opened with their default
  // app, or read for the in-app preview. Only delivered files are served.
  const delivered = (e, p) => {
    const w = entryOf(e)
    return Boolean(w && typeof p === 'string' && (w.follower.view().deliveries ?? []).some((d) => d.files.includes(p)))
  }
  ipcMain.handle('file:open', (e, p) => {
    if (delivered(e, p)) shell.openPath(p)
  })
  ipcMain.handle('file:read', async (e, p) => {
    if (!delivered(e, p)) return null
    const info = await stat(p).catch(() => null)
    if (!info) return { kind: 'gone' }
    if (TEXT_FILE.test(p) && info.size <= 1024 * 1024) return { kind: 'text', text: await readFile(p, 'utf8'), size: info.size }
    return { kind: 'other', size: info.size }
  })
  // Shows a folder or file in the system's file manager (S7); only absolute paths.
  ipcMain.handle('finder:show', (_e, p) => {
    if (typeof p === 'string' && isAbsolute(p)) shell.showItemInFolder(p)
  })
}

// Every request that is not for the app's own files is refused (R5.4),
// before any connection is made. Excalidraw lists a CDN beside the bundled
// copy of each font; those attempts are refused like any other, and the
// bundled copy is the one used.
function refuseNetwork() {
  const dev = process.env.ELECTRON_RENDERER_URL
  session.defaultSession.webRequest.onBeforeRequest((details, done) => {
    const u = details.url
    const ok = u.startsWith('file:') || u.startsWith('devtools:') || u.startsWith('data:') || u.startsWith('blob:') || (dev && u.startsWith(dev))
    done({ cancel: !ok })
  })
}

// The list follows new and growing transcripts.
function watchProjects() {
  let timer = null
  try {
    watch(PROJECTS, { recursive: true }, () => {
      clearTimeout(timer)
      timer = setTimeout(() => listWindow?.webContents.send('sessions:changed'), 1500)
    })
  } catch {}
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const about = { label: 'About garnet-scoping', click: () => openAboutWindow() }
  const licenses = { label: 'Open Source Licenses…', click: () => openLicensesWindow() }
  const prefs = { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => openSettings() }
  const setupInfo = { label: 'Set-up Info…', click: () => openSetupInfo() }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac
        ? [
            {
              role: 'appMenu',
              submenu: [about, setupInfo, licenses, { type: 'separator' }, prefs, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }],
            },
          ]
        : []),
      // Without macOS's app menu, Settings is in the File menu.
      { label: 'File', submenu: [{ label: 'Sessions', accelerator: 'CmdOrCtrl+L', click: () => createListWindow() }, ...(isMac ? [] : [prefs]), { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }] },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
      { role: 'windowMenu' },
      { role: 'help', submenu: [setupInfo, about, licenses] },
    ]),
  )
}

app.whenReady().then(() => {
  settingsFile = join(app.getPath('userData'), 'settings.json')
  settings = loadSettings(settingsFile)
  installChannel().catch(() => {})
  refuseNetwork()
  registerIpc()
  buildMenu()
  watchProjects()
  createListWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createListWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
