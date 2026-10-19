// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
const list = document.getElementById('sessions')
window.garnet.listSessions().then((sessions) => {
  list.replaceChildren(
    ...sessions.map((s) => {
      const li = document.createElement('li')
      li.textContent = `${s.title ?? s.firstMessage ?? s.id} — ${s.cwd ?? s.project}`
      return li
    }),
  )
})
