#!/bin/bash
# SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# SessionStart hook: when garnet-scoping is installed, tells the session to
# start its watcher. Its output is added to the session's context.
[ -d /Applications/garnet-scoping.app ] || [ -d "$HOME/.garnet-scoping" ] || exit 0
cat <<MSG
garnet-scoping is installed. Unless a garnet-scoping channel is connected to this session (its instructions would be in your context), start the watcher now, in the background (run_in_background), and restart it after handling each signal:
  bash ~/.claude/hooks/garnet-watch.sh
It exits when the person presses Review on the board, marks a row of the Desk to discuss, or asks for a Hold; see the section "garnet-scoping signals" in ~/.claude/CLAUDE.md.
MSG
