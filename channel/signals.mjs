// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The person's signals, as the channel reports them: given the session's
// state file before and after a change, the events to push into the session.
// A signal is reported when it appears, never again while it stands.

const PANELS = { plan: 'Plan', now: 'Now', trail: 'Trail', memory: 'Memory' }

export function signalEvents(prev, next, { rendition = '', statePath = '' } = {}) {
  const before = prev ?? {}
  const after = next ?? {}
  const events = []
  if (after.review === true && before.review !== true) {
    events.push({
      content: `The person pressed Review on the board: read the board now, at ${rendition}. Answer on the board or in the conversation, then send {"reviewed": true} in a request.`,
      meta: { signal: 'review', at: after.reviewAt ?? '' },
    })
  }
  const seen = new Set((before.discuss ?? []).filter((m) => m.status === 'open').map((m) => m.id))
  for (const m of after.discuss ?? []) {
    if (m.status !== 'open' || seen.has(m.id)) continue
    const where = PANELS[m.panel] ?? m.panel
    events.push({
      content: `The person wants to discuss a row of ${where}: "${m.text}".${m.note ? ` Their note: "${m.note}".` : ''} Answer in the conversation, then send {"discussed": [{"id": "${m.id}", "answer": "one line"}]} in a request.${m.key?.startsWith('action:') ? ` The row is the action with tool-use id ${m.key.slice(7)}.` : ''}`,
      meta: { signal: 'discuss', id: m.id, panel: m.panel, at: m.at ?? '' },
    })
  }
  if (after.hold === 'requested' && before.hold !== 'requested') {
    events.push({
      content: `The person asked for a Hold: finish the step you are in, start no other, send {"holding": true} in a request, and wait until the hold is released ("hold": "off" in ${statePath}).`,
      meta: { signal: 'hold', at: after.holdAt ?? '' },
    })
  }
  if (before.hold && before.hold !== 'off' && after.hold === 'off') {
    events.push({ content: 'The person released the Hold: carry on with your work.', meta: { signal: 'release' } })
  }
  return events
}
