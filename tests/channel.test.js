// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { signalEvents } from '../channel/signals.mjs'

describe('the channel’s signals', () => {
  it('reports each signal once, when it appears', () => {
    const open = { id: 'd1', panel: 'now', key: 'action:toolu_1', text: 'Run the tests', note: 'why so slow?', status: 'open' }
    const a = signalEvents(null, { review: true, discuss: [open], hold: 'requested' })
    expect(a.map((e) => e.meta.signal)).toEqual(['review', 'discuss', 'hold'])
    expect(a[1].content).toContain('why so slow?')
    expect(a[1].content).toContain('toolu_1')
    expect(a[1].meta).toMatchObject({ id: 'd1', panel: 'now' })
    // Nothing new: nothing reported.
    expect(signalEvents({ review: true, discuss: [open], hold: 'requested' }, { review: true, discuss: [open], hold: 'holding' })).toEqual([])
    // A release is reported; an answered mark is not.
    const b = signalEvents({ hold: 'holding', discuss: [open] }, { hold: 'off', discuss: [{ ...open, status: 'answered' }] })
    expect(b.map((e) => e.meta.signal)).toEqual(['release'])
  })

  it('gives every meta value as a string, which Claude Code requires', () => {
    const open = { id: 7, panel: 'now', text: 'x', status: 'open', at: 1792543000000 }
    const evs = signalEvents(null, { review: true, reviewAt: 1792543000000, discuss: [open], hold: 'requested', holdAt: 1792543000001 })
    for (const e of evs) for (const v of Object.values(e.meta)) expect(typeof v).toBe('string')
    expect(evs[0].meta.at).toBe('1792543000000')
  })
})

describe('the channel server', () => {
  it('answers the handshake and pushes a Review press into the session', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'garnet-channel-'))
    const child = spawn(process.execPath, ['channel/garnet-channel.mjs'], { env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'sess1', GARNET_SCOPING_BOARDS: dir } })
    const lines = []
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        lines.push(JSON.parse(buf.slice(0, nl)))
        buf = buf.slice(nl + 1)
      }
    })
    const until = async (cond) => {
      for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 25))
      if (!cond()) throw new Error('timed out')
    }
    const send = (m) => child.stdin.write(JSON.stringify(m) + '\n')
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })
    await until(() => lines.length > 0)
    expect(lines[0].result.capabilities.experimental).toEqual({ 'claude/channel': {} })
    expect(lines[0].result.protocolVersion).toBe('2025-06-18')
    expect(lines[0].result.instructions).toContain('sess1.board.md')
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    await until(() => lines.length > 1)
    expect(lines[1].error.code).toBe(-32601)
    await writeFile(join(dir, 'sess1.state.json'), JSON.stringify({ review: true, reviewAt: '2026-10-20T05:00:00Z', discuss: [], hold: 'off' }))
    await until(() => lines.some((l) => l.method === 'notifications/claude/channel'))
    const ev = lines.find((l) => l.method === 'notifications/claude/channel')
    expect(ev.params.meta).toEqual({ signal: 'review', at: '2026-10-20T05:00:00Z' })
    child.kill()
    await rm(dir, { recursive: true, force: true })
  })
})
