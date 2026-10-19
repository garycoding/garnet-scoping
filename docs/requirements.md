# garnet-scoping: requirements, draft 1

## Purpose

A person working with an AI coding agent sees only what the agent chooses to say. The agent's state (its plan and the step it is on, the files it has read and written, the memory notes it consults, the work it is waiting on, the question it has asked) is already written down as the agent works, in the transcript Claude Code keeps for each session, but not anywhere the person looks. garnet-scoping makes that state visible: for any session, a window that shows it, derived live from the transcript, so that the person can follow the agent's work as it happens and review it afterwards.

This document states what the app must do, not how. It separates what has been decided from what is proposed and what is still open; design starts only when it has been reviewed.

## Definitions

- **Session:** one Claude Code conversation, from any of its front ends (the desktop app, the command line).
- **Transcript:** the file in which Claude Code records a session as it runs, one per session, in the user's Claude configuration directory, grouped by the folder the session was started in (its project). Its format is Claude Code's own and is not documented; it may change with any release.
- **Desk:** the window that shows one session.
- **Memory store:** the folder of Markdown notes Claude Code keeps per project, each note carrying a name, a description and a type in its frontmatter, which the agent reads and writes to remember things between sessions.

## Decided

These were ruled before this document was written.

- D1. garnet-scoping is a desktop application, separate from the agent and from any editor. It lists sessions, and for any session opens a Desk in its own window.
- D2. A Desk shows the session's present state, with the session's trail beneath it (R2, R3).
- D3. A Desk has a Memory pane (R4).
- D4. The first version runs on macOS only.
- D5. The repository is public, under the garycoding account, and the code is licensed under AGPL-3.0-or-later.
- D6. The app is named garnet-scoping; "Desk" names its window, not the app.
- D7. Changes to the details are expected to follow from use: the first version is the starting point, not a fixed design.

## Requirements

### R1. Sessions

R1.1. The app lists the sessions it finds on the machine, grouped by project, each with its title, its project folder, the time of its last activity, and whether it is live (its transcript is still being written).

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

R5.3. A long session's transcript can run to tens of megabytes: a Desk reads it incrementally, and opens within two seconds on a current laptop for a session of that size.

### R6. Format drift

R6.1. The app reads the transcript through one module that knows the kinds of record it uses. A kind it does not know is counted, not fatal, and the Desk shows the count, so that a change in Claude Code's format is visible rather than silent.

R6.2. The app records the Claude Code versions it was checked against, reads the version each transcript records, and says when a session's version is newer than any it was checked against.

R6.3. What the Desk shows can be traced to the records it was derived from, so that when a part goes blank after an update, the missing kind of record can be found.

## Proposed, not yet ruled

These are the defaults proposed during the discussion. Each needs a ruling, and may change in review.

- P1. **Which sessions:** all sessions on the machine are listed, the live ones first and the finished ones below, since a finished session's record is as readable as a live one's.
- P2. **No network:** the app makes no network connection of any kind, since a transcript can hold anything.
- P3. **Raw output:** R5.2 as written: an action's output is shown only for the action the person picks, never in bulk and never by default.
- P4. **Name and icon:** reserved as the project's unregistered marks, as for the other apps of the family, with a statement in `LICENSING.md` once the app has an icon.

## Open questions

- Q1. Subagents and background agents keep transcripts of their own beside the session's. Should a Desk show them, nested under the action that started them, or leave them out of the first version?
- Q2. Should the Desk show the session's own record of the person's mid-turn messages separately, or only as they appear in the trail?
- Q3. Should the app be able to open a session's working folder or a touched file in the system's file manager or editor?
- Q4. How long a finished session stays in the list: always, or until it is older than some age?
