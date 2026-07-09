# Contributing to sitrep

Thanks for considering a contribution. sitrep is dogfooded on itself — the same governance and workflow described here is what this repo's own history was built with.

## Ground rules

- **Zero dependencies.** The CLI (`src/`) uses Node.js builtins only (`fs`, `path`, `readline`, `child_process`). A PR adding a `dependencies` entry needs a strong reason and will get real scrutiny.
- **No build step.** Every command is a single `.js`/`.md` file. Don't introduce a bundler, transpiler, or compile step.
- **Every cost figure is labeled.** No PR may introduce a cost/token number without an `actual`/`estimate`/`mixed` label — see `docs/specs/cost-schema.md`.
- **Fail-open for automatic commands.** `session-start`/`session-end` (and anything hook-fired) must never block a developer's workflow — see Hard Law #5 in `CLAUDE.md`.

## Before you write code

1. **Check Jira first.** [GETSITREP](https://viitorcloud.atlassian.net/browse/GETSITREP) is the source of truth for scope, status, and build order — not this file, not README. If you don't have Jira access, open a GitHub issue instead and it'll get triaged into a ticket.
2. **Read the relevant spec.** `docs/specs/` (command canon, adapter contract, cost schema) is canonical for how things are supposed to work. `docs/adr/` explains *why* a design decision was made — read the relevant ADR before proposing to change something it settled; if you think a decision should change, that's a new ADR that supersedes the old one, not an edit to it.
3. **For anything nontrivial, open an issue first.** Saves you writing code against a misunderstanding of scope.

## Making a change

1. Fork the repo (external contributors) or branch directly (`{JIRA-KEY}-{slug}` off `main`, if you have write access).
2. Make your change. Add or update tests in `test/` — this repo has no framework, just plain Node scripts with `assert` (see `test/cost-attribution.js` for the pattern). Every command's `execute()` should stay covered by `test/byte-identical.js`, which checks CLI-subprocess and in-process invocation produce identical output.
3. Run the full suite before opening a PR:
   ```bash
   npm test
   ```
4. Open a PR against `main`. Reference the Jira key or GitHub issue it addresses, and state which acceptance criteria are met.
5. `main` is protected — merges happen after review, never a direct push.

## What a good PR looks like

- Touches one thing. This repo's own history splits unrelated fixes into separate PRs even when they're small (see `git log` — bugfixes, docs, and features are rarely mixed in one commit).
- Includes tests that would have failed before your change and pass after.
- If it changes a documented behavior, updates the doc in the same PR (README, `docs/USAGE_GUIDE.md`, or the relevant `docs/specs/*.md`) — not as a follow-up.
- If it's an architecturally significant decision (not just an implementation detail), proposes an ADR using `docs/adr/template.md` rather than only explaining the reasoning in the PR description.

## Questions

Open a GitHub issue. For anything security-related, see below rather than filing a public issue.

## Security

If you find a security issue, please don't open a public GitHub issue — use GitHub's private security advisory feature instead ("Security" tab → "Report a vulnerability" on this repo).
