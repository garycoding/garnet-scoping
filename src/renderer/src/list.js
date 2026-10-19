// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The session list (R1.1): every session, grouped by its working folder, the
// groups and sessions most recently written first; a click opens its window.

import { ago } from './util.js'

const groupsEl = document.getElementById('groups')
const filterEl = document.getElementById('filter')
let sessions = []

const el = (tag, cls, text) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function render() {
  const q = filterEl.value.trim().toLowerCase()
  const shown = sessions.filter((s) => !q || [s.title, s.cwd, s.firstMessage, s.project].some((v) => v && v.toLowerCase().includes(q)))
  const groups = new Map()
  for (const s of shown) {
    const key = s.cwd ?? s.project
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  groupsEl.replaceChildren(
    ...[...groups].map(([folder, list]) => {
      const g = el('section', 'group')
      g.append(el('h2', null, folder))
      for (const s of list) {
        const row = el('div', 'session-row')
        row.tabIndex = 0
        const dot = el('span', `dot${s.recent ? ' recent' : ''}`)
        dot.title = s.recent ? 'Written in the last ten minutes' : ''
        row.append(dot, el('span', 'name', s.title ?? s.firstMessage ?? s.id), el('span', 'when', ago(s.modified)))
        row.append(el('span', 'sub', [s.branch && `branch ${s.branch}`, s.version && `Claude Code ${s.version}`, `${(s.size / 1e6).toFixed(1)} MB`].filter(Boolean).join(' · ')))
        const open = () => window.garnet.openSession({ id: s.id, file: s.file, project: s.project, title: s.title })
        row.addEventListener('click', open)
        row.addEventListener('keydown', (e) => e.key === 'Enter' && open())
        g.append(row)
      }
      return g
    }),
  )
  if (!shown.length) groupsEl.replaceChildren(el('p', 'muted', sessions.length ? 'No session matches.' : 'No Claude Code sessions found on this machine.'))
}

async function refresh() {
  sessions = await window.garnet.listSessions()
  render()
}

filterEl.addEventListener('input', render)
window.garnet.onSessionsChanged(refresh)
setInterval(render, 60_000) // keep "ago" current
refresh()
