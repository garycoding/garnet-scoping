// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { classify } from '../src/main/transcript/records.js'
import { createSession, snapshot, isMemoryPath, compareVersions } from '../src/main/transcript/session.js'
import * as F from './fixtures.js'

const build = (records) => {
  const { state, apply } = createSession('s1')
  for (const r of records) apply(r)
  return snapshot(state)
}

describe('classify', () => {
  it('recognises a human message by its origin', () => {
    expect(classify(F.human('hello'))).toMatchObject({ kind: 'human', text: 'hello', inferred: false })
  })
  it('infers a human message in an older transcript, and marks it inferred', () => {
    expect(classify(F.oldHuman('hello'))).toMatchObject({ kind: 'human', inferred: true })
  })
  it('does not take injected texts or skill bodies for the person', () => {
    expect(classify(F.injected('<local-command-stdout>x</local-command-stdout>')).kind).toBe('system')
    expect(classify(F.injected('Stop hook feedback: …')).kind).toBe('system')
    expect(classify(F.meta('Base directory for this skill')).kind).toBe('system')
  })
  it('reads a task notification', () => {
    expect(classify(F.notification('b1', 'completed', 'Build done'))).toMatchObject({ kind: 'notification', taskId: 'b1', status: 'completed', summary: 'Build done' })
  })
  it('hides setup records', () => {
    expect(classify(F.attachment({ type: 'session_context', context: { userEmail: 'x' } })).kind).toBe('hidden')
    expect(classify(F.attachment({ type: 'prompt_snapshot', systemPrompt: ['x'] })).kind).toBe('hidden')
  })
  it('counts an unknown record type instead of failing', () => {
    expect(classify(F.unknown('brand-new-kind'))).toMatchObject({ kind: 'unknown', type: 'brand-new-kind' })
  })
})

describe('the session model', () => {
  it('splits turns at the person\'s messages and closes each with the agent\'s words', () => {
    const s = build([
      F.titled('* Demo session'),
      F.human('first question'),
      F.assistant([F.thinking(''), F.text('first answer')]),
      F.human('second question'),
      F.assistant([F.text('second answer')]),
    ])
    expect(s.facts.title).toBe('Demo session')
    expect(s.turns.map((t) => t.human.text)).toEqual(['first question', 'second question'])
    expect(s.lastWord).toMatchObject({ text: 'second answer', agentSpokeLast: true })
  })

  it('does not take a running action for the agent having spoken last', () => {
    const s = build([F.human('go'), F.assistant([F.text('Starting the build.'), F.tool('t9', 'Bash', { command: 'make', description: 'Build' })])])
    expect(s.lastWord).toMatchObject({ agentSpokeLast: false, working: true })
  })

  it('describes a shell command by its description and keeps its output for the person to open', () => {
    const s = build([F.human('go'), F.assistant([F.tool('t1', 'Bash', { command: 'make secret', description: 'Build the app' })]), F.result('t1', 'TOKEN=abc')])
    const a = s.now[0]
    expect(a.text).toBe('Build the app')
    expect(a.command).toBe('make secret')
    expect(a.output).toBe('TOKEN=abc')
    expect(a.done).toBe(true)
  })

  it('records files and memory notes touched in the turn', () => {
    const s = build([
      F.human('go'),
      F.assistant([
        F.tool('r1', 'Read', { file_path: '/work/demo/a.js' }),
        F.tool('w1', 'Edit', { file_path: '/work/demo/a.js' }),
        F.tool('m1', 'Read', { file_path: '/home/u/.claude/projects/-work-demo/memory/user-role.md' }),
      ]),
    ])
    expect(s.touched.files).toEqual([['/work/demo/a.js', 'write']])
    expect(s.touched.notes).toEqual([['/home/u/.claude/projects/-work-demo/memory/user-role.md', 'read']])
  })

  it('follows the desktop app\'s task list through its whole-list, advance and done/start forms', () => {
    const plan = (input) => F.tool(`p${Math.random()}`, 'mcp__ccd_turn__update_plan', input)
    const s = build([
      F.human('go'),
      F.assistant([plan({ items: [{ content: 'A', status: 'in_progress' }, { content: 'B', status: 'pending' }, { content: 'C', status: 'pending' }] })]),
      F.assistant([plan({ advance: true })]),
      F.assistant([plan({ done: [2], start: 3 })]),
    ])
    expect(s.plan.source).toBe('app')
    expect(s.plan.items.map((i) => i.status)).toEqual(['completed', 'completed', 'in_progress'])
  })

  it('follows the command line\'s tasks, their ids read from the results', () => {
    const s = build([
      F.human('go'),
      F.assistant([F.tool('c1', 'TaskCreate', { subject: 'Write the reader' })]),
      F.result('c1', 'Task #1 created successfully: Write the reader', { task: { id: '1', subject: 'Write the reader' } }),
      F.assistant([F.tool('c2', 'TaskCreate', { subject: 'Test it' })]),
      F.result('c2', 'Task #2 created successfully: Test it', { task: { id: '2', subject: 'Test it' } }),
      F.assistant([F.tool('u1', 'TaskUpdate', { taskId: '1', status: 'completed' })]),
      F.assistant([F.tool('u2', 'TaskUpdate', { taskId: '2', status: 'in_progress' })]),
    ])
    expect(s.plan.source).toBe('tasks')
    expect(s.plan.items).toEqual([
      { content: 'Write the reader', status: 'completed' },
      { content: 'Test it', status: 'in_progress' },
    ])
  })

  it('follows the older to-do list', () => {
    const s = build([F.human('go'), F.assistant([F.tool('d1', 'TodoWrite', { todos: [{ content: 'X', status: 'in_progress', activeForm: 'Doing X' }] })])])
    expect(s.plan).toMatchObject({ source: 'todo', items: [{ content: 'X', status: 'in_progress' }] })
  })

  it('shows background work as waiting until its notification arrives', () => {
    const start = [
      F.human('go'),
      F.assistant([F.tool('b1', 'Bash', { command: 'gh run watch', description: 'Watch the release build', run_in_background: true })]),
      F.result('b1', 'Command running in background with ID: bg42.', { backgroundTaskId: 'bg42' }),
    ]
    expect(build(start).waiting.map((w) => w.text)).toEqual(['Watch the release build'])
    expect(build([...start, F.notification('bg42', 'completed', 'done')]).waiting).toEqual([])
  })

  it('also ends background work by a notification queued mid-turn', () => {
    const s = build([
      F.human('go'),
      F.assistant([F.tool('b2', 'Bash', { command: 'sleep 9', description: 'Wait', run_in_background: true })]),
      F.result('b2', 'Command running in background with ID: bg7.', { backgroundTaskId: 'bg7' }),
      F.attachment({ type: 'queued_command', commandMode: 'task-notification', origin: { kind: 'task-notification' }, prompt: '<task-notification>\n<task-id>bg7</task-id>\n<status>completed</status>\n<summary>Waited</summary>\n</task-notification>' }),
    ])
    expect(s.waiting).toEqual([])
    expect(s.turns[0].items.at(-1)).toMatchObject({ type: 'notification', text: 'Waited', status: 'completed' })
  })

  it('checks off the app\'s task list at wrap-up', () => {
    const s = build([
      F.human('do three things'),
      F.assistant([F.tool('p', 'mcp__ccd_turn__update_plan', { items: [{ content: 'One', status: 'completed' }, { content: 'Two', status: 'in_progress' }, { content: 'Three', status: 'pending' }] })]),
      F.assistant([F.tool('w', 'mcp__ccd_turn__wrap_up', { recap: 'Done.' })]),
    ])
    expect(s.plan.items.map((i) => i.status)).toEqual(['completed', 'completed', 'completed'])
  })

  it('keeps the wrap-up recap and question, and the person\'s mid-turn messages', () => {
    const s = build([
      F.human('go'),
      F.assistant([F.tool('w', 'mcp__ccd_turn__wrap_up', { recap: 'All merged.', ask: 'Release it?' })]),
      F.attachment({ type: 'queued_command', prompt: 'also this', origin: { kind: 'human' } }),
    ])
    const t = s.turns[0]
    expect(t.recap).toBe('All merged.')
    expect(t.ask).toBe('Release it?')
    expect(t.items.at(-1)).toMatchObject({ type: 'mid-turn', text: 'also this' })
  })

  it('reads the session\'s facts', () => {
    const s = build([F.human('go'), F.assistant([F.text('ok')]), F.attachment({ type: 'total_tokens_reminder', text: '<total_tokens>14,500,000 tokens left</total_tokens>' }), F.prLink(7)])
    expect(s.facts).toMatchObject({ cwd: '/work/demo', branch: 'develop', model: 'claude-opus-5-5', effort: 'high', budgetLeft: 14500000 })
    expect(s.facts.prs[0].number).toBe(7)
  })

  it('counts unknown kinds and notices a version newer than any checked', () => {
    const s = build([F.unknown('brand-new-kind'), F.unknown('brand-new-kind'), F.human('go', { version: '2.9.0' })])
    expect(s.drift.unknown).toEqual([['brand-new-kind', 2]])
    expect(s.drift.newerThanChecked).toBe(true)
  })
})

describe('helpers', () => {
  it('knows a memory note by its path', () => {
    expect(isMemoryPath('/u/.claude/projects/-x/memory/a.md')).toBe(true)
    expect(isMemoryPath('/u/.claude/projects/-x/a.jsonl')).toBe(false)
  })
  it('orders versions', () => {
    expect(compareVersions('2.1.299', '2.1.30')).toBeGreaterThan(0)
  })
})
