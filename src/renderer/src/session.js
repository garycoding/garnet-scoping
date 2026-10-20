// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A session's window: the Desk (R2 to R4, R6) and, beside it, the board (R7).
// The Desk is redrawn whenever the main process says the session changed,
// keeping which turns are open and where each column is scrolled.

import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ago, clock, since } from './util.js'

const $ = (id) => document.getElementById(id)
const el = (tag, cls, text) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}
const basename = (p) => String(p).split('/').pop()
// A path as short as it can be read: relative to the session's working
// folder when inside it, from ~ when inside the home folder.
const shortPath = (p) => {
  const cwd = view?.facts.cwd
  if (cwd && p.startsWith(cwd + '/')) return p.slice(cwd.length + 1)
  const home = /^(\/Users\/[^/]+|\/home\/[^/]+)/.exec(p)?.[1]
  return home ? '~' + p.slice(home.length) : p
}
const markdown = (text) => {
  const div = el('div', 'markdown')
  div.innerHTML = DOMPurify.sanitize(marked.parse(text ?? ''))
  return div
}

const TRAIL_PAGE = 40
let trailShown = TRAIL_PAGE
const open = new Set() // turn indexes the person opened
const closed = new Set() // turn indexes the person closed
let view = null
let memory = null

// ---- the viewer: a note, or an action's command and output ----
function showViewer(title, body, { wide = false } = {}) {
  $('viewer').querySelector('.viewer-box').classList.toggle('wide', wide)
  $('viewer-title').textContent = title
  $('viewer-body').replaceChildren(body)
  $('viewer').hidden = false
}
$('viewer-close').addEventListener('click', () => ($('viewer').hidden = true))
$('viewer').addEventListener('mousedown', (e) => e.target === $('viewer') && ($('viewer').hidden = true))
window.addEventListener('keydown', (e) => e.key === 'Escape' && ($('viewer').hidden = true))

// ---- discussing a row (R2.7) ----
// Any row of Plan, Now, Trail or Memory can be marked for discussion: a
// double-click marks it (or withdraws an open mark), and the right-click
// menu marks it with or without a note. Marks live in the session's state
// file, where the agent's watcher sees them; the agent answers them there.
let marks = []
const FLAG_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 1.5v13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.2 2.2h8.3l-2 3.1 2 3.1H4.2z" fill="currentColor"/></svg>'
const openMark = (key) => marks.find((m) => m.key === key && m.status === 'open')
// A row's mark: its open one if any, else its latest (turned off or answered).
const markOf = (key) => openMark(key) ?? marks.findLast((m) => m.key === key)
const answeredMark = (key) => marks.findLast((m) => m.key === key && m.answer)
function toggleFlag(id) {
  return window.garnet.discuss({ op: 'toggle', id }).then(setMarks)
}

// ---- Hold (R2.8) ----
// The person asks the agent to stop after its current step; the agent
// confirms it has stopped; the person releases it with the same button.
let hold = 'off'
function showHold(state) {
  hold = state?.hold ?? 'off'
  const b = $('hold')
  b.className = `hold ${hold}`
  b.setAttribute('aria-pressed', String(hold !== 'off'))
  b.textContent = hold === 'requested' ? 'Hold requested' : hold === 'holding' ? 'Holding · Release' : 'Hold'
  b.title =
    hold === 'requested'
      ? 'Waiting for the agent to finish its current step; click to withdraw'
      : hold === 'holding'
        ? 'The agent has stopped and is waiting; click to release it'
        : 'Ask the agent to stop after its current step'
}
$('hold').addEventListener('click', () => {
  window.garnet.board.setState({ hold: hold === 'off' ? 'requested' : 'off' }).then(setMarks)
})

function setMarks(state) {
  showHold(state)
  marks = state?.discuss ?? []
  renderDiscuss()
  if (view) {
    renderPresent()
    renderTrail()
    renderMemory()
  }
}

function mark(row, note = null) {
  return window.garnet.discuss({ op: 'mark', mark: { panel: row.panel, key: row.key, text: row.text, note } }).then(setMarks)
}
function withdraw(id) {
  return window.garnet.discuss({ op: 'remove', id }).then(setMarks)
}
function toggleMark(row) {
  const m = openMark(row.key)
  return m ? withdraw(m.id) : mark(row)
}

function askNote(row) {
  const body = el('div', 'note-form')
  const area = el('textarea')
  area.rows = 3
  area.placeholder = 'What would you like to ask about it?'
  const go = el('button', 'primary', 'Discuss')
  go.type = 'button'
  const send = () => {
    $('viewer').hidden = true
    mark(row, area.value.trim() || null)
  }
  go.addEventListener('click', send)
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
  })
  body.append(el('div', 'muted', row.text), area, go)
  showViewer('Discuss, with a note', body)
  area.focus()
}

const menu = $('ctx-menu')
function closeMenu() {
  menu.hidden = true
}
function showMenu(e, row, extra = []) {
  e.preventDefault()
  const items = [
    ['Discuss', () => mark(row)],
    ['Discuss, with a note…', () => askNote(row)],
  ]
  const m = openMark(row.key)
  if (m) items.push(['Withdraw the discussion', () => withdraw(m.id)])
  items.push(...extra)
  menu.replaceChildren(
    ...items.map(([label, act]) => {
      const b = el('button', null, label)
      b.type = 'button'
      b.addEventListener('click', () => {
        closeMenu()
        act()
      })
      return b
    }),
  )
  menu.hidden = false
  const { innerWidth: w, innerHeight: h } = window
  const r = menu.getBoundingClientRect()
  menu.style.left = `${Math.min(e.clientX, w - r.width - 4)}px`
  menu.style.top = `${Math.min(e.clientY, h - r.height - 4)}px`
}
window.addEventListener('mousedown', (e) => !menu.contains(e.target) && closeMenu())
window.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu())
window.addEventListener('blur', closeMenu)

// Makes a row markable. Its own click, if any, waits a moment so that a
// double-click does not also open it.
function markable(node, row, onClick = null, extra = []) {
  let timer = null
  if (onClick) {
    node.addEventListener('click', (e) => {
      if (e.detail > 1) return
      clearTimeout(timer)
      timer = setTimeout(onClick, 260)
    })
  }
  node.addEventListener('dblclick', (e) => {
    e.preventDefault()
    clearTimeout(timer)
    window.getSelection()?.removeAllRanges()
    toggleMark(row)
  })
  node.addEventListener('contextmenu', (e) => showMenu(e, row, extra))
  // The flag column: empty until the row is marked; then a flag, lit while
  // it is a request to discuss, dim when turned off or answered. A click on
  // the flag turns it off or on again.
  node.classList.add('flaggable')
  node.dataset.key = row.key
  const m = markOf(row.key)
  const cell = el('span', 'flag-cell')
  if (m) {
    const flag = el('button', `flag ${m.status === 'open' ? 'on' : 'off'}`)
    flag.type = 'button'
    flag.innerHTML = FLAG_SVG
    flag.title =
      m.status === 'open'
        ? `A request to discuss${m.note ? `: ${m.note}` : ''}. Click to turn it off.`
        : `${m.status === 'answered' ? 'Answered' : 'Turned off'}${m.note ? ` (${m.note})` : ''}. Click to ask again.`
    flag.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleFlag(m.id)
    })
    flag.addEventListener('dblclick', (e) => e.stopPropagation())
    cell.append(flag)
  }
  node.prepend(cell)
  const done = answeredMark(row.key)
  if (done?.answer) node.append(el('div', 'discuss-answer', `Answered: ${done.answer}`))
  return node
}


async function showDetail(action) {
  const d = await window.garnet.detail(action.id)
  const body = el('div')
  if (d?.command) {
    body.append(el('h2', null, 'Command'), Object.assign(el('pre'), { textContent: d.command }))
  }
  body.append(el('h2', null, d?.isError ? 'Output (an error)' : 'Output'), Object.assign(el('pre'), { textContent: d?.output ?? '(no output recorded)' }))
  showViewer(action.text, body)
}

// ---- pieces ----
function actionRow(a, { showAgo = false, panel = 'now' } = {}) {
  const li = el('li', `action${a.hasDetail ? ' detail' : ''}${a.isError ? ' error' : ''}${a.done ? '' : ' running'}`)
  li.append(el('span', 'text', a.text), el('span', 'when', showAgo ? ago(a.at) : clock(a.at)))
  if (a.target) li.title = a.target
  return markable(li, { panel, key: `action:${a.id}`, text: a.text }, a.hasDetail ? () => showDetail(a) : null)
}

function pathList(entries, kind) {
  const ul = el('ul', 'paths')
  for (const [path, how] of entries) {
    const li = el('li')
    li.append(el('span', 'how', how === 'write' ? 'wrote' : 'read'), document.createTextNode(kind === 'notes' ? basename(path).replace(/\.md$/, '') : shortPath(path)))
    li.title = path
    li.addEventListener('click', () => (kind === 'notes' ? openNote(path, basename(path)) : window.garnet.showInFinder(path)))
    ul.append(li)
  }
  return ul
}

// ---- the present state (R2) ----
function renderPresent() {
  const plan = $('plan')
  plan.replaceChildren(...view.plan.items.map((it) => markable(el('li', it.status, it.content), { panel: 'plan', key: `plan:${it.content}`, text: it.content })))
  if (!view.plan.items.length) plan.replaceChildren(el('li', 'muted', 'No plan in this session.'))

  $('now').replaceChildren(...(view.now.length ? view.now.map((a) => actionRow(a, { showAgo: true })) : [el('li', 'muted', 'No actions yet.')]))

  $('waiting').replaceChildren(
    ...(view.waiting.length
      ? view.waiting.map((w) => {
          const li = el('li', 'action running')
          li.append(el('span', 'text', w.text), el('span', 'when', since(w.startedAt)))
          return li
        })
      : [el('li', 'muted', 'Nothing running in the background.')]),
  )

  const lw = view.lastWord
  const box = $('last-word')
  box.replaceChildren()
  // The agent writes Markdown; it is shown rendered, whole, in a box that
  // scrolls when it is long.
  if (lw?.text) box.append(Object.assign(markdown(lw.text), { className: 'speech markdown' }))
  if (lw?.recap) box.append(el('div', 'recap', lw.recap))
  if (lw?.ask) box.append(el('div', 'awaiting', `Asked: ${lw.ask}`))
  if (lw?.agentSpokeLast) box.append(el('div', 'awaiting', `The agent has spoken last${lw.at ? ` (${ago(lw.at)})` : ''}: your turn.`))
  else if (lw?.working) box.append(el('div', 'muted', 'The agent is at work.'))
  if (!box.childNodes.length) box.append(el('span', 'muted', 'Nothing yet.'))

  renderForYou()

  const t = $('touched')
  t.replaceChildren()
  if (view.touched.files.length) t.append(pathList(view.touched.files, 'files'))
  if (view.touched.notes.length) t.append(el('h2', null, 'Memory notes'), pathList(view.touched.notes, 'notes'))
  if (!t.childNodes.length) t.append(el('span', 'muted', 'No files or notes yet this turn.'))
}

// ---- For you (R2.9): the files the agent sent the person ----
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i
function renderForYou() {
  const box = $('for-you')
  const list = view.deliveries ?? []
  if (!list.length) return box.replaceChildren(el('span', 'muted', 'No files sent yet in this session.'))
  box.replaceChildren(
    ...list.slice(0, 6).map((d) => {
      const item = el('div', 'delivery')
      const head = el('div', 'delivery-head')
      head.append(el('span', 'caption', d.caption || (d.files.length === 1 ? basename(d.files[0].path) : `${d.files.length} files`)), el('span', 'when', ago(d.at)))
      item.append(head)
      const files = el('div', 'delivery-files')
      for (const f of d.files) {
        const tile = el('button', `delivery-file${f.exists ? '' : ' gone'}`)
        tile.type = 'button'
        tile.title = f.exists ? `${f.path}\nClick to preview; right-click for more.` : `${f.path}\nNo longer on disk.`
        if (f.exists && IMAGE.test(f.path)) {
          const img = el('img')
          img.src = `file://${encodeURI(f.path)}`
          img.alt = basename(f.path)
          tile.append(img)
        }
        tile.append(el('span', 'name', basename(f.path)))
        const row = { panel: 'foryou', key: `file:${f.path}`, text: `${basename(f.path)}${d.caption ? ` (${d.caption})` : ''}` }
        const extra = f.exists
          ? [
              ['Open in its default app', () => window.garnet.openFile(f.path)],
              ['Show in the Finder', () => window.garnet.showInFinder(f.path)],
            ]
          : []
        files.append(markable(tile, row, f.exists ? () => previewFile(f.path, row) : null, extra))
      }
      item.append(files)
      return item
    }),
  )
}

// The in-app preview of a delivered file, in the viewer overlay.
async function previewFile(path, row) {
  const name = basename(path)
  const body = el('div', 'preview')
  if (IMAGE.test(path)) {
    const img = el('img', 'preview-image')
    img.src = `file://${encodeURI(path)}`
    img.alt = name
    body.append(img)
  } else if (/\.pdf$/i.test(path)) {
    const frame = el('iframe', 'preview-pdf')
    frame.src = `file://${encodeURI(path)}`
    body.append(frame)
  } else {
    const r = await window.garnet.readFile(path)
    if (r?.kind === 'text') body.append(/\.(md|markdown)$/i.test(path) ? markdown(r.text) : Object.assign(el('pre', 'preview-text'), { textContent: r.text }))
    else if (r?.kind === 'gone') body.append(el('p', 'muted', 'This file is no longer on disk.'))
    else body.append(el('p', 'muted', `No preview for this kind of file${r?.size != null ? ` (${Math.ceil(r.size / 1024)} KB)` : ''}.`))
  }
  const bar = el('div', 'preview-bar')
  for (const [label, act] of [
    ['Open in its default app', () => window.garnet.openFile(path)],
    ['Show in the Finder', () => window.garnet.showInFinder(path)],
    ['Discuss…', () => askNote(row)],
  ]) {
    const b = el('button', null, label)
    b.type = 'button'
    b.addEventListener('click', act)
    bar.append(b)
  }
  showViewer(name, Object.assign(el('div'), { className: 'preview-wrap' }), { wide: true })
  $('viewer-body').firstChild.append(body, bar)
}

// ---- the trail (R3) ----
function turnEl(t, i, isLast) {
  const sec = el('article', 'turn')
  const head = el('header')
  const who = t.human ? t.human.text.split('\n')[0] || '(an image)' : 'Before the first message'
  const actions = t.items.filter((x) => x.type === 'action').length
  head.append(el('span', 'when', clock(t.at ?? t.items[0]?.at)), el('span', 'who', who), el('span', 'count', `${actions} action${actions === 1 ? '' : 's'}`))
  sec.append(head)
  const isOpen = open.has(i) || (isLast && !closed.has(i))
  markable(head, { panel: 'trail', key: `turn:${i}`, text: `Turn at ${clock(t.at ?? t.items[0]?.at)}: ${who}` }, () => {
    if (isOpen) {
      open.delete(i)
      closed.add(i)
    } else {
      open.add(i)
      closed.delete(i)
    }
    renderTrail()
  })
  if (!isOpen) return sec
  const body = el('div', 'body')
  if (t.human) {
    body.append(el('div', 'human', t.human.text))
    if (t.human.images) body.append(el('div', 'muted', `${t.human.images} image${t.human.images === 1 ? '' : 's'}`))
    if (t.human.inferred) body.append(el('div', 'inferred', 'Taken for the person’s message by elimination: this transcript predates the field that marks it.'))
  }
  const ul = el('ul', 'actions')
  const flush = () => {
    if (ul.childNodes.length) body.append(ul.cloneNode(false)), body.lastChild.replaceChildren(...ul.childNodes)
  }
  for (const [j, it] of t.items.entries()) {
    if (it.type === 'action') {
      ul.append(actionRow(it, { panel: 'trail' }))
      continue
    }
    flush()
    if (it.type === 'text') body.append(markable(Object.assign(markdown(it.text), { className: 'item text markdown' }), { panel: 'trail', key: `text:${i}:${j}`, text: it.text.replace(/\s+/g, ' ').slice(0, 300) }))
    else if (it.type === 'thinking') body.append(el('div', 'item thinking', it.text ? it.text : 'Reasoning: not kept in the transcript.'))
    else if (it.type === 'mid-turn') body.append(el('div', 'item mid-turn', `Sent mid-turn: ${it.text}`))
    else if (it.type === 'notification') body.append(el('div', 'item notification', `Finished in the background: ${it.text}`))
    else if (it.type === 'interrupt') body.append(el('div', 'item muted', 'Interrupted by the person.'))
  }
  flush()
  if (t.recap) body.append(el('div', 'recap', t.recap))
  if (t.ask) body.append(el('div', 'awaiting', `Asked: ${t.ask}`))
  if (t.files.length) body.append(el('h2', null, 'Files'), pathList(t.files, 'files'))
  if (t.notes.length) body.append(el('h2', null, 'Memory notes'), pathList(t.notes, 'notes'))
  sec.append(body)
  return sec
}

function renderTrail() {
  const trail = $('trail')
  const col = trail.parentElement
  const atBottom = col.scrollHeight - col.scrollTop - col.clientHeight < 40
  const top = col.scrollTop
  const turns = view.turns
  const from = Math.max(0, turns.length - trailShown)
  const nodes = []
  if (from > 0) {
    const more = el('button', 'show-earlier', `Show ${Math.min(TRAIL_PAGE, from)} earlier turns (${from} hidden)`)
    more.type = 'button'
    more.addEventListener('click', () => {
      trailShown += TRAIL_PAGE
      renderTrail()
    })
    nodes.push(more)
  }
  for (let i = from; i < turns.length; i++) nodes.push(turnEl(turns[i], i, i === turns.length - 1))
  trail.replaceChildren(...nodes)
  col.scrollTop = atBottom ? col.scrollHeight : top
}

// ---- the facts and drift (R2.6, R6) ----
function renderFacts() {
  const f = view.facts
  document.title = f.title ?? view.id
  $('title').textContent = f.title ?? view.id
  const facts = $('facts')
  facts.replaceChildren()
  const parts = [f.model && `${f.model}${f.effort ? ` · ${f.effort}` : ''}`, f.branch && `branch ${f.branch}`, f.budgetLeft != null && `${f.budgetLeft.toLocaleString()} tokens left`, f.versions.length && `Claude Code ${f.versions[f.versions.length - 1]}`].filter(Boolean)
  if (f.cwd) {
    const a = el('a', null, f.cwd)
    a.href = '#'
    a.title = 'Show in the Finder'
    a.addEventListener('click', (e) => {
      e.preventDefault()
      window.garnet.showInFinder(f.cwd)
    })
    facts.append(a, document.createTextNode(' · '))
  }
  facts.append(document.createTextNode(parts.join(' · ')))
  for (const pr of f.prs.slice(-3)) facts.append(document.createTextNode(` · PR ${pr.number}`))

  const d = view.drift
  const notes = []
  if (d.unknown.length) notes.push(`Records of kinds this version does not know: ${d.unknown.map(([k, n]) => `${k} (${n})`).join(', ')}.`)
  if (d.bad) notes.push(`${d.bad} line${d.bad === 1 ? '' : 's'} could not be read.`)
  if (d.newerThanChecked) notes.push(`This session’s Claude Code (${f.versions[f.versions.length - 1]}) is newer than any this app was checked against (up to ${d.checked.highest}); some parts may be missing.`)
  $('drift').hidden = !notes.length
  $('drift').textContent = notes.join(' ')
}

// ---- the Memory pane (R4) ----
async function openNote(path, name) {
  const text = await window.garnet.readMemory(path)
  showViewer(name, text == null ? el('p', 'muted', 'This note could not be read.') : markdown(text.replace(/^---\n[\s\S]*?\n---\n/, '')))
}

function renderMemory() {
  const box = $('memory')
  box.replaceChildren()
  if (!memory || (!memory.notes.length && !memory.index)) {
    box.append(el('p', 'muted', 'This project has no memory notes.'))
    return
  }
  const used = new Set(view.turns.flatMap((t) => t.notes.map(([p]) => p)))
  if (memory.index) {
    const n = el('div', 'note')
    n.append(el('div', 'name', 'MEMORY (the index)'))
    box.append(markable(n, { panel: 'memory', key: `note:${memory.index.path}`, text: 'MEMORY (the index)' }, () => openNote(memory.index.path, 'MEMORY')))
  }
  let type = null
  for (const note of memory.notes) {
    if (note.type !== type) {
      type = note.type
      box.append(el('h2', 'memory-type', type))
    }
    const n = el('div', `note${used.has(note.path) ? ' used' : ''}`)
    n.title = used.has(note.path) ? 'Read or written in this session' : note.path
    n.append(el('div', 'name', note.name), el('div', 'desc', note.description))
    box.append(markable(n, { panel: 'memory', key: `note:${note.path}`, text: `Memory note ${note.name}` }, () => openNote(note.path, note.name)))
  }
}

// ---- the panels ----
// Four panels the person turns on and off: Desk, Trail, Memory and Board.
// Which are on is remembered across windows; at least one stays on. The
// board takes half the window, on the side set in Settings, or all of it
// when it is the only panel on.
const PANELS = ['desk', 'trail', 'memory', 'discuss', 'board']
const PANELS_KEY = 'garnet.panels'
const DEFAULT_PANELS = { desk: true, trail: false, memory: false, discuss: false, board: true }
const SIDE = ['desk', 'trail', 'memory', 'discuss'] // the panels that share the Desk's half

function loadPanels() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANELS_KEY))
    const out = { ...DEFAULT_PANELS }
    for (const p of PANELS) if (typeof saved?.[p] === 'boolean') out[p] = saved[p]
    return PANELS.some((p) => out[p]) ? out : { ...DEFAULT_PANELS }
  } catch {
    return { ...DEFAULT_PANELS }
  }
}
let panels = loadPanels()
let boardSide = 'right'

// The board is loaded when it is first shown; Excalidraw finds its bundled
// fonts beside this page (no request leaves the app).
let boardMounted = false
let boardModule = null
async function mountBoardOnce() {
  if (boardMounted) return
  boardMounted = true
  $('tog-board').classList.remove('pending')
  window.EXCALIDRAW_ASSET_PATH = new URL('./', location.href).href
  boardModule = await import('./board.js')
  await boardModule.mountBoard($('board'))
}

function layout() {
  const others = SIDE.filter((p) => panels[p])
  for (const p of SIDE) $(`pane-${p}`).hidden = !panels[p]
  $('desk').hidden = !others.length
  $('board').hidden = !panels.board
  const stage = $('stage')
  stage.className = `stage board-${boardSide}${panels.board && others.length ? ' split' : ''}`
  for (const p of PANELS) {
    $(`tog-${p}`).classList.toggle('active', panels[p])
    $(`tog-${p}`).setAttribute('aria-pressed', String(panels[p]))
  }
  if (panels.board) mountBoardOnce()
  // The editor measures its container; it is told when that changes.
  requestAnimationFrame(() => boardModule?.refreshBoard())
}

function setPanels(next) {
  if (!PANELS.some((q) => next[q])) return
  panels = next
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels))
  } catch {}
  layout()
}
for (const p of PANELS) $(`tog-${p}`).addEventListener('click', () => setPanels({ ...panels, [p]: !panels[p] }))

// ---- the requests to discuss: a list, and the jump to each item ----
// The same list is shown in the Discuss panel and in the drop-down of the
// header's flag button. Choosing an entry shows its item in its own panel
// (turned on, a Trail turn opened, as needed), scrolled into view, with a
// highlight that fades over two seconds.
const WHERE = { plan: 'Plan', now: 'Now', trail: 'Trail', memory: 'Memory', foryou: 'For you' }

function discussEntries() {
  const open = marks.filter((m) => m.status === 'open').reverse()
  const rest = marks.filter((m) => m.status !== 'open').reverse()
  return [...open, ...rest]
}

function discussItem(m, after) {
  const item = el('div', `discuss-item ${m.status}`)
  const flag = el('button', `flag ${m.status === 'open' ? 'on' : 'off'}`)
  flag.type = 'button'
  flag.innerHTML = FLAG_SVG
  flag.title = m.status === 'open' ? 'Click to turn this request off' : 'Click to ask again'
  flag.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleFlag(m.id)
  })
  const body = el('div', 'discuss-body')
  body.append(el('div', 'discuss-what', m.text))
  const meta = [WHERE[m.panel] ?? m.panel, m.at ? ago(m.at) : null].filter(Boolean).join(' · ')
  body.append(el('div', 'discuss-meta', meta))
  if (m.note) body.append(el('div', 'discuss-note', `“${m.note}”`))
  if (m.answer) body.append(el('div', 'discuss-ans', `Answered: ${m.answer}`))
  item.append(flag, body)
  item.title = 'Show it where it is'
  item.addEventListener('click', () => {
    after?.()
    jumpTo(m)
  })
  return item
}

function renderDiscuss() {
  const entries = discussEntries()
  const openCount = marks.filter((m) => m.status === 'open').length
  const btn = $('discuss-btn')
  btn.hidden = !marks.length
  btn.innerHTML = `${FLAG_SVG}<span>${openCount}</span>`
  btn.classList.toggle('lit', openCount > 0)
  btn.title = openCount ? `${openCount} request${openCount === 1 ? '' : 's'} to discuss` : 'No open requests to discuss'
  const list = $('discuss-list')
  list.replaceChildren(...(entries.length ? entries.map((m) => discussItem(m)) : [el('p', 'muted', 'Nothing marked to discuss in this session.')]))
  const drop = $('discuss-drop')
  if (!drop.hidden) fillDrop()
}

function fillDrop() {
  const drop = $('discuss-drop')
  drop.replaceChildren(...discussEntries().map((m) => discussItem(m, () => (drop.hidden = true))))
}
$('discuss-btn').addEventListener('click', (e) => {
  e.stopPropagation()
  const drop = $('discuss-drop')
  if (!drop.hidden) return (drop.hidden = true)
  fillDrop()
  const r = $('discuss-btn').getBoundingClientRect()
  drop.style.top = `${r.bottom + 6}px`
  drop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`
  drop.hidden = false
})
window.addEventListener('mousedown', (e) => {
  const drop = $('discuss-drop')
  if (!drop.hidden && !drop.contains(e.target) && e.target !== $('discuss-btn') && !$('discuss-btn').contains(e.target)) drop.hidden = true
})
window.addEventListener('keydown', (e) => e.key === 'Escape' && ($('discuss-drop').hidden = true))

// Shows a marked item where it is.
function jumpTo(m) {
  const key = m.key
  const want = { ...panels }
  let container = null
  if (m.panel === 'plan') {
    want.desk = true
    container = 'plan'
  } else if (m.panel === 'memory') {
    want.memory = true
    container = 'memory'
  } else if (m.panel === 'foryou') {
    want.desk = true
    container = 'for-you'
  } else if (m.panel === 'now' && document.querySelector('#now') && [...$('now').querySelectorAll('[data-key]')].some((n) => n.dataset.key === key)) {
    want.desk = true
    container = 'now'
  } else {
    // An action no longer in Now, or anything of the Trail: its place in the Trail.
    want.trail = true
    container = 'trail'
    const turnOf = () => {
      if (key.startsWith('turn:')) return Number(key.slice(5))
      if (key.startsWith('text:')) return Number(key.split(':')[1])
      if (key.startsWith('action:')) return view.turns.findIndex((t) => t.items.some((it) => it.type === 'action' && it.id === key.slice(7)))
      return -1
    }
    const i = turnOf()
    if (i >= 0) {
      open.add(i)
      closed.delete(i)
      trailShown = Math.max(trailShown, view.turns.length - i)
    }
  }
  if (SIDE.some((p) => want[p] !== panels[p])) setPanels(want)
  if (container === 'trail') renderTrail()
  requestAnimationFrame(() => {
    const node = [...$(container).querySelectorAll('[data-key]')].find((n) => n.dataset.key === key)
    if (!node) {
      if (m.panel === 'foryou') previewFile(key.slice(5), { panel: 'foryou', key, text: m.text })
      return
    }
    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    node.classList.remove('jumped')
    void node.offsetWidth
    node.classList.add('jumped')
  })
}
window.garnet.settings.get().then((s) => {
  boardSide = s.boardSide
  layout()
})
window.garnet.settings.onChanged((s) => {
  boardSide = s.boardSide
  layout()
})
layout()
// A request from the agent waits until the board is open: mark its toggle.
window.garnet.board.onPending(() => {
  if (!boardMounted) $('tog-board').classList.add('pending')
})

async function refresh() {
  const next = await window.garnet.view()
  if (!next) return
  view = next
  renderFacts()
  renderPresent()
  renderTrail()
  memory = await window.garnet.listMemory()
  renderMemory()
}

window.garnet.onChanged(refresh)
// The marks to discuss: read once, then kept current by the main process.
window.garnet.discuss({ op: 'get' }).then(setMarks)
window.garnet.board.onState(setMarks)
setInterval(() => view && renderPresent(), 15_000) // keep the waiting times current
refresh()
