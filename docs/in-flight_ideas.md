# In-flight ideas

*Candidates under consideration for garnet-scoping. Each is a question, not a commitment: to research, weigh against the requirements, and either promote to a plan or drop. Nothing here is acted on silently.*

## The person's view, attached to each message

The Desk lets the person see the agent's state; this is the other direction: the agent sees what the person was looking at and doing when they wrote a message. A small helper with the system's accessibility permission reads, for the frontmost window, the app and window title, the selected text, the element under the pointer with its text and role, and the last minute of interaction (windows focused, things clicked, text selected), and condenses it to a short text block. Claude Code's hook that runs when the person submits a message attaches that block to the message, so the agent receives it with no action by the person and no tool call of its own. It works across every app, not only the one being built, and replaces the lossiest step in the exchange: the agent recovering from a screenshot what the person meant, when the thing pointed at has text. Pixels remain the medium for what is visual.

Open questions: what is captured and what is never captured (password fields, other people's messages); how the person sees and switches off what is sent; how long the interaction window is; whether a gesture (a key held while pointing) marks the thing meant, rather than everything being sent.

Raised 2026-10-19.

## A shared whiteboard

Engineers think together at a whiteboard. A simple one would serve here: a board window in garnet-scoping, opened from a session's Desk, where the person and the agent each drop shapes onto the board, put text in them, and join them with lines and arrows. No freehand drawing, so that everything on the board is something the agent can read exactly.

The board is an Excalidraw file: JSON (the format and its editor are MIT), in which each shape carries its text and each arrow records the two shapes it joins. The person edits it in the board window, the editor embedded; the agent reads and writes the same file with ordinary file tools, and its shapes and arrows appear on the board as the file changes. The session alternates, as a whiteboard session largely does: one holds the marker, then the other.

Open questions: where a board's file lives (in the session's working folder, beside the work it is about, or in a notes vault when it should outlast the session); how the board's changes reach the agent (the agent reads the file when asked, or the message hook above attaches the changes since the agent's last turn to each message); garnet-scoping then writes files (the board), where the requirements describe an app that only reads; JSON Canvas (also an open format) as a lighter alternative, at the cost of an editor of its own.

Raised 2026-10-19.

## A glossary per project

Shared context depends on a word meaning one thing to both parties. A glossary note per project, one term per entry with its meaning and the term it replaces, read at the start of each session, makes that durable: the person corrects a word once, and the correction holds in every later session, rather than living in one agent's private memory. The Desk could show the glossary beside the Memory pane, and mark a term the agent used against its glossary meaning.

Open questions: where the glossary lives (in the project's repository, in the agent's memory store, or both, one derived from the other); how a new term is proposed and ruled; whether the check against glossary meanings belongs in the Desk or in the agent's own instructions.

Raised 2026-10-19.

## Knowing when a Claude Code release breaks garnet-scoping

garnet-scoping reads files that Claude Code writes for itself, not a published interface, and a new release may change them. The loud breaks are already caught: the reader counts record kinds it does not recognise, and the Desk says when a session runs a version newer than the newest the app was checked against. The dangerous breaks are the quiet ones, where everything still parses but means less: a renamed task-list tool leaves Plan empty; a moved field stops background tasks being matched to their completions, so Waiting fills with finished work; a changed notice format drops notices from the Trail. Outside the transcript the app also depends on `CLAUDE_CODE_SESSION_ID`, the SessionStart hook's output, and the channel protocol. Four measures, in the order they would be built:

1. **A conformance check on real transcripts.** A script, run locally and never committed, reads every transcript on the machine and reports, per Claude Code version, what the reader found: plan updates, wrap-ups, background tasks started and finished, actions with and without results, mid-turn messages, notices, unknown kinds and unknown tool names. A new version whose counts fall to zero where earlier versions had many is a quiet break, found on the day the version first appears. When a version passes, it becomes the new "checked against" version.
2. **A weekly watch of the changelog.** A scheduled task reads new Claude Code changelog entries and flags those that touch what garnet-scoping depends on: the transcript and its record kinds, the task-list and wrap-up tools, background tasks and their notices, memory, hooks, `CLAUDE_CODE_SESSION_ID`, MCP and channels. An early warning, before the break reaches a session.
3. **A health line in the app.** When a session runs a version newer than the checked one, the Desk runs the conformance checks on that session and says specifically what looks wrong ("the task-list tool is used, but no plan was read"), rather than only "newer than checked".
4. **Investigation of everything Claude Code writes.** Periodically, and after any release that changes what Claude Code stores, look through every file it writes (under `~/.claude`: transcripts and subagent transcripts, memory, task output, plans, scheduled tasks, settings and the rest; and the desktop app's own stores) to see what is new, what has changed, and what could serve garnet-scoping's intents. This is how the first design was found: a survey of every transcript on the machine showed what the Desk could be built from. Repeated, it finds both breaks the other measures miss and new material, such as a record of what the agent is waiting on from the person, which would make a new part of the Desk possible.

Open questions: whether the conformance check runs on demand, weekly by scheduled task, or inside the app at each new version; what thresholds mark a fall as a break rather than a quiet week; how the investigation's findings are kept (a dated note per survey, in this repository without private content, or in the person's notes); which of the four to build first.

Raised 2026-10-20.

## Quote: selecting text on the Desk to send it to the agent

Messaging apps let one highlight part of an earlier message and quote it in a new one, so the reply refers to exactly those words. The Desk could do the same: the person selects any passage of text on the Desk (part of the agent's message in Last word or the Trail, a few words of a plan step, a line of a command's output in the details view, a sentence of a memory note) and a small "Quote" control appears beside the selection. It sends the agent the exact words selected, where they came from (which message, which action, which note), and an optional note from the person, by the same route as a Discuss flag: the state file, the watcher or the channel, and the agent's answer recorded with its request. A whole-row flag stays for when the whole item is the subject; Quote is for when only part of it is.

It is a finer form of signalling intent at the point of reading (northstar draft, intent 2): the reference is made exact by the selection itself, with no description of what is meant.

Open questions: how a quote is shown on the Desk once sent (a flag on its row with the quoted words, or a mark on the words themselves); whether a quote must carry a note, since quoted words without a question say less than a flag; how a quote of text that later changes (a Last word replaced by a newer message) keeps pointing at what was quoted; whether quotes from the board's text belong here too.

Raised 2026-10-20.
