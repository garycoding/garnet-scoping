#!/bin/bash
# SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# garnet-scoping watcher: waits until the person signals this session from
# garnet-scoping (Review on the board, a row marked to discuss, or Hold),
# prints what it saw, and exits. Run it in the background; restart it after
# handling each signal. The session's id comes from CLAUDE_CODE_SESSION_ID,
# which Claude Code sets in every Bash command.
id="${1:-$CLAUDE_CODE_SESSION_ID}"
[ -n "$id" ] || { echo "garnet-watch: no session id"; exit 2; }
state="$HOME/.garnet-scoping/boards/$id.state.json"
date -u +"garnet-watch started %H:%M:%SZ for $id"
until grep -qE '"review": true|"status": "open"|"hold": "requested"' "$state" 2>/dev/null; do sleep 1; done
date -u +"garnet-scoping signal seen at %H:%M:%SZ"
grep -E '"review"|"hold"|"status": "open"|"text"|"note"' "$state" | head -40
echo "Rendition: $HOME/.garnet-scoping/boards/$id.board.md"
