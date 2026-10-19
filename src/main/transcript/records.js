// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The one place that knows Claude Code's transcript format (R6.1). classify()
// turns one parsed line into a record of a kind the app uses, or into
// { kind: 'unknown' } for a type it does not know; nothing here throws on an
// unfamiliar record. The format is Claude Code's own and undocumented; what is
// known of it is recorded in docs/design.md.

// Record types seen and deliberately not used (titles and links are used below).
const IGNORED_TYPES = new Set([
  'last-prompt',
  'queue-operation',
  'mode',
  'atis-latch',
  'file-history-snapshot',
  'file-history-delta',
  'bridge-session',
  'permission-mode',
  'agent-setting',
  'cost-state',
  'api-request',
  'api-request-blob',
  'api-request-shape',
  'frame-link',
  'summary',
])

// Attachment kinds that hold the session's setup rather than its work; never
// shown (R5.5).
const HIDDEN_ATTACHMENTS = new Set(['session_context', 'prompt_snapshot', 'instructions', 'output_style_instructions'])

// The openings of user-role messages that Claude Code or a hook injects, for
// transcripts older than the origin field (before about 2.1.18).
const SYSTEM_OPENINGS = [
  '<',
  'Stop hook feedback',
  'This session is being continued',
  'Another Claude session',
  '[Cross-session',
  'Base directory for this skill',
  'Continue from where',
  'Caveat:',
]

const textOf = (content) => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}

const imagesIn = (content) => (Array.isArray(content) ? content.filter((b) => b && b.type === 'image').length : 0)

// A tool result's text, whatever its shape (a string or a list of blocks).
export function resultText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n')
  return ''
}

// The fields of a task notification: <task-id>, <status>, <summary>.
export function parseNotification(text) {
  const tag = (name) => {
    const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)
    return m ? m[1].trim() : null
  }
  return { taskId: tag('task-id'), status: tag('status'), summary: tag('summary') }
}

const common = (r) => ({
  at: r.timestamp ?? null,
  cwd: r.cwd ?? null,
  branch: r.gitBranch ?? null,
  version: r.version ?? null,
  entrypoint: r.entrypoint ?? null,
})

function classifyUser(r) {
  const content = r.message?.content
  if (Array.isArray(content) && content.some((b) => b && b.type === 'tool_result')) {
    const results = content
      .filter((b) => b && b.type === 'tool_result')
      .map((b) => ({ id: b.tool_use_id, isError: Boolean(b.is_error), text: resultText(b.content) }))
    return { kind: 'tool-results', results, meta: r.toolUseResult ?? null }
  }
  const text = textOf(content)
  const images = imagesIn(content)
  const origin = r.origin?.kind
  if (origin === 'task-notification' || text.startsWith('<task-notification')) {
    return { kind: 'notification', ...parseNotification(text) }
  }
  if (text.startsWith('[Request interrupted')) return { kind: 'interrupt' }
  if (r.isMeta) return { kind: 'system' }
  if (origin === 'human') return { kind: 'human', text, images, inferred: false }
  if (origin) return { kind: 'system' }
  if (SYSTEM_OPENINGS.some((o) => text.startsWith(o))) return { kind: 'system' }
  // No origin field (an older transcript), and nothing marks it as injected.
  return { kind: 'human', text, images, inferred: true }
}

function classifyAssistant(r) {
  const blocks = Array.isArray(r.message?.content) ? r.message.content : []
  const parts = []
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue
    if (b.type === 'text' && b.text) parts.push({ type: 'text', text: b.text })
    else if (b.type === 'thinking') parts.push({ type: 'thinking', text: b.thinking ?? '' })
    else if (b.type === 'tool_use') parts.push({ type: 'tool', id: b.id, name: b.name, input: b.input ?? {} })
  }
  return { kind: 'assistant', model: r.message?.model ?? null, effort: r.effort ?? null, parts }
}

function classifyAttachment(r) {
  const a = r.attachment ?? {}
  if (HIDDEN_ATTACHMENTS.has(a.type)) return { kind: 'hidden' }
  if (a.type === 'queued_command' && typeof a.prompt === 'string') {
    // A message queued while the agent works: the person's, or a task
    // notification that arrived mid-turn.
    if (a.origin?.kind === 'task-notification' || a.prompt.startsWith('<task-notification')) {
      return { kind: 'notification', ...parseNotification(a.prompt) }
    }
    if (a.origin?.kind === 'human') return { kind: 'mid-turn', text: a.prompt }
  }
  if (a.type === 'total_tokens_reminder' && typeof a.text === 'string') {
    const m = /([\d,]+)\s+tokens left/.exec(a.text)
    return m ? { kind: 'budget', left: Number(m[1].replace(/,/g, '')) } : { kind: 'attachment' }
  }
  if (a.type === 'model' && a.model) return { kind: 'model', model: a.model }
  return { kind: 'attachment', type: a.type ?? null }
}

export function classify(r) {
  if (!r || typeof r !== 'object') return { kind: 'unknown', type: null }
  let rec
  switch (r.type) {
    case 'user':
      rec = classifyUser(r)
      break
    case 'assistant':
      rec = classifyAssistant(r)
      break
    case 'attachment':
      rec = classifyAttachment(r)
      break
    case 'custom-title':
      rec = { kind: 'title', title: r.customTitle, source: 'custom' }
      break
    case 'agent-name':
      rec = { kind: 'title', title: r.agentName, source: 'agent' }
      break
    case 'ai-title':
      rec = { kind: 'title', title: r.aiTitle, source: 'ai' }
      break
    case 'pr-link':
      rec = { kind: 'pr', number: r.prNumber, url: r.prUrl, repo: r.prRepository }
      break
    case 'system':
      rec = { kind: 'system' }
      break
    default:
      rec = IGNORED_TYPES.has(r.type) ? { kind: 'ignored' } : { kind: 'unknown', type: String(r.type) }
  }
  return { ...common(r), sidechain: Boolean(r.isSidechain), ...rec }
}
