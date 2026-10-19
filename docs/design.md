# garnet-scoping: design

How the first version meets [`requirements.md`](requirements.md). The requirements are the authority; this document records the choices made to meet them.

## Stack

An Electron app in plain JavaScript, built with electron-vite and packaged with electron-builder, as the handbook's `electron-tooling.md` describes and as the family's other Electron apps are built. Every dependency is bundled into the build, so the package carries no `node_modules`. The board is the one view that needs React, because the Excalidraw editor is a React component; the rest of the interface is plain DOM.

## Processes

- **Main** (`src/main/`): finds and reads the transcripts and memory stores, watches them, keeps the session models, owns the board files, and refuses every network request.
- **Preload** (`src/preload/`): a narrow bridge, `window.garnet`, with read calls and change events; the board's save and load are the only writes it exposes.
- **Renderer** (`src/renderer/`): two pages, the session list and the session window (Desk and board).

## Reading transcripts

`src/main/transcript/` is the one place that knows Claude Code's record format (R6.1).

- **`records.js`** classifies a parsed line into the kinds the app uses: a human message, a system-injected user message (a task notification, a command echo, hook feedback, a skill's body), an assistant message with its text, reasoning and tool calls, a tool result, an attachment, a title, a pull-request link, and the rest. A kind it does not know is counted, not fatal. A human message is recognised by `origin.kind` where the record has it (Claude Code 2.1.18 and later); in older transcripts by elimination, and then marked as inferred.
- **`reader.js`** reads a file from a byte offset to its end and returns whole lines, holding back a final line that has no newline yet, so that a transcript being written is read incrementally and never half a record at a time.
- **`session.js`** folds records into a session model: the turns (each the person's message, the agent's actions, the files and notes touched, the closing message), the plan, the background work started and finished, the session's facts, and the counts of unknown kinds. The model is built once on open and extended with each new batch of lines.

The plan is read from whichever tool the session used: the desktop app's task list (`update_plan`, with its whole-list, advance and done/start forms), or the command line's (`TaskCreate` and `TaskUpdate`, the created task's id read from the call's result; or the older `TodoWrite`).

Background work is a shell command or an agent started in the background, recorded with its id in the call's result, and finished by a task notification carrying the same id.

## The session list

Built from each transcript's size and modification time, the first lines (its working folder and branch) and the last 64 KB (its title, last activity and version), never from whole files (R5.3). One recursive watcher on the projects folder updates it.

## Reading safely

- Nothing under the Claude configuration directory is opened for writing (R5.1).
- A shell action is shown by its description; its command and output are shown only when the person opens that action (R5.2).
- `session_context` and `prompt_snapshot` attachments are never rendered (R5.5).
- `session.webRequest.onBeforeRequest` cancels every request whose scheme is not the app's own (R5.4), before any connection is made. Excalidraw's fonts are copied into the build and found through `EXCALIDRAW_ASSET_PATH`; Excalidraw also lists a CDN beside each bundled font, and those attempts are cancelled like any other (Chromium does not allow a web address to be redirected to a local file). Its file loading, export and image tools are switched off, and windows may not open others.

## The board

Each session's board is three files in `~/.garnet-scoping/boards/`, named by the session's id:

- `<id>.excalidraw`: the board itself, Excalidraw's JSON.
- `<id>.board.md`: the rendition the agent reads, rewritten on every save: each shape's id, kind, text and position, and each connection as `A → B`.
- `<id>.request.json`: written by the agent when it wants to change the board, and removed by the app once applied.

A request is compact:

```json
{
  "add": [
    { "id": "smalt", "kind": "rectangle", "text": "Smalt", "x": 0, "y": 0 },
    { "id": "flax", "kind": "ellipse", "text": "Flax", "x": 300, "y": 0 },
    { "kind": "arrow", "from": "smalt", "to": "flax", "text": "stores in" }
  ],
  "relabel": [{ "id": "smalt", "text": "Smalt API" }],
  "remove": ["old-shape-id"]
}
```

The app expands added shapes and arrows with Excalidraw's own skeleton conversion, so that text sits in its shape and arrows are bound to the shapes they join, then merges the result into the board. A change to the board file from outside the window is merged element by element, the higher `version` winning; the board is written whole to a temporary file and renamed into place.

## Versions checked

The app carries the list of Claude Code versions its reader was checked against, and the Desk says when a session's version is newer than any of them (R6.2). The first version was checked against 2.1.170 to 2.1.299.
