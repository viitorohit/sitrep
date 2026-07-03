# ADR-0004: CLI Extraction (GETSITREP-8) Builds Fresh In-Repo

**Status:** Accepted
**Date:** 2026-07-03

## Context
The published `getsitrep` npm package's CLI (`index.js`, `package.json`) was built and published manually from a separate local directory that was never brought under version control and does not exist anywhere in this repo. Repo audit (2026-07-03) confirmed no CLI source exists in `viitorohit/sitrep`.

Options considered:
1. Port/import the external source into the repo as GETSITREP-8's starting point.
2. Rebuild fresh in-repo, treating the external copy as a disposable prototype.
3. Keep the CLI permanently external, repo stays a commands-only markdown framework.

## Decision
Option 2. GETSITREP-8 builds the CLI from scratch, in-repo, zero dependencies, Node.js builtins only — per the existing Coding Standards. No porting work is in scope.

## Consequences
- Any working logic in the external prototype is lost unless manually referenced during GETSITREP-8 — no automatic carryover.
- The npm publish flow must be re-established from the new in-repo source; the existing published v0.2.0 package's provenance is now effectively undocumented/orphaned.
- Removes the undocumented external dependency entirely — after this, 100% of shippable code lives in the versioned, auditable repo, consistent with ADR-0001's build-in-public principle.
