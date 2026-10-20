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

# The signals standing in the state file, one per line: a key (the signal
# and the time it was given, so that a signal given again counts as new),
# a tab, and a description for the agent.
signals() {
  local out
  if [ -n "$app" ] && [ -x "$app" ] && out=$(ELECTRON_RUN_AS_NODE=1 "$app" -e '
      const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
      const out = []
      const where = { plan: "Plan", now: "Now", trail: "Trail", memory: "Memory", foryou: "For you" }
      const one = (t) => String(t ?? "").replace(/\s+/g, " ").slice(0, 300)
      if (s.review) out.push("review " + s.reviewAt + "\tReview: read the board now.")
      if (s.hold === "requested") out.push("hold " + s.holdAt + "\tHold: finish the step in progress, start no other, and wait.")
      for (const m of s.discuss || []) if (m.status === "open")
        out.push("discuss " + m.id + " " + m.at + "\tDiscuss (" + (where[m.panel] || m.panel) + ", id " + m.id + "): \"" + one(m.text) + "\"" + (m.note ? " Note: \"" + one(m.note) + "\"" : ""))
      console.log(out.join("\n"))' "$state" 2>/dev/null); then
    echo "$out"
  else
    # Without a working app binary, any standing signal counts.
    grep -qE '"review": true|"status": "open"|"hold": "requested"' "$state" 2>/dev/null && printf '%s\t%s\n' "$(date +%s)" "A signal is standing; read $state."
  fi
}

date -u +"garnet-watch started %H:%M:%SZ for $id"
last=""
while true; do
  m=$(mtime "$state")
  if [ -n "$m" ] && [ "$m" != "$last" ]; then
    last="$m"
    lines=$(signals)
    now=$(printf '%s\n' "$lines" | cut -f1 | grep -v '^$' | sort)
    new=$(comm -13 <(sort "$seen" 2>/dev/null) <(echo "$now") | grep -v '^$')
    if [ -n "$new" ]; then
      echo "$now" > "$seen"
      date -u +"New signal at %H:%M:%SZ:"
      # Only the new signals, described.
      printf '%s\n' "$lines" | grep -F -f <(echo "$new") | cut -f2- | sed 's/^/- /'
      echo "State: $state"
      echo "Rendition: $dir/$id.board.md"
      exit 0
    fi
    # Forget signals no longer standing, so that one given again is new.
    echo "$now" > "$seen"
  fi
  sleep 1
done
