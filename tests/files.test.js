// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, appendFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFrom } from '../src/main/transcript/reader.js'
import { listSessions } from '../src/main/transcript/sessions.js'
import { listMemory } from '../src/main/transcript/memory.js'
import * as F from './fixtures.js'

let dir
const line = (r) => JSON.stringify(r) + '\n'
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'garnet-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('reading a transcript as it grows', () => {
  it('reads whole lines only, and the rest once its newline arrives', async () => {
    const file = join(dir, 's.jsonl')
    const second = JSON.stringify(F.human('second'))
    await writeFile(file, line(F.human('first')) + second.slice(0, 20))
    const a = await readFrom(file, 0)
    expect(a.records.map((r) => r.message.content)).toEqual(['first'])
    await appendFile(file, second.slice(20) + '\n')
    const b = await readFrom(file, a.offset)
    expect(b.records.map((r) => r.message.content)).toEqual(['second'])
    expect((await readFrom(file, b.offset)).records).toEqual([])
  })
  it('counts a line that will not parse, and goes on', async () => {
    const file = join(dir, 's.jsonl')
    await writeFile(file, 'not json\n' + line(F.human('ok')))
    const r = await readFrom(file, 0)
    expect(r.bad).toBe(1)
    expect(r.records).toHaveLength(1)
  })
})

describe('the session list', () => {
  it('lists sessions by project, newest first, with titles and the recent mark', async () => {
    const p = join(dir, '-work-demo')
    await mkdir(p)
    await writeFile(join(p, 'old.jsonl'), line(F.human('an old question')) + line(F.aiTitled('Old work')))
    await writeFile(join(p, 'new.jsonl'), line(F.human('a new question')) + line(F.titled('* New work')))
    const past = new Date(Date.now() - 3600_000)
    await utimes(join(p, 'old.jsonl'), past, past)
    const list = await listSessions(dir)
    expect(list.map((s) => [s.id, s.title, s.recent, s.project])).toEqual([
      ['new', 'New work', true, '-work-demo'],
      ['old', 'Old work', false, '-work-demo'],
    ])
    expect(list[0]).toMatchObject({ cwd: '/work/demo', firstMessage: 'a new question' })
  })
})

describe('the memory store', () => {
  it('lists notes by type with their names and descriptions, the index apart', async () => {
    await writeFile(join(dir, 'MEMORY.md'), '- [A](a.md) — a\n')
    await writeFile(join(dir, 'a.md'), '---\nname: a-rule\ndescription: A rule to follow\nmetadata:\n  type: feedback\n---\nBody\n')
    await writeFile(join(dir, 'b.md'), '---\nname: the-user\ndescription: Who the user is\ntype: user\n---\nBody\n')
    const m = await listMemory(dir)
    expect(m.index.name).toBe('MEMORY')
    expect(m.notes.map((n) => [n.type, n.name, n.description])).toEqual([
      ['feedback', 'a-rule', 'A rule to follow'],
      ['user', 'the-user', 'Who the user is'],
    ])
  })
})
