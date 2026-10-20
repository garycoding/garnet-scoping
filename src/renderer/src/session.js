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
function showViewer(title, body) {
  $('viewer-title').textContent = title
  $('viewer-body').replaceChildren(body)
  $('viewer').hidden = false
}
$('viewer-close').addEventListener('click', () => ($('viewer').hidden = true))
$('viewer').addEventListener('mousedown', (e) => e.target === $('viewer') && ($('viewer').hidden = true))
window.addEventListener('keydown', (e) => e.key === 'Escape' && ($('viewer').hidden = true))

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
function actionRow(a, { showAgo = false } = {}) {
  const li = el('li', `action${a.hasDetail ? ' detail' : ''}${a.isError ? ' error' : ''}${a.done ? '' : ' running'}`)
  li.append(el('span', 'text', a.text), el('span', 'when', showAgo ? ago(a.at) : clock(a.at)))
  if (a.target) li.title = a.target
  if (a.hasDetail) li.addEventListener('click', () => showDetail(a))
  return li
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
  plan.replaceChildren(...view.plan.items.map((it) => el('li', it.status, it.content)))
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

  const t = $('touched')
  t.replaceChildren()
  if (view.touched.files.length) t.append(pathList(view.touched.files, 'files'))
  if (view.touched.notes.length) t.append(el('h2', null, 'Memory notes'), pathList(view.touched.notes, 'notes'))
  if (!t.childNodes.length) t.append(el('span', 'muted', 'No files or notes yet this turn.'))
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
  head.addEventListener('click', () => {
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
  for (const it of t.items) {
    if (it.type === 'action') {
      ul.append(actionRow(it))
      continue
    }
    flush()
    if (it.type === 'text') body.append(Object.assign(markdown(it.text), { className: 'item text markdown' }))
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
    n.addEventListener('click', () => openNote(memory.index.path, 'MEMORY'))
    box.append(n)
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
    n.addEventListener('click', () => openNote(note.path, note.name))
    box.append(n)
  }
}

// ---- tabs ----
function showTab(name) {
  $('desk').hidden = name !== 'desk'
  $('board').hidden = name !== 'board'
  $('tab-desk').classList.toggle('active', name === 'desk')
  $('tab-board').classList.toggle('active', name === 'board')
}
// The board is loaded when its tab is first shown; Excalidraw finds its
// bundled fonts beside this page (no request leaves the app).
let boardMounted = false
async function showBoard() {
  showTab('board')
  $('tab-board').classList.remove('pending')
  if (boardMounted) return
  boardMounted = true
  window.EXCALIDRAW_ASSET_PATH = new URL('./', location.href).href
  const { mountBoard } = await import('./board.js')
  await mountBoard($('board'))
}
$('tab-desk').addEventListener('click', () => showTab('desk'))
$('tab-board').addEventListener('click', showBoard)
// A request from the agent waits until the board is open: mark the tab.
window.garnet.board.onPending(() => {
  if (!boardMounted) $('tab-board').classList.add('pending')
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
setInterval(() => view && renderPresent(), 15_000) // keep the waiting times current
refresh()
