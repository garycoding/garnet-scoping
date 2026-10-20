// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The app's settings, kept in its own user-data folder (never under the
// Claude configuration directory): for now, which half of a session window
// the board takes.

import { readFileSync } from 'node:fs'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

export const BOARD_SIDES = ['left', 'right', 'top', 'bottom']
export const DEFAULTS = { boardSide: 'right' }

// Keeps only known keys with valid values, so a damaged file falls back to
// the defaults key by key.
export function clean(raw) {
  const out = { ...DEFAULTS }
  if (raw && BOARD_SIDES.includes(raw.boardSide)) out.boardSide = raw.boardSide
  return out
}

export function loadSettings(file) {
  try {
    return clean(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveSettings(file, settings) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(clean(settings), null, 2))
  await rename(tmp, file)
}
