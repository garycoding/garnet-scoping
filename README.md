# garnet-scoping

A macOS desktop app that shows what a Claude Code session is doing, for the person working with it. It reads each session's transcript, the file Claude Code writes as the session runs, and for any session opens a Desk: a window showing the agent's plan and the step it is on, what it is doing now, the files and memory notes it has touched, what it is waiting on and any question it has asked and not had answered, with the session's trail beneath, turn by turn. It only reads; it never writes near the transcripts and makes no network connection.

## Status

Specification stage: the requirements are in [`docs/requirements.md`](docs/requirements.md), for review before any design. Ideas not yet decided are in [`docs/in-flight_ideas.md`](docs/in-flight_ideas.md).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md). The app is licensed under AGPL-3.0-or-later; see [`LICENSING.md`](LICENSING.md).

---
<sub>© 2026 Gary Frattarola · Licensed under [CC-BY-4.0](LICENSES/CC-BY-4.0.txt)</sub>
