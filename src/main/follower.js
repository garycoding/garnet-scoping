// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Follows one session's transcript (R1.3): reads it once, then reads each new
// batch of lines as the file grows, and tells its listener when the model has
// changed. An action's command and output stay here and are handed out one
// action at a time, on request (R5.2).

import { watch } from 'node:fs'
import { readFrom } from './transcript/reader.js'
import { createSession, snapshot } from './transcript/session.js'

const POLL_MS = 2000 // a fallback for a watcher event that never comes

export function follow(id, file, onChange) {
  const { state, apply } = createSession(id)
  let offset = 0
  let reading = false
  let again = false
  let closed = false

  async function read() {
    if (closed) return
    if (reading) {
      again = true
      return
    }
    reading = true
    try {
      do {
        again = false
        const r = await readFrom(file, offset)
        if (r.offset < offset) {
          // The file was replaced: start the model again.
          return restart()
        }
        offset = r.offset
        state.bad += r.bad
        for (const rec of r.records) apply(rec)
        if (r.records.length) onChange()
      } while (again && !closed)
    } catch {
      // The file is being replaced or is briefly unreadable; the next event retries.
    } finally {
      reading = false
    }
  }

  function restart() {
    closed = true
    stop()
    const next = follow(id, file, onChange)
    Object.assign(api, next)
  }

  let watcher = null
  try {
    watcher = watch(file, () => read())
  } catch {}
  const timer = setInterval(read, POLL_MS)
  const stop = () => {
    watcher?.close()
    clearInterval(timer)
  }

  const api = {
    ready: read(),
    // The view the window renders: the snapshot without commands and outputs.
    view() {
      const snap = snapshot(state)
      const strip = (it) => (it.type === 'action' ? { ...it, command: undefined, output: undefined, hasDetail: Boolean(it.command || it.output) } : it)
      snap.turns = snap.turns.map((t) => ({ ...t, items: t.items.map(strip) }))
      snap.now = snap.now.map(strip)
      return snap
    },
    // One action's command and output, when the person opens it.
    detail(actionId) {
      for (let i = state.turns.length - 1; i >= 0; i--) {
        const a = state.turns[i].items.find((it) => it.type === 'action' && it.id === actionId)
        if (a) return { command: a.command, output: a.output, isError: a.isError }
      }
      return null
    },
    close() {
      closed = true
      stop()
    },
  }
  return api
}
