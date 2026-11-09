// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { pathToFileURL } from 'node:url'
import { fileUrl, fromFile } from '../src/renderer/src/util.js'

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

describe('fromFile', () => {
  it('resolves a Markdown file\'s relative images from its own folder', () => {
    expect(fromFile('chart.png', '/x/report #1/notes.md')).toBe('file:///x/report%20%231/chart.png')
    expect(fromFile('../img/a%20b.png', '/x/docs/notes.md')).toBe('file:///x/img/a%20b.png')
    expect(fromFile('/abs/c.png', '/x/docs/notes.md')).toBe('file:///abs/c.png')
  })
  it('leaves an address with its own scheme alone', () => {
    expect(fromFile('https://example.org/a.png', '/x/notes.md')).toBe('https://example.org/a.png')
    expect(fromFile('data:image/png;base64,AAAA', '/x/notes.md')).toBe('data:image/png;base64,AAAA')
  })
})
