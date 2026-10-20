#!/bin/bash
# SPDX-FileCopyrightText: 2026 Gary Frattarola <garyf@parkviewlab.ai>
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# garnet-scoping watcher: waits until the person gives this session a new
# signal from garnet-scoping (Review on the board, a row marked to discuss,
# or Hold), prints what it saw, and exits. Run it in the background; restart
# it after handling each signal. A signal already reported is not reported
# again, so an answer the app has not yet applied does not make it fire at
# once. The session's id comes from CLAUDE_CODE_SESSION_ID, which Claude Code
# sets in every Bash command.
id="${1:-$CLAUDE_CODE_SESSION_ID}"
[ -n "$id" ] || { echo "garnet-watch: no session id"; exit 2; }
dir="$HOME/.garnet-scoping/boards"
state="$dir/$id.state.json"
seen="$dir/$id.watched"
# The app's own binary, run in Node mode to read the state file: on macOS
# the bundle, on Ubuntu the package under /opt; GARNET_SCOPING_APP overrides
# (an AppImage, say).
app="${GARNET_SCOPING_APP:-}"
for c in /Applications/garnet-scoping.app/Contents/MacOS/garnet-scoping /opt/garnet-scoping/garnet-scoping; do
  [ -z "$app" ] && [ -x "$c" ] && app="$c"
done
# The modification time of a file: BSD stat on macOS, GNU stat on Linux.
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null; }

# The signals standing in the state file, one per line, each with the time it
# was given, so that a signal given again counts as new.
signals() {
  local out
  if [ -n "$app" ] && [ -x "$app" ] && out=$(ELECTRON_RUN_AS_NODE=1 "$app" -e '
      const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
      const out = []
      if (s.review) out.push("review " + s.reviewAt)
      if (s.hold === "requested") out.push("hold " + s.holdAt)
      for (const m of s.discuss || []) if (m.status === "open") out.push("discuss " + m.id + " " + m.at)
      console.log(out.join("\n"))' "$state" 2>/dev/null); then
    echo "$out"
  else
    # Without a working app binary, any standing signal counts.
    grep -qE '"review": true|"status": "open"|"hold": "requested"' "$state" 2>/dev/null && date +%s
  fi
}

date -u +"garnet-watch started %H:%M:%SZ for $id"
last=""
while true; do
  m=$(mtime "$state")
  if [ -n "$m" ] && [ "$m" != "$last" ]; then
    last="$m"
    now=$(signals | sort)
    new=$(comm -13 <(sort "$seen" 2>/dev/null) <(echo "$now") | grep -v '^$')
    if [ -n "$new" ]; then
      echo "$now" > "$seen"
      date -u +"garnet-scoping signal seen at %H:%M:%SZ"
      echo "New: $new"
      grep -E '"review"|"hold"|"status": "open"|"text"|"note"' "$state" | head -40
      echo "Rendition: $dir/$id.board.md"
      exit 0
    fi
    # Forget signals no longer standing, so that one given again is new.
    echo "$now" > "$seen"
  fi
  sleep 1
done
