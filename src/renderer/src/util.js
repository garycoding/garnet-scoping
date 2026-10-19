// SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
// SPDX-License-Identifier: AGPL-3.0-or-later

// "3 min ago", "2 h ago", "4 days ago"; a time or a millisecond count.
export function ago(when) {
  const t = typeof when === 'number' ? when : Date.parse(when)
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

// "14:05" for today, "Oct 18 14:05" otherwise.
export function clock(when) {
  const d = new Date(when)
  if (Number.isNaN(d.getTime())) return ''
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? hm : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${hm}`
}

// A duration since a time: "4 s", "3 min", "1 h 5 min".
export function since(when) {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(when)) / 1000))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min`
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
}

export const shortPath = (p, home) => (home && p.startsWith(home) ? '~' + p.slice(home.length) : p)
