# garnet-scoping

<img src="build/icon.png" alt="The garnet-scoping icon" width="128" align="right">

A macOS desktop app that shows what a Claude Code session is doing, for the person working with it, and gives the person and the agent a board on which to draw together.

It reads each session's transcript, the file Claude Code writes as the session runs, and lists the sessions on the machine, the most recent first. Opening one shows its window:

- **Desk:** the agent's plan and the step it is on, what it is doing now, what it is waiting on, the files it has read and changed, the project's memory notes, its last word and any question it has not had answered, and beneath them the session's trail, turn by turn.
- **For you:** the files the agent has sent you in the session, newest first, with thumbnails for images. Click one to preview it in the app; right-click for Discuss and for opening it in its default app.
- **Board:** an Excalidraw whiteboard for that session. The person drops shapes onto it, writes in them and connects them with lines and arrows; the agent reads the board as text and changes it by writing a request file.

The app only reads what Claude Code writes: it never writes under `~/.claude`, and it makes no network connection. Each window follows its transcript as it grows, so the Desk is current whilst the session runs.

## Install

Download the `.dmg` from the [releases page](https://github.com/garycoding/garnet-scoping/releases) (Apple silicon), open it and drag garnet-scoping to Applications. The build is not signed, so macOS refuses the first launch; open it once with Control-click, Open, or run:

```bash
xattr -dr com.apple.quarantine /Applications/garnet-scoping.app
```

The app does not check for newer versions, since it makes no network connection; new releases appear on the releases page.

## The board, for the agent

Each session's board lives in `~/.garnet-scoping/boards/`, named by the session's id:

- `<id>.excalidraw` is the board itself, saved by the app.
- `<id>.board.md` is its rendition as text, rewritten on every change: each shape with its id, kind, text, position and size, and each connection as "A → B". It begins with the instructions below, so an agent given only this path has what it needs.
- `<id>.request.json` is written by the agent to change the board. The app applies it and deletes it.

When a conversation is resumed or forked under a new session id, the new session's board takes over the earlier one's drawing, by copy, the first time its window opens; the earlier board is left as it was.

Images dropped or pasted onto the board are kept in the board file and written, one file each, to `<id>.files/`; the rendition lists each image with the path of its file, so the agent can open it. The agent adds an image with `{ "kind": "image", "path": "/absolute/path.png" }` in a request (PNG, JPEG, GIF, WebP or SVG, up to 20 MB), optionally with a position and a width.

A request adds, relabels or removes elements; shapes need no position, and connections name their ends by id:

```json
{
  "add": [
    { "id": "api", "kind": "rectangle", "text": "API" },
    { "id": "store", "kind": "ellipse", "text": "Store" },
    { "kind": "arrow", "from": "api", "to": "store", "text": "writes" }
  ],
  "relabel": [{ "id": "api", "text": "Public API" }],
  "remove": ["old-shape-id"]
}
```

The board's header carries the rendition's path and a button that copies an instruction naming it, to paste into the session. A request written whilst the board is not shown waits, and the Board toggle is marked until it is applied.

Two controls in the header carry the person's signals, and the rendition states both in its first lines:

- **Editing** is checked by any change the person makes, and unchecked by the person when done (`Editing: yes` or `no`).
- **Review** is turned on by the person to ask the agent to read the board now (`Review: requested at …`); turning it on also unchecks Editing. The agent turns it off by including `"reviewed": true` in a request, alone or with changes; a bare `{"reviewed": true}` applies even while the board is not shown.

## Discussing a row, for the agent

Any row of Plan, Now, Trail, Memory or For you can be marked to discuss: the right-click menu marks it with or without a note, and a double-click marks it too. A marked row shows a Discuss badge at its right-hand end, filled while it is a request; clicking the badge turns the request off or on again. The header's Discuss button counts the open requests and lists them all, as does the Discuss panel; choosing one shows the item where it is, highlighted for two seconds. Each mark goes into `<id>.state.json` beside the board, under `"discuss"`, with the row's panel, its text, the note, its status (`open`, `off` or `answered`), and, for an action, its id in the key (`action:<id>`). The rendition's third line counts the open marks. The agent answers in the conversation, then records a one-line answer, shown on the Desk, with a request:

```json
{ "discussed": [{ "id": "<mark id>", "answer": "A flaky watcher; fixed in the next release." }] }
```

## Hold, for the agent

The Hold button on a session's window asks the agent to stop after its current step. The state file's `"hold"` reads `"requested"`, and the rendition's Hold line says so. The agent finishes the step it is in, starts no other, and confirms with `{"holding": true}`; the button then shows "Holding". The person releases the hold with the same button, and `"hold"` returns to `"off"`. Nothing running is cancelled.

## Signals reaching the agent

Review, Discuss and Hold are written to the session's state file. For the agent to notice them without a message from the person, open **Set-up Info** in the app's menu:

- **The watcher (any session).** The first block is a prompt to paste into Claude Code once. Claude installs a watcher script, a SessionStart hook that tells every new session to run it in the background, and a section of rules in `~/.claude/CLAUDE.md`. The watcher exits when a signal appears, which reaches the agent as a notice, mid-task or while idle.
- **The channel (terminal sessions).** garnet-scoping ships a channel server, an MCP server that pushes each signal into the session the moment it appears. Claude Code supports channels as a research preview, in terminal sessions only; the desktop app does not load them yet. The second block is the command that starts a terminal session with it. The server runs with the app's own binary, needs no separate Node install, and opens no network connection.

## Limits

The transcript is Claude Code's internal format, not a published interface, and a new version of Claude Code may change it. This release was checked against Claude Code 2.1.170 to 2.1.299; the Desk says when a session's version is newer than that, and counts any record it does not recognise, so that a change shows rather than passing silently. Subagents' own transcripts are not shown.

## Documents

The requirements are in [`docs/requirements.md`](docs/requirements.md) and the design in [`docs/design.md`](docs/design.md). Ideas not yet decided are in [`docs/in-flight_ideas.md`](docs/in-flight_ideas.md).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md). The app is licensed under AGPL-3.0-or-later; see [`LICENSING.md`](LICENSING.md). The name garnet-scoping and its icon identify this project and are not covered by that licence: a modified version must use another name and icon.

---
<sub>© 2026 Gary Frattarola · Licensed under [CC-BY-4.0](LICENSES/CC-BY-4.0.txt)</sub>
