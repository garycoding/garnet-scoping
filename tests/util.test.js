// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { pathToFileURL } from 'node:url'
import { fileUrl } from '../src/renderer/src/util.js'

describe('fileUrl', () => {
  it('escapes "#" and "?" so the whole name stays in the path', () => {
    expect(fileUrl('/x/chart #2.png')).toBe('file:///x/chart%20%232.png')
    expect(fileUrl('/x/what now?.pdf')).toBe('file:///x/what%20now%3F.pdf')
  })
  it('gives the address Node gives for awkward names', () => {
    for (const p of ['/x/chart #2 what now?.pdf', '/x/100% done.png', '/x/café – draft.jpg', '/x/plain.png']) {
      expect(new URL(fileUrl(p)).pathname).toBe(pathToFileURL(p).pathname)
    }
  })
})
