// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The board (R7): an Excalidraw editor over the session's board file. The
// person edits it here; the agent's requests (shapes to add, relabel or
// remove) and outside edits arrive from the main process and are merged in,
// element by element. Loaded only when the Board tab is first shown.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw, convertToExcalidrawElements, restoreElements, getSceneVersion } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

const SHAPES = new Set(['rectangle', 'ellipse', 'diamond'])
const SIZE = { width: 180, height: 80 }
const DIAMOND = { width: 220, height: 130 }
const GRID = { columns: 3, dx: 300, dy: 200 }
const SAVE_MS = 400

// The board's look: text in Helvetica, the system's own face, and shapes and
// connections drawn with straight, sharp lines.
const NORMAL_FONT = 2 // Helvetica, in the file format's font numbering
// Midnight-blue ground and cream-yellow ink, which replaces the default black.
export const GROUND = '#0b1226'
const INK = '#f7f0d2'
// Black, and the earlier, deeper yellow, are replaced by the board's ink.
const DEFAULT_INKS = new Set(['#1e1e1e', '#000000', '#f2e2a0'])
const PLAIN = { roughness: 0, roundness: null }
const HAND_FONTS = new Set([1, 5, 6, 7, 8]) // the format's hand-drawn and display faces
const PLAIN_APP_STATE = { currentItemStrokeColor: INK, currentItemRoughness: 0, currentItemFontFamily: NORMAL_FONT, currentItemRoundness: 'sharp', currentItemArrowType: 'sharp' }

// Gives elements drawn in the hand-drawn style the plain one: a board saved
// before the plain style is converted once, when it is first opened.
export function toPlain(els) {
  return els.map((e) => {
    const changes = {}
    if (e.roughness) changes.roughness = 0
    if (e.roundness && e.type !== 'ellipse') changes.roundness = null
    if (e.type === 'text' && HAND_FONTS.has(e.fontFamily)) changes.fontFamily = NORMAL_FONT
    return Object.keys(changes).length ? bump(e, changes) : e
  })
}

// The board has one look: straight lines, Helvetica and yellow ink. A rough
// line, another face or black ink (from a board saved earlier, a paste, or an
// edit made outside) is brought to it.
const offStyle = (e) => e.roughness || DEFAULT_INKS.has(e.strokeColor) || (e.type === 'text' && e.fontFamily !== NORMAL_FONT)
const straighten = (els) =>
  els.map((e) => (offStyle(e) ? bump(e, { roughness: 0, ...(DEFAULT_INKS.has(e.strokeColor) ? { strokeColor: INK } : {}), ...(e.type === 'text' ? { fontFamily: NORMAL_FONT } : {}) }) : e))

let elements = []
let api = null
let savedVersion = -1
let saveTimer = null
let statusEl = null

const live = () => elements.filter((e) => !e.isDeleted)
const bump = (e, changes) => ({ ...e, ...changes, version: (e.version ?? 1) + 1, versionNonce: Math.floor(Math.random() * 2 ** 31), updated: Date.now() })

function setStatus(text, isError = false) {
  if (!statusEl) return
  statusEl.textContent = text
  statusEl.classList.toggle('error', isError)
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const v = getSceneVersion(elements)
    if (v === savedVersion) return
    savedVersion = v
    window.garnet.board.save({ elements }).catch((err) => {
      savedVersion = -1
      setStatus(`The board could not be saved: ${err.message}`, true)
    })
  }, SAVE_MS)
}

function replaceScene(next) {
  elements = next
  if (api) api.updateScene({ elements })
  scheduleSave()
}

// The point on a shape's box edge on the line from its centre towards `to`.
function edgePoint(e, to) {
  const cx = e.x + e.width / 2
  const cy = e.y + e.height / 2
  const dx = to.x - cx
  const dy = to.y - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const s = Math.min(Math.abs(e.width / 2 / (dx || 1e-9)), Math.abs(e.height / 2 / (dy || 1e-9)))
  return { x: cx + dx * s, y: cy + dy * s }
}
const centre = (e) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 })

// Applies one request from the agent (R7.4); returns what it did.
export function applyRequest(req) {
  const done = { added: 0, relabelled: 0, removed: 0, problems: [] }
  let els = [...elements]
  const find = (id) => els.find((e) => e.id === id && !e.isDeleted)

  // Where shapes without a position go: a grid to the right of the board.
  const box = live().reduce((b, e) => ({ maxX: Math.max(b.maxX, e.x + e.width), minY: Math.min(b.minY, e.y) }), { maxX: 0, minY: Infinity })
  const originX = live().length ? box.maxX + 160 : 0
  const originY = Number.isFinite(box.minY) ? box.minY : 0
  let slot = 0
  const nextSlot = () => {
    const at = { x: originX + (slot % GRID.columns) * GRID.dx, y: originY + Math.floor(slot / GRID.columns) * GRID.dy }
    slot += 1
    return at
  }

  const adds = Array.isArray(req.add) ? req.add : []
  const shapes = adds.filter((a) => a && (SHAPES.has(a.kind) || a.kind === 'text'))
  const skeleton = []
  for (const a of shapes) {
    if (a.id && find(a.id)) {
      done.problems.push(`id "${a.id}" is already on the board`)
      continue
    }
    const placed = Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: a.x, y: a.y } : nextSlot()
    const { x, y } = placed
    const size = a.kind === 'diamond' ? DIAMOND : SIZE
    if (a.kind === 'text') skeleton.push({ type: 'text', ...(a.id ? { id: String(a.id) } : {}), x, y, text: String(a.text ?? ''), fontFamily: NORMAL_FONT })
    else skeleton.push({ type: a.kind, ...PLAIN, ...(a.id ? { id: String(a.id) } : {}), x, y, width: a.width ?? size.width, height: a.height ?? size.height, ...(a.text ? { label: { text: String(a.text), fontFamily: NORMAL_FONT } } : {}) })
  }
  if (skeleton.length) {
    const made = convertToExcalidrawElements(skeleton, { regenerateIds: false })
    els = els.concat(made)
    done.added += skeleton.length
  }

  // Connections, bound to the shapes they join.
  for (const a of adds.filter((x) => x && (x.kind === 'arrow' || x.kind === 'line'))) {
    const from = find(String(a.from))
    const to = find(String(a.to))
    if (!from || !to) {
      done.problems.push(`connection ${a.from} → ${a.to}: ${!from ? a.from : a.to} is not on the board`)
      continue
    }
    const p = edgePoint(from, centre(to))
    const q = edgePoint(to, centre(from))
    const [arrow, ...label] = convertToExcalidrawElements(
      [{ type: a.kind, ...PLAIN, x: p.x, y: p.y, width: q.x - p.x, height: q.y - p.y, points: [[0, 0], [q.x - p.x, q.y - p.y]], ...(a.text ? { label: { text: String(a.text), fontFamily: NORMAL_FONT } } : {}), ...(a.kind === 'arrow' ? { endArrowhead: 'arrow' } : {}) }],
      { regenerateIds: true },
    )
    const bound = { ...arrow, startBinding: { elementId: from.id, focus: 0, gap: 4 }, endBinding: { elementId: to.id, focus: 0, gap: 4 } }
    els = els.map((e) => (e.id === from.id || e.id === to.id ? bump(e, { boundElements: [...(e.boundElements ?? []), { id: arrow.id, type: 'arrow' }] }) : e))
    els.push(bound, ...label)
    done.added += 1
  }

  for (const r of Array.isArray(req.relabel) ? req.relabel : []) {
    const shape = find(String(r.id))
    const textId = shape?.boundElements?.find((b) => b.type === 'text')?.id
    if (!shape || !textId) {
      done.problems.push(`relabel ${r.id}: no labelled shape with that id`)
      continue
    }
    els = els.map((e) => (e.id === textId ? bump(e, { text: String(r.text ?? ''), originalText: String(r.text ?? '') }) : e))
    done.relabelled += 1
  }

  for (const id of Array.isArray(req.remove) ? req.remove.map(String) : []) {
    const target = find(id)
    if (!target) {
      done.problems.push(`remove ${id}: not on the board`)
      continue
    }
    // The element, its label, and any connection bound to it.
    const gone = new Set([id, ...(target.boundElements ?? []).map((b) => b.id)])
    for (const e of els) if (e.startBinding?.elementId === id || e.endBinding?.elementId === id) gone.add(e.id)
    for (const e of els) if (e.containerId && gone.has(e.containerId)) gone.add(e.id)
    els = els.map((e) => (gone.has(e.id) && !e.isDeleted ? bump(e, { isDeleted: true }) : e))
    done.removed += 1
  }

  replaceScene(restoreElements(straighten(els), null, { refreshDimensions: true }))
  if (api && done.added) api.scrollToContent(undefined, { fitToContent: true, animate: true })
  return done
}

// Outside edits to the board file: merged by element, the higher version winning (R7.5).
function mergeExternal(incoming) {
  const out = new Map(elements.map((e) => [e.id, e]))
  for (const e of incoming) {
    const have = out.get(e.id)
    if (!have || (e.version ?? 0) > (have.version ?? 0)) out.set(e.id, e)
  }
  replaceScene(restoreElements(straighten([...out.values()]), null))
}

// Tells the editor its container has changed size or place.
export function refreshBoard() {
  api?.refresh()
}

export async function mountBoard(container) {
  const info = await window.garnet.board.open()
  // The header: where the agent finds the rendition and writes requests.
  const head = document.createElement('div')
  head.className = 'board-head'
  const paths = document.createElement('span')
  paths.className = 'board-paths mono'
  paths.textContent = `${info.paths.rendition}`
  paths.title = 'The rendition the agent reads; it changes the board by writing a request beside it.'
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.textContent = 'Copy the board’s path for the agent'
  copy.addEventListener('click', () => {
    navigator.clipboard.writeText(`The shared board's rendition is ${info.paths.rendition}; read it, and change the board by writing ${info.paths.request} as its header describes.`)
    setStatus('Copied.')
  })
  statusEl = document.createElement('span')
  statusEl.className = 'board-status'
  head.append(paths, copy, statusEl)
  const holder = document.createElement('div')
  holder.className = 'board-canvas'
  container.replaceChildren(head, holder)

  elements = info.scene?.elements ? restoreElements(info.scene.elements, null) : []
  const convert = info.scene && (info.scene.style !== 'plain' || elements.some(offStyle))
  // A change of face changes the text's measured size, so it is remeasured.
  if (convert) elements = restoreElements(straighten(toPlain(elements)), null, { refreshDimensions: true })
  savedVersion = convert ? -1 : getSceneVersion(elements)

  window.garnet.board.onRequest(({ request, error }) => {
    if (error) return setStatus(error, true)
    const d = applyRequest(request)
    setStatus(`The agent ${[d.added && `added ${d.added}`, d.relabelled && `relabelled ${d.relabelled}`, d.removed && `removed ${d.removed}`].filter(Boolean).join(', ') || 'changed nothing'}.${d.problems.length ? ` Problems: ${d.problems.join('; ')}.` : ''}`, d.problems.length > 0)
  })
  window.garnet.board.onExternal((incoming) => mergeExternal(incoming))

  createRoot(holder).render(
    React.createElement(Excalidraw, {
      // Requests are applied to the mounted editor only: until then the main
      // process keeps them on disk.
      excalidrawAPI: (a) => {
        const first = !api
        api = a
        if (first) window.garnet.board.ready()
        if (first && convert) scheduleSave()
      },
      initialData: { elements, appState: { theme: 'dark', viewBackgroundColor: GROUND, ...PLAIN_APP_STATE }, scrollToContent: true },
      theme: 'dark',
      onChange: (els) => {
        elements = els
        // Pasted elements may come in another style; they are given the board's.
        if (els.some((e) => !e.isDeleted && offStyle(e))) queueMicrotask(() => replaceScene(restoreElements(straighten(elements), null, { refreshDimensions: true })))
        scheduleSave()
      },
      // The board's own controls: no style choices beyond colour, stroke and edges.
      UIOptions: { canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false }, tools: { image: false } },
    }),
  )
}
