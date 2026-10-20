// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clean, loadSettings, saveSettings, DEFAULTS } from '../src/main/settings.js'

describe('the settings', () => {
  it('keeps a valid board side and drops unknown keys', () => {
    expect(clean({ boardSide: 'top', other: 1 })).toEqual({ boardSide: 'top' })
  })
  it('falls back to the default for an invalid side, a damaged file or none', async () => {
    expect(clean({ boardSide: 'middle' })).toEqual(DEFAULTS)
    const dir = await mkdtemp(join(tmpdir(), 'garnet-settings-'))
    expect(loadSettings(join(dir, 'none.json'))).toEqual(DEFAULTS)
    await writeFile(join(dir, 'bad.json'), '{ not json')
    expect(loadSettings(join(dir, 'bad.json'))).toEqual(DEFAULTS)
    await saveSettings(join(dir, 'sub', 's.json'), { boardSide: 'bottom' })
    expect(loadSettings(join(dir, 'sub', 's.json'))).toEqual({ boardSide: 'bottom' })
    await rm(dir, { recursive: true, force: true })
  })
})
