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
import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { listSessions } from './transcript/sessions.js'
import { listMemory } from './transcript/memory.js'
import { follow } from './follower.js'
import { openBoard } from './board.js'

const CLAUDE = join(homedir(), '.claude')
const PROJECTS = join(CLAUDE, 'projects')
const PUSH_MS = 400

let listWindow = null
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

const webPreferences = () => ({ preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true })

function createListWindow() {
  if (listWindow && !listWindow.isDestroyed()) return listWindow.focus()
  listWindow = new BrowserWindow({ width: 980, height: 760, title: 'garnet-scoping', backgroundColor: '#17181a', webPreferences: webPreferences() })
  load(listWindow, 'index')
  listWindow.on('closed', () => (listWindow = null))
}

// A session's window: its Desk (and, later, its board).
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
  const board = openBoard(info.id, {
    title: info.title,
    onRequest: (r) => send('board:request', r),
    onExternal: (elements) => send('board:external', elements),
    onPending: () => send('board:pending'),
  })
  windows.set(info.id, { win, follower, board, project: info.project, file: info.file })
  load(win, 'session', { id: info.id })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.on('closed', () => {
    board.close()
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

function registerIpc() {
  ipcMain.handle('sessions:list', () => listSessions(PROJECTS))
  ipcMain.handle('sessions:open', (_e, info) => openSession(info))
  ipcMain.handle('session:view', async (e) => {
    const w = entryOf(e)
    if (!w) return null
    await w.follower.ready
    return { ...w.follower.view(), project: w.project }
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
    return w ? { paths: w.board.paths, scene: await w.board.load() } : null
  })
  ipcMain.handle('board:save', (e, scene) => entryOf(e)?.board.save(scene))
  ipcMain.handle('board:ready', (e) => entryOf(e)?.board.ready())
  // Shows a folder or file in the Finder (S7); only absolute paths.
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
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' }] : []),
      { label: 'File', submenu: [{ label: 'Sessions', accelerator: 'CmdOrCtrl+L', click: () => createListWindow() }, { type: 'separator' }, { role: 'close' }] },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
      { role: 'windowMenu' },
    ]),
  )
}

app.whenReady().then(() => {
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
