## garnet-scoping signals

garnet-scoping (the desktop app showing each Claude Code session's Desk and board) lets the person signal a session in three ways, all kept in `~/.garnet-scoping/boards/<session-id>.state.json` and summarised at the head of `<session-id>.board.md`:

- **Review** on the board: read the board now. Answer on the board or in the conversation, then send `{"reviewed": true}` to `<session-id>.request.json`.
- **Discuss** on a row of the Desk (with an optional note): answer about that row in the conversation, then send `{"discussed": [{"id": "…", "answer": "one line"}]}`.
- **Hold**: finish the step in progress, start no other, send `{"holding": true}`, and wait until the hold is released (`"hold": "off"`).
- **Images for the person:** when you make an image for the person (a design, a chart, a mock-up, a screenshot), also place it on the session's board with an image request (`{"add": [{"kind": "image", "path": "…"}]}`), near the shapes it concerns, so that it can be pointed at, marked and reviewed there. Give each draft its own file name, so that earlier drafts stay as they were.

Every session watches for these, so that a signal reaches the agent even when the person sends no message. A SessionStart hook prints the command; run `bash ~/.claude/hooks/garnet-watch.sh` in the background at the start of every session, and start it again after handling each signal. When a garnet-scoping channel is connected to the session (its instructions are in your context), the channel delivers the signals instead, and the watcher is not needed. Handle a signal when its notice arrives, before the next step of the plan in hand.
