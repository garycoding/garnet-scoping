# In-flight ideas

*Candidates under consideration for garnet-scoping. Each is a question, not a commitment: to research, weigh against the requirements, and either promote to a plan or drop. Nothing here is acted on silently.*

## The person's view, attached to each message

The Desk lets the person see the agent's state; this is the other direction: the agent sees what the person was looking at and doing when they wrote a message. A small helper with the system's accessibility permission reads, for the frontmost window, the app and window title, the selected text, the element under the pointer with its text and role, and the last minute of interaction (windows focused, things clicked, text selected), and condenses it to a short text block. Claude Code's hook that runs when the person submits a message attaches that block to the message, so the agent receives it with no action by the person and no tool call of its own. It works across every app, not only the one being built, and replaces the lossiest step in the exchange: the agent recovering from a screenshot what the person meant, when the thing pointed at has text. Pixels remain the medium for what is visual.

Open questions: what is captured and what is never captured (password fields, other people's messages); how the person sees and switches off what is sent; how long the interaction window is; whether a gesture (a key held while pointing) marks the thing meant, rather than everything being sent.

Raised 2026-10-19.

## A shared whiteboard

Engineers think together at a whiteboard: one surface both mark, words and boxes and arrows in one arrangement, the marker passing between hands. Between a person and an agent the session alternates rather than overlaps, which a whiteboard session largely does anyway. The board must be text underneath, so that the agent reads and writes it exactly, and freehand on top, so that the person draws naturally: Excalidraw's file format (JSON, MIT) is both, with shapes carrying text, arrows bound to the shapes they join, and freehand strokes as point lists. The agent adds shapes, arrows and labels to the same file, which appear on the board as the file changes. On each message the board's changes since the agent's last turn reach it as words ("added Hermes top left, drew an arrow from Smalt to it, circled Flax and SQLite"), through the same message hook as above; strokes that enclose or join shapes are resolved into "circled" and "joined", and a real sketch goes to the agent as an image of its region. When a session ends well, the agent turns the board into the document it was for, and the board stays as the record of how it got there.

Open questions: where the board lives (in a Markdown notes client beside the notes it is about, which adds React to that client for one view, or as an app of its own); how freehand strokes are resolved reliably; whether voice joins the board as the room's talk does.

Raised 2026-10-19.

## A glossary per project

Shared context depends on a word meaning one thing to both parties. A glossary note per project, one term per entry with its meaning and the term it replaces, read at the start of each session, makes that durable: the person corrects a word once, and the correction holds in every later session, rather than living in one agent's private memory. The Desk could show the glossary beside the Memory pane, and mark a term the agent used against its glossary meaning.

Open questions: where the glossary lives (in the project's repository, in the agent's memory store, or both, one derived from the other); how a new term is proposed and ruled; whether the check against glossary meanings belongs in the Desk or in the agent's own instructions.

Raised 2026-10-19.
