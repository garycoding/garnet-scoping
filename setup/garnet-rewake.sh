#!/bin/bash
# SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# garnet-scoping watcher, run by Claude Code as an asyncRewake hook (at the
# end of every turn, and when a session is resumed): it waits for a new
# signal from garnet-scoping and then exits with code 2, which wakes the
# session, idle or not, with this script's stderr as a system reminder. One watcher
# runs per session at a time; a hook that finds one running exits at once.
# The Claude desktop app does not count a hook as work, so a waiting watcher
# raises no "Claude is still working" warning on quit, as a background
# command would.
#
# Never at a new session's start: there Claude Code waits for a SessionStart
# hook to finish before the session answers, asyncRewake or not, so a
# watcher would hold the session until a signal arrived (the Claude desktop
# app gives up after some minutes and reports that Claude Code stopped
# responding). A new session is watched from the end of its first turn.
input=$(cat)
if printf '%s' "$input" | grep -qE '"hook_event_name" *: *"SessionStart"' &&
   printf '%s' "$input" | grep -qE '"source" *: *"startup"'; then exit 0; fi
id="${CLAUDE_CODE_SESSION_ID:-$(printf '%s' "$input" | sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p')}"
[ -n "$id" ] || exit 0
dir="$HOME/.garnet-scoping/boards"
mkdir -p "$dir"
pidfile="$dir/$id.watcher.pid"
if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then exit 0; fi
echo $$ > "$pidfile"
trap 'rm -f "$pidfile"' EXIT
out=$(bash "$HOME/.claude/hooks/garnet-watch.sh" "$id")
{
  echo "garnet-scoping: the person signalled this session."
  echo "$out"
  echo "Handle it as the section \"garnet-scoping signals\" in ~/.claude/CLAUDE.md says. The watcher restarts by itself at the end of your turn; do not start one."
} >&2
exit 2
