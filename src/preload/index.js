// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('garnet', {
  listSessions: () => ipcRenderer.invoke('sessions:list'),
})
