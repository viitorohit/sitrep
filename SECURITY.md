# Security

## Reporting a vulnerability

Please report security issues via [GitHub's private security advisory form](https://github.com/viitorohit/sitrep/security/advisories/new) rather than a public issue. See `CONTRIBUTING.md` for the full process.

## Shell-out surface

sitrep is a zero-dependency Node.js CLI (Node builtins only — no third-party packages). It shells out in exactly two files, both narrowly scoped to `git`:

| File | Calls | Purpose |
|---|---|---|
| `src/lib/git.js` | `execFileSync('git', [...args])` | Every read/write sitrep makes to the repo (`add`, `commit`, `log`, `config`, `rev-parse`, etc.) — this is the core "git is the database" design: every mutation is a real commit. |
| `src/lib/introspect.js` | `execFileSync('git', ['remote', 'get-url', 'origin'])`, `execFileSync('git', ['config', 'user.name'])` | Best-effort auto-fill of project name/owner in a generated `PROJECT_PLAN.md` during onboarding. |

Every call uses `execFileSync(command, [argv...])` — a literal binary name plus an argument array, passed directly to the OS without a shell. None of these calls build a shell-interpreted string or interpolate untrusted input into one, so there is no shell-injection surface: this is not the `exec()`/`execSync(shellString)` pattern that actually carries that risk.

Some automated supply-chain scanners (e.g. Socket.dev) flag any `child_process` usage as "Shell access" without distinguishing the two patterns. We've deliberately kept the safe pattern rather than removing the `git` dependency — sitrep's entire value proposition is git-native tracking, and swapping to a pure-JS git library would trade a narrow, auditable shell-out for a third-party dependency with its own transitive supply chain, violating this project's zero-dependency principle for no real security gain.

As of GETSITREP-62, `src/commands/init.js` no longer shells out at all — `ccusage` detection was moved from `execFileSync('which', ['ccusage'])` to a direct filesystem scan of `PATH` entries.
