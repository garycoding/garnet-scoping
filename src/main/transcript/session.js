// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Folds classified records into one session's model (R2, R3): its turns, the
// agent's plan, the background work it started, the files and memory notes it
// touched, and the session's facts. createSession() returns a model that is
// extended record by record, so a transcript being written is followed by
// applying each new batch of lines.

import { classify } from './records.js'

// The Claude Code versions this reader was checked against (R6.2).
export const CHECKED_VERSIONS = { lowest: '2.1.170', highest: '2.1.299' }

// Kept per action so that its output can be shown on request (R5.2), without
// holding very large outputs whole.
const OUTPUT_LIMIT = 20000

const FILE_TOOLS = {
  Read: 'read',
  Write: 'write',
  Edit: 'write',
  MultiEdit: 'write',
  NotebookEdit: 'write',
}

// A memory note: a Markdown file in a project's memory store.
export const isMemoryPath = (p) => typeof p === 'string' && /\/\.claude\/projects\/[^/]+\/memory\/[^/]+\.md$/.test(p)

const shortName = (name) => (name.startsWith('mcp__') ? name.split('__').slice(2).join('__') || name : name)

const basename = (p) => String(p).split('/').pop()

// What an action is about, in one line: the description the agent gave a
// shell command, or the tool and its target.
export function describeAction(name, input = {}) {
  const firstString = () => Object.values(input).find((v) => typeof v === 'string' && v.length < 200)
  switch (name) {
    case 'Bash':
      return { text: input.description || 'Shell command', target: null }
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return { text: `${name} ${basename(input.file_path ?? '')}`, target: input.file_path ?? null }
    case 'NotebookEdit':
      return { text: `Edit ${basename(input.notebook_path ?? '')}`, target: input.notebook_path ?? null }
    case 'Grep':
      return { text: `Search for ${input.pattern ?? ''}`, target: input.path ?? null }
    case 'Glob':
      return { text: `Find ${input.pattern ?? ''}`, target: input.path ?? null }
    case 'WebFetch':
      return { text: `Fetch ${input.url ?? ''}`, target: null }
    case 'WebSearch':
      return { text: `Search the web for ${input.query ?? ''}`, target: null }
    case 'Agent':
    case 'Task':
      return { text: `Agent: ${input.description ?? input.subagent_type ?? ''}`, target: null }
    case 'Skill':
      return { text: `Skill ${input.skill ?? ''}`, target: null }
    case 'Monitor':
      return { text: `Monitor: ${input.description ?? ''}`, target: null }
    default:
      return { text: [shortName(name), firstString()].filter(Boolean).join(': '), target: null }
  }
}

// Tools that change the plan or end the turn: shown as the plan and the
// recap, not as actions.
const PLAN_TOOLS = new Set(['mcp__ccd_turn__update_plan', 'TodoWrite', 'TaskCreate', 'TaskUpdate'])
const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'

export function createSession(id = null) {
  const s = {
    id,
    facts: {
      cwd: null,
      branch: null,
      versions: new Set(),
      model: null,
      effort: null,
      entrypoint: null,
      title: null,
      titleSource: null,
      prs: new Map(),
      budgetLeft: null,
      firstAt: null,
      lastAt: null,
    },
    turns: [],
    plan: { source: null, items: [] },
    background: new Map(), // task id -> { id, text, startedAt, finishedAt, status }
    pending: new Map(), // tool-use id -> action awaiting its result
    unknown: new Map(), // record type -> count
    bad: 0,
    records: 0,
  }

  const turn = () => {
    if (!s.turns.length) s.turns.push(newTurn(null, null))
    return s.turns[s.turns.length - 1]
  }

  function touch(t, path, how) {
    if (!path) return
    const key = isMemoryPath(path) ? 'notes' : 'files'
    const prev = t[key].get(path)
    t[key].set(path, prev === 'write' || how === 'write' ? 'write' : 'read')
  }

  function applyPlanTool(part, at) {
    const input = part.input
    if (part.name === 'mcp__ccd_turn__update_plan') {
      s.plan.source = 'app'
      if (Array.isArray(input.items)) {
        s.plan.items = input.items.map((it) => ({ content: String(it.content ?? ''), status: it.status ?? 'pending' }))
      }
      const items = s.plan.items
      if (input.advance) {
        const i = items.findIndex((it) => it.status === 'in_progress')
        if (i >= 0) items[i].status = 'completed'
        const next = items.findIndex((it, k) => k > i && it.status === 'pending')
        if (next >= 0) items[next].status = 'in_progress'
      }
      for (const n of Array.isArray(input.done) ? input.done : []) if (items[n - 1]) items[n - 1].status = 'completed'
      if (Number.isInteger(input.start) && items[input.start - 1]) {
        for (const it of items) if (it.status === 'in_progress') it.status = 'pending'
        items[input.start - 1].status = 'in_progress'
      }
    } else if (part.name === 'TodoWrite') {
      s.plan.source = 'todo'
      s.plan.items = (Array.isArray(input.todos) ? input.todos : []).map((t) => ({
        content: String(t.content ?? ''),
        status: t.status ?? 'pending',
      }))
    } else if (part.name === 'TaskCreate') {
      s.plan.source = 'tasks'
      // The id arrives with the result; until then the item is matched by its tool-use id.
      s.plan.items.push({ content: String(input.subject ?? ''), status: 'pending', useId: part.id, taskId: null })
    } else if (part.name === 'TaskUpdate') {
      s.plan.source = 'tasks'
      const it = s.plan.items.find((x) => x.taskId != null && String(x.taskId) === String(input.taskId))
      if (it) {
        if (input.status === 'deleted') s.plan.items.splice(s.plan.items.indexOf(it), 1)
        else if (input.status) it.status = input.status
        if (input.subject) it.content = String(input.subject)
      }
    }
    s.plan.updatedAt = at
  }

  function apply(raw) {
    s.records += 1
    const r = classify(raw)
    const f = s.facts
    if (r.sidechain) return r
    if (r.at) {
      f.firstAt ??= r.at
      if (!f.lastAt || r.at > f.lastAt) f.lastAt = r.at
    }
    if (r.cwd) f.cwd = r.cwd
    if (r.branch) f.branch = r.branch
    if (r.version) f.versions.add(r.version)
    if (r.entrypoint) f.entrypoint = r.entrypoint

    switch (r.kind) {
      case 'human':
        s.turns.push(newTurn(r.at, { text: r.text, images: r.images, inferred: r.inferred }))
        break
      case 'mid-turn':
        turn().items.push({ type: 'mid-turn', text: r.text, at: r.at })
        break
      case 'interrupt':
        turn().items.push({ type: 'interrupt', at: r.at })
        break
      case 'assistant': {
        const t = turn()
        if (r.model) f.model = r.model
        if (r.effort) f.effort = r.effort
        for (const part of r.parts) {
          if (part.type === 'text') {
            t.items.push({ type: 'text', text: part.text, at: r.at })
            t.closing = part.text
            t.closingAt = r.at
          } else if (part.type === 'thinking') {
            t.items.push({ type: 'thinking', text: part.text, at: r.at })
          } else if (part.type === 'tool') {
            if (PLAN_TOOLS.has(part.name)) {
              applyPlanTool(part, r.at)
              if (part.name === 'TaskCreate') s.pending.set(part.id, { planCreate: true })
              continue
            }
            if (part.name === WRAP_TOOL) {
              t.recap = part.input.recap ?? null
              t.ask = part.input.ask ?? null
              t.closingAt = r.at
              // The desktop app's wrap-up also checks off its task list,
              // without a further plan update in the transcript.
              if (s.plan.source === 'app') {
                for (const it of s.plan.items) it.status = 'completed'
                s.plan.updatedAt = r.at
              }
              continue
            }
            if (part.name === 'TaskStop' || part.name === 'KillShell') {
              const b = s.background.get(String(part.input.task_id ?? part.input.shell_id ?? ''))
              if (b && b.status === 'running') {
                b.status = 'stopped'
                b.finishedAt = r.at
              }
            }
            const d = describeAction(part.name, part.input)
            const action = {
              type: 'action',
              id: part.id,
              tool: part.name,
              text: d.text,
              target: d.target,
              command: part.name === 'Bash' ? (part.input.command ?? null) : null,
              background: Boolean(part.input.run_in_background),
              at: r.at,
              done: false,
              isError: false,
              output: null,
            }
            t.items.push(action)
            s.pending.set(part.id, action)
            const how = FILE_TOOLS[part.name]
            if (how) touch(t, d.target, how)
          }
        }
        break
      }
      case 'tool-results':
        for (const res of r.results) {
          const p = s.pending.get(res.id)
          if (!p) continue
          s.pending.delete(res.id)
          if (p.planCreate) {
            const it = s.plan.items.find((x) => x.useId === res.id)
            const id = r.meta?.task?.id ?? /#(\d+)/.exec(res.text)?.[1] ?? null
            if (it) it.taskId = id
            continue
          }
          p.done = true
          p.isError = res.isError
          p.output = res.text.length > OUTPUT_LIMIT ? res.text.slice(0, OUTPUT_LIMIT) + '\n…' : res.text
          const bgId = r.meta?.backgroundTaskId ?? (r.meta?.isAsync ? r.meta.agentId : null)
          if (bgId && r.results.length === 1) {
            s.background.set(String(bgId), { id: String(bgId), text: p.text, startedAt: r.at ?? p.at, finishedAt: null, status: 'running' })
          }
        }
        break
      case 'notification': {
        const b = r.taskId ? s.background.get(r.taskId) : null
        if (b) {
          b.finishedAt = r.at
          b.status = r.status ?? 'finished'
        }
        turn().items.push({ type: 'notification', text: r.summary ?? 'Background work finished', status: r.status, at: r.at })
        break
      }
      case 'title':
        if (r.title) {
          // A title the person set outranks the agent's and the generated one.
          const rank = { custom: 3, agent: 2, ai: 1 }
          if (!f.titleSource || rank[r.source] >= rank[f.titleSource]) {
            f.title = r.title.replace(/^\*\s*/, '')
            f.titleSource = r.source
          }
        }
        break
      case 'pr':
        if (r.url) f.prs.set(r.url, { number: r.number, url: r.url, repo: r.repo })
        break
      case 'budget':
        f.budgetLeft = r.left
        break
      case 'model':
        f.model = r.model
        break
      case 'unknown':
        s.unknown.set(r.type, (s.unknown.get(r.type) ?? 0) + 1)
        break
    }
    return r
  }

  return { state: s, apply }
}

function newTurn(at, human) {
  return { at, human, items: [], files: new Map(), notes: new Map(), closing: null, closingAt: null, recap: null, ask: null }
}

// Compares two dotted versions; returns >0 when a is newer.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

// The plain-object view the Desk renders: the present state (R2), the trail
// (R3), and the drift indicators (R6).
export function snapshot(s) {
  const f = s.facts
  const turns = s.turns
  const last = turns[turns.length - 1] ?? null
  const actions = []
  for (let i = turns.length - 1; i >= 0 && actions.length < 6; i--) {
    const items = turns[i].items
    for (let k = items.length - 1; k >= 0 && actions.length < 6; k--) if (items[k].type === 'action') actions.push(items[k])
  }
  const versions = [...f.versions].sort(compareVersions)
  const newest = versions[versions.length - 1] ?? null
  // The agent has spoken last when the last turn closed with its words and no
  // message of the person's came after (R2.4).
  // An action still running, or a notification after the words, means the
  // agent is still at work.
  const lastItem = last?.items[last.items.length - 1]
  const running = Boolean(last?.items.some((it) => it.type === 'action' && !it.done))
  const agentSpokeLast = Boolean(last && !running && lastItem && (lastItem.type === 'text' || (last.recap && lastItem.type !== 'mid-turn' && lastItem.type !== 'notification')))
  return {
    id: s.id,
    facts: {
      cwd: f.cwd,
      branch: f.branch,
      model: f.model,
      effort: f.effort,
      entrypoint: f.entrypoint,
      title: f.title,
      prs: [...f.prs.values()],
      budgetLeft: f.budgetLeft,
      firstAt: f.firstAt,
      lastAt: f.lastAt,
      versions,
    },
    plan: { source: s.plan.source, items: s.plan.items.map(({ content, status }) => ({ content, status })), updatedAt: s.plan.updatedAt ?? null },
    now: actions,
    waiting: [...s.background.values()].filter((b) => b.status === 'running'),
    lastWord: last ? { text: last.closing, recap: last.recap, ask: last.ask, at: last.closingAt, agentSpokeLast, working: running } : null,
    touched: last ? { files: [...last.files], notes: [...last.notes] } : { files: [], notes: [] },
    turns: turns.map((t) => ({
      at: t.at,
      human: t.human,
      items: t.items,
      files: [...t.files],
      notes: [...t.notes],
      recap: t.recap,
      ask: t.ask,
    })),
    drift: {
      unknown: [...s.unknown.entries()],
      bad: s.bad,
      records: s.records,
      newerThanChecked: newest ? compareVersions(newest, CHECKED_VERSIONS.highest) > 0 : false,
      checked: CHECKED_VERSIONS,
    },
  }
}
