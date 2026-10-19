// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Synthetic transcript records, one builder per record shape the reader
// knows. Nothing here is copied from a real transcript.

let n = 0
const at = () => new Date(Date.UTC(2026, 9, 19, 9, 0, n++)).toISOString()
const base = (extra = {}) => ({ sessionId: 's1', cwd: '/work/demo', gitBranch: 'develop', version: '2.1.299', entrypoint: 'claude-desktop', timestamp: at(), ...extra })

export const human = (text, extra = {}) => ({ ...base(), type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text }, ...extra })
export const oldHuman = (text) => ({ ...base({ version: '2.1.120' }), type: 'user', message: { role: 'user', content: text } })
export const injected = (text) => ({ ...base(), type: 'user', message: { role: 'user', content: text } })
export const meta = (text) => ({ ...base(), type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text }] } })
export const assistant = (parts, extra = {}) => ({ ...base(), type: 'assistant', message: { model: 'claude-opus-5-5', content: parts }, effort: 'high', ...extra })
export const text = (t) => ({ type: 'text', text: t })
export const thinking = (t = '') => ({ type: 'thinking', thinking: t, signature: 'x' })
export const tool = (id, name, input) => ({ type: 'tool_use', id, name, input })
export const result = (id, content, toolUseResult = null, isError = false) => ({
  ...base(),
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] },
  ...(toolUseResult ? { toolUseResult } : {}),
})
export const notification = (taskId, status, summary) => ({
  ...base(),
  type: 'user',
  origin: { kind: 'task-notification' },
  message: { role: 'user', content: `<task-notification>\n<task-id>${taskId}</task-id>\n<status>${status}</status>\n<summary>${summary}</summary>\n</task-notification>` },
})
export const attachment = (a) => ({ ...base(), type: 'attachment', attachment: a })
export const titled = (title) => ({ type: 'custom-title', customTitle: title, sessionId: 's1' })
export const aiTitled = (title) => ({ type: 'ai-title', aiTitle: title, sessionId: 's1' })
export const prLink = (number) => ({ type: 'pr-link', prNumber: number, prUrl: `https://github.com/acme/demo/pull/${number}`, prRepository: 'acme/demo', sessionId: 's1', timestamp: at() })
export const unknown = (type) => ({ type, sessionId: 's1' })
