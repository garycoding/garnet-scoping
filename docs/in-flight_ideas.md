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
