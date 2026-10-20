// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The Settings window: a change applies at once to every session window.

const radios = [...document.querySelectorAll('input[name="side"]')]
const settings = await window.garnet.settings.get()
for (const r of radios) {
  r.checked = r.value === settings.boardSide
  r.addEventListener('change', () => r.checked && window.garnet.settings.set({ ...settings, boardSide: r.value }))
}
addEventListener('keydown', (e) => e.key === 'Escape' && window.close())
