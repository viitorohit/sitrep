---
name: Feature request
about: Suggest an idea for sitrep
title: ""
labels: enhancement
---

**What problem are you trying to solve?**
Describe the actual situation, not just the feature — e.g. "I can't tell which of three AI tools ran a given session" rather than "add tool tagging."

**Have you checked this isn't already planned?**
Scope/build order lives in Jira ([GETSITREP](https://viitorcloud.atlassian.net/browse/GETSITREP)) — a quick search there (or `sitrep/PROJECT_PLAN.md`'s Future/Post-MVP table in this repo) may already cover it.

**Proposed approach (optional)**
If you have a specific implementation in mind, sketch it — but the problem statement above matters more than this.

**Would this need a new dependency?**
sitrep's core is zero-dependency (Node builtins only) by design — see `CLAUDE.md`. A "yes" here doesn't rule out the idea, but it needs a strong justification.
