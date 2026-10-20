# garnet-scoping: requirements, draft 2

## Purpose

A person working with an AI coding agent sees only what the agent chooses to say. The agent's state (its plan and the step it is on, the files it has read and written, the memory notes it consults, the work it is waiting on, the question it has asked) is already written down as the agent works, in the transcript Claude Code keeps for each session, but not anywhere the person looks. garnet-scoping makes that state visible: for any session, a window that shows it, derived live from the transcript, so that the person can follow the agent's work as it happens and review it afterwards.

This document states what the app must do, not how. It separates what has been decided from what is proposed and what is still open; design starts only when it has been reviewed.

## Definitions

- **Session:** one Claude Code conversation, from any of its front ends (the desktop app, the command line).
- **Transcript:** the file in which Claude Code records a session as it runs, one per session, in the user's Claude configuration directory, grouped by the folder the session was started in (its project). Its format is Claude Code's own and is not documented; it may change with any release.
- **Desk:** the panel of a session's window that shows the session's present state (R2); before D9 it named the whole window.
- **Memory store:** the folder of Markdown notes Claude Code keeps per project, each note carrying a name, a description and a type in its frontmatter, which the agent reads and writes to remember things between sessions.

## Decided

These were ruled before this document was written.

- D1. garnet-scoping is a desktop application, separate from the agent and from any editor. It lists sessions, and for any session opens a Desk in its own window.
- D2. A Desk shows the session's present state, with the session's trail beneath it (R2, R3).
- D3. A Desk has a Memory pane (R4).
- D4. The first version runs on macOS only.
- D5. The repository is public, under the garycoding account, and the code is licensed under AGPL-3.0-or-later.
- D6. The app is named garnet-scoping; "Desk" names a part of its window (since D9, one of the window's panels), not the app.
- D7. Changes to the details are expected to follow from use: the first version is the starting point, not a fixed design.
- D8. Each session has one window, holding its Desk and its board (R7); the board is a shared whiteboard of shapes with text, lines and arrows.
- D9. The window's four panels, Desk (the present state), Trail, Memory and Board, are each turned on and off. When the board is shown beside other panels it takes half the window, on the side (left, right, top or bottom) set in Settings; the other panels share the remaining half.

## Settled under the go-ahead

These were proposed and then settled under the instruction to proceed as recommended toward the first release (2026-10-19); they are the author's recommendations, not separate rulings, and may be revisited in use.

- S1. All sessions on the machine are listed, the recently active first (P1).
- S2. The app makes no network connection, enforced in code (P2, R5.4).
- S3. An action's raw output is shown only for the action the person picks (P3, R5.2).
- S4. The name and icon are reserved as the project's unregistered marks (P4).
- S5. Subagents' and background agents' own transcripts are left out of the first version (Q1).
- S6. Messages the person sends while the agent is working appear in the trail where they arrived, marked as sent mid-turn (Q2).
- S7. A Desk can show the session's working folder, and any touched file, in the Finder (Q3).
- S8. Finished sessions stay listed; nothing is hidden by age (Q4).

## Requirements

### R1. Sessions

R1.1. The app lists the sessions it finds on the machine, grouped by project, each with its title, its project folder, and the time of its last activity; a session whose transcript was written in the last ten minutes is marked as recently active. (Whether a session is still open cannot be read from its transcript, so the mark is about activity, not about the session's state.)

R1.2. A Desk can be opened for any listed session, and several Desks can be open at once, one per window.

R1.3. A Desk updates as its transcript grows, without the person doing anything.

### R2. The present state

What the session is doing now, at the top of the Desk:

R2.1. **The plan:** the agent's current task list and the step in progress, as the agent last set it. In a desktop-app session this is the task list the app shows under the agent's message; in a command-line session it is the agent's to-do list. Both are read where the transcript records them.

R2.2. **Now:** the agent's last few actions, newest first, each by the one-line description the agent gave it (for a shell command) or its tool and target (for a file read, an edit, a web request), with its time.

R2.3. **Waiting:** work the agent has started in the background and not yet seen finish, with how long it has been running.

R2.4. **Last word:** the agent's last message and, if the agent's turn ended with no message from the person after it, that this is the agent's turn awaiting the person. The Desk does not try to decide whether the message holds a question; it shows that the agent has spoken last.

R2.5. **Touched this turn:** the files read and written, and the memory notes read and written, since the person's last message.

R2.6. **Session facts:** the model and effort, the working folder and branch, linked pull requests, and how much of the context budget is left, where the transcript records them.

R2.7. **Discuss:** the person can mark any row of Plan, Now, Trail or Memory to discuss with the agent: a double-click marks the row (or withdraws an open mark); the right-click menu marks it without a note or with one, or withdraws it. Marks are kept in the session's state file beside its board, shown on their rows and in a "To discuss" strip until withdrawn or dismissed, and stated at the head of the board's rendition. The agent answers in the conversation and records a one-line answer with its request (`"discussed"`), which the Desk shows on the row and in the strip.

R2.8. **Hold:** a button on the window's header lets the person ask the agent to stop after its current step. The request shows as "Hold requested"; the agent finishes the step it is in, starts no other, and confirms with `"holding": true` in a request, after which the button shows "Holding"; the person releases the hold with the same button. Nothing the agent is running is cancelled. The hold is kept in the session's state file and stated at the head of the board's rendition; only the agent can confirm a hold, and only the person can request or release one.

### R3. The trail

R3.1. Beneath the present state, the session turn by turn, newest at the bottom: each turn shows the person's message (with its images), the agent's actions in order with their descriptions, the files and notes touched, and the agent's closing message or recap.

R3.2. A turn's details collapse to one line and expand on request, so that a long session stays readable.

R3.3. The agent's reasoning is shown where the transcript keeps it, and marked as absent where it does not; it is never inferred.

### R4. The Memory pane

R4.1. Lists every note in the memory store of the session's project, grouped by type, each with its name and description, and marks the notes read or written in this session.

R4.2. Any note can be read in the Desk as rendered Markdown.

R4.3. The pane updates as notes are written, including during the session.

### R5. Reading safely

R5.1. The app reads the transcripts and the memory stores; it never writes, moves or deletes anything in the Claude configuration directory.

R5.2. A transcript can hold anything a tool printed, secrets included. The Desk shows each action by its description and target, not by its output; an action's raw output is not shown unless the person asks for that action's output.

R5.3. A long session's transcript can run to tens of megabytes: a Desk reads it incrementally, and opens within two seconds on a current laptop for a session of that size. The session list is built from each file's size, time and a few lines at its ends, never by reading whole files.

R5.4. The app makes no network connection: every request that is not to the app's own files is refused in code, whatever part of the app makes it.

R5.5. Records that hold the session's setup rather than its work (the system prompt, the account's context) are never shown.

### R6. Format drift

R6.1. The app reads the transcript through one module that knows the kinds of record it uses. A kind it does not know is counted, not fatal, and the Desk shows the count, so that a change in Claude Code's format is visible rather than silent.

R6.2. The app records the Claude Code versions it was checked against, reads the version each transcript records, and says when a session's version is newer than any it was checked against.

R6.3. What the Desk shows can be traced to the records it was derived from, so that when a part goes blank after an update, the missing kind of record can be found.

### R7. The board

R7.1. A session's window has a board beside its Desk: a whiteboard on which the person places shapes (rectangles, ellipses, diamonds), writes text in them, and joins them with lines and arrows. Freehand drawing is not part of the board.

R7.2. The board is kept in an Excalidraw file per session (Excalidraw's format and editor are MIT), in a folder of the app's own outside every repository and outside the Claude configuration directory, at a path without spaces derived from the session's id. The window shows the path and copies it, so that the agent can be told where the board is.

R7.3. Beside the board file the app keeps a plain-text rendition, current with every change: each shape's id, kind, text and rough position, and each connection as "A → B" with its label. The agent reads the rendition rather than the board's full JSON.

R7.4. The agent changes the board by writing a short request file beside it, listing shapes to add (kind, text, position, and connections by shape id) and shapes to remove or relabel. The app expands the request into full Excalidraw elements, merges it into the board, and removes the request file; the agent never writes Excalidraw's full format.

R7.5. The person's edits and the agent's requests merge by element, so that neither overwrites the other: a change to the board file from outside the window is merged element by element, the newer version of each element winning, and the board file is always written whole and atomically.

R7.6. The board carries two signals from the person to the agent. **Editing** is a checkbox that any change the person makes to the board checks, and that the person unchecks when done, so the agent knows whether the board is still being changed. **Review** is a toggle the person turns on to ask the agent to read the board now, which also unchecks Editing; the agent turns it off, with its request, once it has read the board. Both are off by default, kept on disk beside the board, and stated at the head of the rendition.

## Proposed and settled

These were the defaults proposed during the discussion; S1 to S4 above settle them.

- P1. **Which sessions:** all sessions on the machine are listed, the live ones first and the finished ones below, since a finished session's record is as readable as a live one's.
- P2. **No network:** the app makes no network connection of any kind, since a transcript can hold anything.
- P3. **Raw output:** R5.2 as written: an action's output is shown only for the action the person picks, never in bulk and never by default.
- P4. **Name and icon:** reserved as the project's unregistered marks, as for the other apps of the family, with a statement in `LICENSING.md` once the app has an icon.

## Open questions, settled

S5 to S8 above settle these.

- Q1. Subagents and background agents keep transcripts of their own beside the session's. Should a Desk show them, nested under the action that started them, or leave them out of the first version?
- Q2. Should the Desk show the session's own record of the person's mid-turn messages separately, or only as they appear in the trail?
- Q3. Should the app be able to open a session's working folder or a touched file in the system's file manager or editor?
- Q4. How long a finished session stays in the list: always, or until it is older than some age?
