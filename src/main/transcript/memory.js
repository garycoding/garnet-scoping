// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A project's memory store (R4): the Markdown notes in its memory folder, each
// with the name, description and type its frontmatter gives.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'

// Splits a note into its frontmatter (parsed) and its body.
export function splitNote(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { meta: {}, body: text }
  let meta = {}
  try {
    meta = parse(m[1]) ?? {}
  } catch {}
  return { meta: typeof meta === 'object' && meta ? meta : {}, body: text.slice(m[0].length) }
}

// The notes of the store at `dir`, sorted by type, then name. The index file
// (MEMORY.md) is listed apart, as `index`.
export async function listMemory(dir) {
  let names
  try {
    names = await readdir(dir)
  } catch {
    return { dir, notes: [], index: null }
  }
  const notes = []
  let index = null
  for (const n of names) {
    if (!n.endsWith('.md')) continue
    const path = join(dir, n)
    let text
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }
    if (n === 'MEMORY.md') {
      index = { path, name: 'MEMORY', description: 'The index of the memory store' }
      continue
    }
    const { meta } = splitNote(text)
    notes.push({
      path,
      file: n,
      name: String(meta.name ?? n.replace(/\.md$/, '')),
      description: String(meta.description ?? ''),
      type: String(meta.metadata?.type ?? meta.type ?? 'other'),
    })
  }
  notes.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
  return { dir, notes, index }
}
