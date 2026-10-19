// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The main process: finds the session transcripts and serves them to the
// windows. This first shell lists the sessions; the Desk follows.

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { listSessions } from './transcript/sessions.js'

const PROJECTS = join(homedir(), '.claude', 'projects')

function createListWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'garnet-scoping',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true },
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('sessions:list', () => listSessions(PROJECTS))
  createListWindow()
})

app.on('window-all-closed', () => app.quit())
