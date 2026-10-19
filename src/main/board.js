// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A session's board on disk (R7): the Excalidraw file, the plain-text
// rendition the agent reads, and the request file the agent writes. The
// window edits the board; this module saves it atomically, keeps the rendition
// current, and passes on requests and outside changes.

import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { watch } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'

export const BOARDS = join(homedir(), '.garnet-scoping', 'boards')

export const boardPaths = (id, dir = BOARDS) => ({
  dir,
  board: join(dir, `${id}.excalidraw`),
  rendition: join(dir, `${id}.board.md`),
  request: join(dir, `${id}.request.json`),
})

const SHAPES = new Set(['rectangle', 'ellipse', 'diamond'])
const hash = (s) => createHash('sha1').update(s).digest('hex')

async function writeAtomic(path, text) {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, path)
}

// The board as text (R7.3): each shape with its id, kind, text and position,
// each connection as "A → B", and free text, preceded by how to change it.
export function rendition(elements, { title = null, requestPath = '' } = {}) {
  const live = elements.filter((e) => !e.isDeleted)
  const byId = new Map(live.map((e) => [e.id, e]))
  const textOf = (e) => {
    const bound = (e.boundElements ?? []).map((b) => byId.get(b.id)).find((x) => x && x.type === 'text')
    // The text as written, not as wrapped to fit the shape.
    return bound ? (bound.originalText ?? bound.text) : ''
  }
  const label = (id) => {
    const e = byId.get(id)
    if (!e) return id
    const t = textOf(e)
    return t ? `[${id}] "${t.replace(/\n/g, ' ')}"` : `[${id}]`
  }
  const pos = (e) => `(${Math.round(e.x)}, ${Math.round(e.y)}) ${Math.round(e.width)}×${Math.round(e.height)}`
  const lines = [`# Board${title ? `: ${title}` : ''}`, '']
  lines.push(
    'This file is written by garnet-scoping whenever the board changes; do not edit it.',
    `To change the board, write a request to ${requestPath || '<id>.request.json'} as JSON:`,
    '{ "add": [ { "id": "a", "kind": "rectangle|ellipse|diamond|text", "text": "…", "x": 0, "y": 0 },',
    '           { "kind": "arrow|line", "from": "a", "to": "b", "text": "optional label" } ],',
    '  "relabel": [ { "id": "a", "text": "…" } ], "remove": [ "id" ] }',
    'Positions are optional; shapes without one are placed to the right of the board. The app applies the request and deletes the file.',
    '',
    '## Shapes',
  )
  const shapes = live.filter((e) => SHAPES.has(e.type)).sort((a, b) => a.y - b.y || a.x - b.x)
  for (const e of shapes) lines.push(`- [${e.id}] ${e.type} "${textOf(e).replace(/\n/g, ' ')}" at ${pos(e)}`)
  if (!shapes.length) lines.push('- (none)')
  lines.push('', '## Connections')
  const links = live.filter((e) => e.type === 'arrow' || e.type === 'line')
  for (const e of links) {
    const from = e.startBinding?.elementId
    const to = e.endBinding?.elementId
    const t = textOf(e)
    const arrow = e.type === 'arrow' ? '→' : '—'
    lines.push(`- [${e.id}] ${from ? label(from) : '(unattached)'} ${arrow} ${to ? label(to) : '(unattached)'}${t ? ` labelled "${t.replace(/\n/g, ' ')}"` : ''}`)
  }
  if (!links.length) lines.push('- (none)')
  const free = live.filter((e) => e.type === 'text' && !e.containerId)
  if (free.length) {
    lines.push('', '## Free text')
    for (const e of free) lines.push(`- [${e.id}] "${(e.originalText ?? e.text).replace(/\n/g, ' ')}" at (${Math.round(e.x)}, ${Math.round(e.y)})`)
  }
  const other = live.filter((e) => !SHAPES.has(e.type) && e.type !== 'text' && e.type !== 'arrow' && e.type !== 'line')
  if (other.length) lines.push('', `## Other`, `- ${other.length} element(s) of other kinds (${[...new Set(other.map((e) => e.type))].join(', ')}), not described here.`)
  return lines.join('\n') + '\n'
}

// Merges elements from outside into the window's, element by element, the
// higher version winning (R7.5).
export function mergeElements(current, incoming) {
  const out = new Map(current.map((e) => [e.id, e]))
  for (const e of incoming) {
    const have = out.get(e.id)
    if (!have || (e.version ?? 0) > (have.version ?? 0)) out.set(e.id, e)
  }
  return [...out.values()]
}

// One session's board: load, save, and watch for requests and outside edits.
export function openBoard(id, { title = null, dir = BOARDS, onRequest, onExternal, onPending }) {
  const p = boardPaths(id, dir)
  let lastWritten = null
  let closed = false
  // Requests wait on disk until the window's board is ready to apply them.
  let ready = false

  async function load() {
    await mkdir(dir, { recursive: true })
    try {
      const text = await readFile(p.board, 'utf8')
      lastWritten = hash(text)
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async function save(scene) {
    await mkdir(dir, { recursive: true })
    const text = JSON.stringify({ type: 'excalidraw', version: 2, source: 'garnet-scoping', style: 'plain', elements: scene.elements, appState: { viewBackgroundColor: scene.background ?? '#ffffff' }, files: {} }, null, 2)
    lastWritten = hash(text)
    await writeAtomic(p.board, text)
    await writeAtomic(p.rendition, rendition(scene.elements, { title, requestPath: p.request }))
  }

  async function checkRequest() {
    if (!ready) {
      readFile(p.request).then(() => onPending?.(), () => {})
      return
    }
    let text
    try {
      text = await readFile(p.request, 'utf8')
    } catch {
      return
    }
    let req
    try {
      req = JSON.parse(text)
    } catch (err) {
      onRequest({ error: `The request is not valid JSON: ${err.message}` })
      return
    }
    await unlink(p.request).catch(() => {})
    onRequest({ request: req })
  }

  async function checkBoard() {
    let text
    try {
      text = await readFile(p.board, 'utf8')
    } catch {
      return
    }
    if (hash(text) === lastWritten) return
    try {
      const data = JSON.parse(text)
      if (Array.isArray(data.elements)) onExternal(data.elements)
    } catch {}
  }

  let timer = null
  let watcher = null
  mkdir(dir, { recursive: true }).then(() => {
    if (closed) return
    try {
      watcher = watch(dir, (_event, name) => {
        if (!name || !name.startsWith(id)) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          checkRequest()
          if (ready) checkBoard()
        }, 150)
      })
    } catch {}
    checkRequest()
  })

  return {
    paths: p,
    load,
    save,
    // The window's board is mounted: apply any waiting request.
    ready() {
      ready = true
      checkRequest()
    },
    close() {
      closed = true
      watcher?.close()
      clearTimeout(timer)
    },
  }
}
