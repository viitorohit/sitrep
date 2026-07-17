# ADR-0008: getsitrep.dev Deploys From site/ in This Repo via GitHub Pages, Gated by Required PR Review

**Status:** Accepted
**Date:** 2026-07-17

## Context

GETSITREP-61 (landing page for `getsitrep.dev`) shipped a concept mockup as a Claude Artifact for sign-off, per the ticket's own suggested approach. The ticket explicitly left framework/hosting/DNS as separate, not-yet-made decisions and out of its scope ("those stay session-owner actions"). This session, the session owner made that call directly and asked for an automated way to keep iterating on the site and publishing it, without hand-copying from an Artifact into a hosting dashboard each time, and without standing up a second repository.

Two requirements had to be satisfied together:
1. **No second repo.** The site should live and deploy from the same place as the CLI.
2. **Nothing goes live without explicit approval.** Whatever automation exists, a change must not reach production without the session owner personally signing off.

A follow-up question surfaced a real tension inside requirement 1: `sitrep` is public by design (it's the OSS CLI; "public repo is traffic-ready" is part of v0.3's own Definition of Done). Putting the site's source in that same repo means the source — drafts, positioning language, commit history — is publicly browsable, same as the CLI code. The session owner considered a second, private repo purely for the site (still simple, still automatable, just not literally one repo) as the alternative, and weighed it against one further fact: a live static site's rendered HTML is always visible via any browser's "view source" once it's deployed, regardless of which repo built it — so a private repo would only have hidden drafts/history, not the shipped page itself. Given that, the session owner chose to keep the site in the public `sitrep` repo rather than split it out.

Options considered for hosting:
1. **Vercel or Netlify.** Free tier, PR preview URLs (deploy previews before merge). Rejected as the default — both require a new external account/service, which sitrep's own "no lock-in" stance and this session's "no new moving pieces" framing argue against when a zero-new-account option exists and meets the actual requirement.
2. **GitHub Pages** — deploys from a workflow already running against a repo the session owner is already authenticated into (`gh`, `repo` scope confirmed live). Free on a public repo. No new account, no new service to manage credentials for. Selected.

Options considered for the approval gate:
1. **Rely on the documented convention alone** (CLAUDE.md's "main is protected, no direct pushes," and Claude's own standing rule to never merge PRs). Rejected as insufficient on its own — it's enforced by discipline and instructions, not by GitHub itself; a technical guarantee is stronger and was explicitly what was asked for ("protect website changes done without my approval").
2. **GitHub branch protection on `main`: require a pull request before merging.** This blocks *all* direct pushes to main, including from repo admins, at the platform level — nothing merges without going through a PR the session owner opens or reviews and then personally merges. Selected, as an additional technical layer on top of (not a replacement for) the existing governance convention.

## Decision

The site lives at `site/` in the `sitrep` repo (`site/index.html`, `site/CNAME`) and deploys via `.github/workflows/deploy-site.yml`: on every push to `main` touching `site/**`, the workflow uploads `site/` as-is (no build step, consistent with this project's existing "no build step, self-contained HTML" rule) and publishes it via GitHub Pages (`actions/upload-pages-artifact` + `actions/deploy-pages`). `main` has branch protection requiring a pull request before merging — direct pushes are blocked for everyone, including admins. The custom domain `getsitrep.dev` is mapped via `site/CNAME`; DNS records pointing the domain at GitHub Pages are configured once, outside this repo, by the session owner.

Ongoing site changes follow the same Story→Branch→PR loop CLAUDE.md already requires for code: edit `site/index.html` on a branch, open a PR referencing the relevant Jira key, session owner reviews and merges, deploy fires automatically.

## Consequences

- No second repository to keep in sync, no new external account to manage credentials for.
- Every site change, however small, is now technically blocked from reaching production without going through a PR — matching the explicit ask ("protect website changes done without my approval") with a platform-level guarantee, not just a documented convention.
- The site's source (including draft copy and history) is publicly browsable in the repo, same as the CLI — an explicit, considered trade the session owner made in favor of avoiding a second repo, not an oversight. The live page's rendered HTML would have been publicly viewable either way.
- Deploys are now fully automated post-merge (typically live within about a minute), removing the manual Artifact-to-hosting-dashboard copy step this session started from.
- Doesn't solve: PR preview URLs. Reviewing a pending site change still means reading the PR diff or asking for an Artifact preview, not clicking a live per-PR link — Vercel/Netlify remain the option if that becomes worth the new-account cost later; this ADR doesn't rule that out, it just isn't the default.
- Doesn't solve: DNS. `site/CNAME` declares the intent, but the actual `A`/`CNAME` records at the domain registrar are configured once by the session owner, outside GitHub's or this repo's control — a hosting choice can point domain traffic correctly, but it can't create or hold registrar credentials.

---
*ADRs are immutable once Accepted. To change a decision, write a new ADR that supersedes this one — don't edit this file.*
