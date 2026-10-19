// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Reads a transcript incrementally (R5.3): from a byte offset to the end of the
// file, returning only whole lines. A final line without its newline is still
// being written, so it is held back and read again next time.

import { open, stat } from 'node:fs/promises'

const CHUNK = 1 << 20

// Returns { records, offset, bad }: the parsed records from `offset` on, the
// offset to read from next, and the number of lines that would not parse.
export async function readFrom(file, offset = 0) {
  const { size } = await stat(file)
  if (size < offset) offset = 0 // the file was replaced or truncated
  if (size === offset) return { records: [], offset, bad: 0 }
  const fh = await open(file, 'r')
  const chunks = []
  try {
    let pos = offset
    while (pos < size) {
      const buf = Buffer.alloc(Math.min(CHUNK, size - pos))
      const { bytesRead } = await fh.read(buf, 0, buf.length, pos)
      if (!bytesRead) break
      chunks.push(buf.subarray(0, bytesRead))
      pos += bytesRead
    }
  } finally {
    await fh.close()
  }
  const data = Buffer.concat(chunks)
  const end = data.lastIndexOf(0x0a)
  if (end < 0) return { records: [], offset, bad: 0 }
  const records = []
  let bad = 0
  for (const line of data.subarray(0, end).toString('utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line))
    } catch {
      bad += 1
    }
  }
  return { records, offset: offset + end + 1, bad }
}

// The parsed whole lines within `bytes` at the start (or end) of a file, for
// the session list, which never reads whole files.
export async function readEdge(file, bytes, fromEnd) {
  const { size } = await stat(file)
  const length = Math.min(bytes, size)
  const start = fromEnd ? size - length : 0
  const fh = await open(file, 'r')
  let text
  try {
    const buf = Buffer.alloc(length)
    const { bytesRead } = await fh.read(buf, 0, length, start)
    text = buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
  const lines = text.split('\n')
  if (fromEnd && start > 0) lines.shift() // the first line is cut
  if (!fromEnd) lines.pop() // the last line may be cut
  const records = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line))
    } catch {}
  }
  return records
}
