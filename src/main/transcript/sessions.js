// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The session list (R1.1): every transcript under the projects folder, each
// described from its size, its modification time and a few lines at its ends,
// never from the whole file (R5.3).

import { readdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { readEdge } from './reader.js'
import { classify } from './records.js'

const EDGE = 64 * 1024
const RECENT_MS = 10 * 60 * 1000

// Describes one transcript.
export async function describeSession(file, now = Date.now()) {
  const st = await stat(file)
  const head = await readEdge(file, EDGE, false)
  const tail = st.size > EDGE ? await readEdge(file, EDGE, true) : head
  const info = { id: basename(file, '.jsonl'), file, size: st.size, modified: st.mtimeMs, cwd: null, branch: null, version: null, title: null, firstMessage: null, lastAt: null }
  const rank = { custom: 3, agent: 2, ai: 1 }
  let titleRank = 0
  for (const raw of [...head, ...tail]) {
    const r = classify(raw)
    info.cwd ??= r.cwd
    if (r.version) info.version = r.version
    if (r.branch) info.branch = r.branch
    if (r.at && (!info.lastAt || r.at > info.lastAt)) info.lastAt = r.at
    if (r.kind === 'title' && r.title && rank[r.source] >= titleRank) {
      info.title = r.title.replace(/^\*\s*/, '')
      titleRank = rank[r.source]
    }
    if (r.kind === 'human' && !info.firstMessage && r.text) info.firstMessage = r.text.slice(0, 160)
  }
  info.recent = now - st.mtimeMs < RECENT_MS
  return info
}

// Every session under `projectsDir`, most recently written first.
export async function listSessions(projectsDir, now = Date.now()) {
  let dirs
  try {
    dirs = await readdir(projectsDir, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    let files
    try {
      files = await readdir(join(projectsDir, d.name))
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue
      try {
        const info = await describeSession(join(projectsDir, d.name, f), now)
        info.project = d.name
        out.push(info)
      } catch {}
    }
  }
  return out.sort((a, b) => b.modified - a.modified)
}
