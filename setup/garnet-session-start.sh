#!/bin/bash
# SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# SessionStart hook: when garnet-scoping is installed, says how this
# session's signals reach it. The watcher itself is started by Claude Code
# (the garnet-rewake.sh hooks at the end of each turn and on resume).
[ -d /Applications/garnet-scoping.app ] || [ -d /opt/garnet-scoping ] || [ -d "$HOME/.garnet-scoping" ] || exit 0
cat <<MSG
garnet-scoping is installed. Its signals (Review, Discuss, Hold) reach this session by themselves: Claude Code runs the watcher as a hook and wakes the session when one arrives. Do not start a watcher yourself. Handle each signal as the section "garnet-scoping signals" in ~/.claude/CLAUDE.md says.
MSG
