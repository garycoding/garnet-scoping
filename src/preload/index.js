// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('garnet', {
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  openSession: (info) => ipcRenderer.invoke('sessions:open', info),
  onSessionsChanged: (fn) => ipcRenderer.on('sessions:changed', () => fn()),
  view: () => ipcRenderer.invoke('session:view'),
  detail: (actionId) => ipcRenderer.invoke('session:detail', actionId),
  onChanged: (fn) => ipcRenderer.on('session:changed', () => fn()),
  listMemory: () => ipcRenderer.invoke('memory:list'),
  readMemory: (path) => ipcRenderer.invoke('memory:read', path),
  showInFinder: (path) => ipcRenderer.invoke('finder:show', path),
})
