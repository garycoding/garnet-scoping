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
  openFile: (path) => ipcRenderer.invoke('file:open', path),
  discuss: (op) => ipcRenderer.invoke('session:discuss', op),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (s) => ipcRenderer.invoke('settings:set', s),
    onChanged: (fn) => ipcRenderer.on('settings:changed', (_e, s) => fn(s)),
  },
  board: {
    open: () => ipcRenderer.invoke('board:open'),
    save: (scene) => ipcRenderer.invoke('board:save', scene),
    ready: () => ipcRenderer.invoke('board:ready'),
    onRequest: (fn) => ipcRenderer.on('board:request', (_e, r) => fn(r)),
    onExternal: (fn) => ipcRenderer.on('board:external', (_e, els) => fn(els)),
    onPending: (fn) => ipcRenderer.on('board:pending', () => fn()),
    setState: (next) => ipcRenderer.invoke('board:set-state', next),
    onState: (fn) => ipcRenderer.on('board:state', (_e, s) => fn(s)),
  },
})
