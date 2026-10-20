// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rendition, mergeElements, openBoard, cleanState } from '../src/main/board.js'

const shape = (id, type, text, extra = {}) => [
  { id, type, x: 10, y: 20, width: 180, height: 80, version: 1, boundElements: [{ id: `${id}-t`, type: 'text' }], ...extra },
  { id: `${id}-t`, type: 'text', text: text.replace(' ', '\n'), originalText: text, containerId: id, x: 0, y: 0, width: 1, height: 1, version: 1 },
]
// Waits until cond() holds, or fails after ms.
async function until(cond, ms = 5000) {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting')
    await new Promise((r) => setTimeout(r, 25))
  }
}
const arrow = (id, from, to) => ({ id, type: 'arrow', x: 0, y: 0, width: 1, height: 1, version: 1, startBinding: { elementId: from }, endBinding: { elementId: to } })

describe('the rendition', () => {
  it('lists shapes with their written text and connections by id', () => {
    const els = [...shape('a', 'rectangle', 'Smalt API'), ...shape('b', 'ellipse', 'Flax Binding'), arrow('x', 'a', 'b')]
    const text = rendition(els, { title: 'Demo', requestPath: '/boards/s.request.json' })
    expect(text).toContain('# Board: Demo')
    expect(text).toContain('/boards/s.request.json')
    expect(text).toContain('- [a] rectangle "Smalt API" at (10, 20) 180×80')
    expect(text).toContain('- [x] [a] "Smalt API" → [b] "Flax Binding"')
  })
  it('leaves out deleted elements', () => {
    const text = rendition([...shape('a', 'rectangle', 'Gone', { isDeleted: true })])
    expect(text).toContain('## Shapes\n- (none)')
  })
})

describe('merging', () => {
  it('keeps the higher version of each element and adds new ones', () => {
    const mine = [{ id: 'a', version: 3, x: 1 }, { id: 'b', version: 1, x: 1 }]
    const theirs = [{ id: 'a', version: 2, x: 9 }, { id: 'b', version: 2, x: 9 }, { id: 'c', version: 1, x: 9 }]
    expect(mergeElements(mine, theirs).map((e) => [e.id, e.x])).toEqual([['a', 1], ['b', 9], ['c', 9]])
  })
})

describe('the board on disk', () => {
  let dir
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'garnet-board-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('saves the board and its rendition, atomically', async () => {
    const b = openBoard('s1', { dir, onRequest() {}, onExternal() {} })
    await b.save({ elements: shape('a', 'rectangle', 'One') })
    const data = JSON.parse(await readFile(b.paths.board, 'utf8'))
    expect(data.elements).toHaveLength(2)
    expect(await readFile(b.paths.rendition, 'utf8')).toContain('"One"')
    expect((await readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([])
    b.close()
  })

  it('keeps a request on disk until the window is ready, then hands it over and removes it', async () => {
    const got = []
    let pending = 0
    const b = openBoard('s2', { dir, onRequest: (r) => got.push(r), onExternal() {}, onPending: () => pending++ })
    await new Promise((r) => setTimeout(r, 50))
    await writeFile(b.paths.request, JSON.stringify({ add: [{ id: 'z', kind: 'rectangle', text: 'Z' }] }))
    await until(() => pending > 0)
    expect(got).toEqual([])
    b.ready()
    await until(() => got.length > 0)
    expect(got).toEqual([{ request: { add: [{ id: 'z', kind: 'rectangle', text: 'Z' }] } }])
    await expect(readFile(b.paths.request)).rejects.toThrow()
    b.close()
  })

  it('reports a request that is not valid JSON', async () => {
    const got = []
    const b = openBoard('s3', { dir, onRequest: (r) => got.push(r), onExternal() {} })
    b.ready()
    await writeFile(b.paths.request, '{ not json')
    await until(() => got.length > 0)
    expect(got[0].error).toMatch(/not valid JSON/)
    b.close()
  })

  it('keeps the person’s signals on disk and states them at the head of the rendition', async () => {
    const states = []
    const b = openBoard('s4', { dir, onRequest() {}, onExternal() {}, onState: (st) => states.push(st) })
    await b.save({ elements: shape('a', 'rectangle', 'One') })
    expect(await readFile(b.paths.rendition, 'utf8')).toMatch(/^Editing: no$/m)
    await b.setState({ editing: true })
    await b.setState({ review: true })
    const saved = JSON.parse(await readFile(b.paths.state, 'utf8'))
    expect(saved.editing).toBe(true)
    expect(saved.review).toBe(true)
    expect(saved.reviewAt).toMatch(/^\d{4}-\d\d-\d\dT/)
    const text = await readFile(b.paths.rendition, 'utf8')
    expect(text).toMatch(/^Editing: yes/m)
    expect(text).toMatch(/^Review: requested at /m)
    expect(text).toContain('"One"')
    expect(states.at(-1).review).toBe(true)
    b.close()
    // A board reopened keeps its state.
    const again = openBoard('s4', { dir, onRequest() {}, onExternal() {} })
    expect((await again.state()).review).toBe(true)
    again.close()
  })

  it('clears a review on a bare "reviewed" request, even before the board is shown', async () => {
    const states = []
    const got = []
    const b = openBoard('s5', { dir, onRequest: (r) => got.push(r), onExternal() {}, onState: (st) => states.push(st) })
    await b.setState({ review: true })
    await writeFile(b.paths.request, JSON.stringify({ reviewed: true }))
    await until(() => states.length > 1)
    expect(states.at(-1).review).toBe(false)
    expect(got).toEqual([])
    await expect(readFile(b.paths.request)).rejects.toThrow()
    expect(await readFile(b.paths.rendition, 'utf8')).toMatch(/^Review: not requested$/m)
    b.close()
  })

  it('applies "reviewed" with changes once the board is ready', async () => {
    const states = []
    const got = []
    const b = openBoard('s6', { dir, onRequest: (r) => got.push(r), onExternal() {}, onState: (st) => states.push(st) })
    await b.setState({ review: true })
    const req = { add: [{ id: 'q', kind: 'rectangle', text: 'Q' }], reviewed: true }
    await writeFile(b.paths.request, JSON.stringify(req))
    await new Promise((r) => setTimeout(r, 300))
    expect(states.at(-1).review).toBe(true)
    b.ready()
    await until(() => got.length > 0)
    expect(got[0].request).toEqual(req)
    expect(states.at(-1).review).toBe(false)
    b.close()
  })

  it('cleans a state read from disk', () => {
    expect(cleanState({ editing: 'yes', review: true, reviewAt: 5, x: 1 })).toEqual({ editing: false, review: true, reviewAt: null })
    expect(cleanState(null)).toEqual({ editing: false, review: false, reviewAt: null })
  })
})
