# garnet-scoping: northstar

This northstar is the canonical statement of garnet-scoping's purpose. It is here to guide every design decision and feature proposal, and each is weighed against it. Where it and any other document disagree, this one is the authority and the other is the thing to fix; where it and the code disagree, the code is wrong. A change of intent is therefore made here first, in the same pull request as the code that follows it, so that no disagreement is ever left standing by accident.

## What it is

garnet-scoping is a macOS app that sits beside a Claude Code session and gives the person and the agent a common view of their work. For each session it shows a Desk, read from the session's transcript (the agent's plan, what it is doing now, what it is waiting on, its last word, the files and memory notes it has touched, and the trail of every turn), and a board on which both of them draw. Through the Desk and the board the person signals the agent: Review asks it to read the board, Discuss points it at a row of the Desk, Hold asks it to stop after its current step. The app only reads what Claude Code writes, and it writes only to its own folder.

## Why it exists

A person working with an agent sees only what the agent says. The agent's plan, the step it is on, the commands it ran, the work it left running and the question it asked an hour ago are all in the transcript, but not where the person can see them, and the agent's own account of its work is a summary that may be incomplete or wrong. In the other direction, the agent sees only the person's messages: a concept that is easiest to show, a doubt about one particular action, or a wish to pause, has to be turned into prose and sent as a message, which reaches the agent only when its current step ends.

People who work together share a room, a whiteboard and the means to interrupt one another. garnet-scoping exists to give a person and an agent as much of that as can be built from the outside: each able to perceive the other's state, a shared surface on which to communicate concepts exactly, and the means to steer the work without losing any of it.

## Intents

garnet-scoping serves three complementary intents: facets of one purpose, presented as peers rather than as one primary and the rest secondary, and mutually reinforcing.

1. **Shared perception, both ways.** The person perceives the agent's state as it is, and the agent perceives what the person is doing and asking for, without either having to narrate it to the other.

2. **Accurate, easy communication, both ways.** The person and the agent communicate concepts exactly, on a shared surface both can change, so that what one means is what the other understands; and doing so takes little effort from either, so that it happens whenever it would help rather than only when it is worth the trouble.

3. **Steering without loss.** The person can direct the agent's attention, ask questions about its work, and stop it at a step boundary at any moment, and nothing in progress is cancelled or lost.

### 1. Shared perception, both ways

From the agent to the person, perception is the Desk: the present state at a glance, and the trail beneath it, both derived from the transcript and current within a second or two. It shows what the agent did, which may differ from what the agent says it did, and it shows what the agent is waiting on, so that a long silence has a visible cause.

From the person to the agent, perception is the person's signals, each kept in a file the agent can read and each delivered without a message: Editing tells the agent that the board is still being changed; Review, Discuss and Hold ask for its attention. They reach the agent through a watcher in every session, or, where Claude Code allows it, through a channel that pushes them into the session the moment they appear.

### 2. Accurate, easy communication, both ways

The board is a whiteboard of shapes with text, lines and arrows, shared by the person and the agent. The person draws; the agent reads the board as a plain-text rendition and changes it with a short request, never by writing the drawing's own format. A structure drawn is understood faster and more exactly than one described, and an answer placed beside the question it answers keeps the two together.

Communication must also be easy, in both directions. For the person, a signal is one gesture: a press of Review, a double-click on a row, an optional note of a line, a shape dropped on the board. For the agent, it is a short text file to read and a short request to write, never the board's own format, and signals arrive without the agent having to look for them. Friction on either side means the communication does not happen, and a concept left uncommunicated costs more than one communicated roughly.

Communication is also precise about its subject. Discuss points at one row of the Desk, an action, a plan step, a turn, a message or a memory note, optionally with a note, so that a question about the agent's work names exactly the work it is about, and the agent's answer is shown on that row.

### 3. Steering without loss

A person who has to wait for the agent's turn to end, or who interrupts it and loses the work in progress, steers too late or at too high a price. garnet-scoping lets the person steer at any moment and cancels nothing: Discuss and Review are answered when the agent's current step ends, and Hold stops the agent at a step boundary, after which the person releases it and the work resumes where it stopped. Work the agent started in the background keeps running throughout.

The app cannot interrupt the agent in the middle of a step; only Claude Code could, and garnet-scoping uses whatever Claude Code provides, such as channels, as it becomes available.

### How the intents reinforce each other

Perception makes the other two possible: the person can point at the agent's work and steer it only because the Desk shows that work, and the agent can answer a signal only because it can perceive it. Accurate communication makes steering cheap: a mark on a row with a one-line note costs the person seconds and the agent no guesswork. Steering without loss, in turn, is what makes perception worth having: seeing a mistake is of little use if correcting it costs the work in progress. Where speed of delivery and the agent's undisturbed work meet, the design has chosen that a signal reaches the agent at its next step boundary, not in the middle of a step.

## Axioms

The same axioms support all the intents, from different angles.

1. **Easy to use means will be used.** A feature that takes effort is used only when it seems worth the trouble, which is less often than it would help. Every signal, view and exchange is made as easy as it can be, for the person and for the agent alike.

2. **The record over the report.** What the Desk shows is derived from the transcript, not from the agent's account of its work. Where the two differ, the Desk shows what happened.

3. **No cost to the agent's work.** The app only reads; a watcher costs nothing while it waits; a signal interrupts only when the person means it to. A feature that slows the agent down needs a reason stronger than the help it gives.

4. **Read-only, local and private.** The app never writes under the Claude configuration directory and makes no network connection, because a transcript can hold anything. Its own files live in its own folder.

5. **Every signal is explicit and cleared by its answer.** A signal is something the person did on purpose (pressed, marked, asked for), kept on disk until the agent answers or the person withdraws it, and visible in both states. Nothing is inferred from silence.

6. **Change shows, never fails silently.** Claude Code's transcript is an internal format that changes with its releases. The app reads it through one module, counts what it does not recognise, and says when a session runs a version newer than any it was checked against, so that a break is visible as soon as it happens.

7. **Its own plain identity.** The app looks and behaves as itself: plain type, crisp lines, its own colours, and no imitation of hand-drawn or physical things.

8. **Improved together.** The app is improved iteratively by the person and the agent who use it. Either may propose a change for the person, for the agent, or for their collaboration, and the person decides.

## Guiding questions

When making a decision, these are the questions to keep answering:

- Does it help the person see what the agent is actually doing, or the agent see what the person is doing and asking for?
- Does it make a concept, a question or an answer more exact, and keep it beside what it is about?
- Is it easy for both the person and the agent: one gesture for the person, a short read or write for the agent?
- Can the person use it at any moment, and does it leave all work in progress intact?
- Is it derived from the record rather than from the agent's report?
- Does it cost the agent's work anything, and is the help worth that cost?
- Does it keep the app read-only, local and private?
- If Claude Code changes underneath it, will the failure show?

## What garnet-scoping is not

- **Not a client for Claude Code.** It does not send prompts, run sessions or replace the conversation; the conversation stays where the work is done.
- **Not a monitoring or reporting tool.** It serves the person working with the session now, not an audience looking back at many sessions.
- **Not a general whiteboard.** The board serves the session beside it: shapes, text and connections, readable by the agent, and nothing that the agent cannot read.
- **Not a way to control the agent from outside.** Every signal is a request the agent answers in the session; the app stops nothing and changes nothing in Claude Code.

---
<sub>© 2026 Gary Frattarola · Licensed under [CC-BY-4.0](../LICENSES/CC-BY-4.0.txt)</sub>
