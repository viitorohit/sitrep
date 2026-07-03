# ADR-0001: Single Repo, No Fork/Dev-Split

**Status:** Accepted
**Date:** 2026-07-01

## Context
Options considered: (a) keep one repo (`viitorohit/sitrep`) with all history visible, or (b) work in a private repo and mirror curated snapshots to a public one, keeping "messy" commits hidden.

## Decision
Single repo. No fork, no dev/publish split. The working repo is the public repo.

## Consequences
- Brand value: SitRep's positioning depends on build-in-public — commits and PR history are proof-of-work for the ViitorCloud halo. A curated-snapshot model would quietly undercut that.
- Cost: nothing can be scrubbed from history after the fact without breaking this same principle (see ADR-0003, where this constraint was tested directly).
- The actual fix for "keep the repo clean" is branch discipline (ADR-0002), not repo separation.
