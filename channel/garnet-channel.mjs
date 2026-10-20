// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// garnet-scoping's channel (research preview in Claude Code): an MCP server
// that Claude Code starts beside a terminal session, over stdio. It follows
// the session's state file and pushes the person's signals (Review, Discuss,
// Hold) into the session the moment they appear, so the agent needs no
// watcher. It uses Node's standard library only and opens no network
// connection. Run it with Node, or with the app's own binary and
// ELECTRON_RUN_AS_NODE=1.

import { readFileSync, watch } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { signalEvents } from './signals.mjs'

const id = process.env.CLAUDE_CODE_SESSION_ID
const dir = process.env.GARNET_SCOPING_BOARDS || join(homedir(), '.garnet-scoping', 'boards')
const statePath = id ? join(dir, `${id}.state.json`) : ''
const rendition = id ? join(dir, `${id}.board.md`) : ''
const request = id ? join(dir, `${id}.request.json`) : ''
// Protocol revisions this server speaks; Claude Code does not register a
// channel that negotiates a newer one.
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const INSTRUCTIONS = `garnet-scoping channel. Messages arrive as <channel source="garnet" signal="review|discuss|hold|release" ...> when the person signals this session from garnet-scoping: Review (read the board at ${rendition}), Discuss (a row of the Desk, with an optional note), Hold (finish the current step, start no other, wait) and its release. Answer each as its message says, sending requests to ${request}. While this channel is connected, the garnet-watch watcher is not needed. Handle a signal before the next step of the plan in hand.`

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')

function readState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return null
  }
}

let last = null
let started = false
function check() {
  const next = readState()
  for (const ev of signalEvents(last, next, { rendition, statePath })) {
    send({ jsonrpc: '2.0', method: 'notifications/claude/channel', params: ev })
  }
  if (next) last = next
}

function start() {
  if (started || !id) return
  started = true
  check()
  try {
    watch(dir, (_e, name) => name && name.startsWith(id) && check())
  } catch {}
  // File events can be missed; the state file is also read once a second.
  setInterval(check, 1000).unref?.()
}

function handle(msg) {
  if (msg.method === 'initialize') {
    const asked = msg.params?.protocolVersion
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { experimental: { 'claude/channel': {} } },
        serverInfo: { name: 'garnet', version: '1' },
        instructions: id ? INSTRUCTIONS : 'garnet-scoping channel: no session id (CLAUDE_CODE_SESSION_ID) was given, so no signals will arrive.',
      },
    })
  } else if (msg.method === 'notifications/initialized') {
    start()
  } else if (msg.method === 'ping') {
    send({ jsonrpc: '2.0', id: msg.id, result: {} })
  } else if (msg.id !== undefined) {
    send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } })
  }
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    try {
      handle(JSON.parse(line))
    } catch {}
  }
})
process.stdin.on('end', () => process.exit(0))
