# Update Project Plan

> Intentional (manually invoked).

Thin wrapper (GETSITREP-10) over `getsitrep plan-update` — the CLI owns the table lookup, row insertion, and commit. This file's only remaining job is the one step no CLI can do on its own: interpreting the free-form request in `$ARGUMENTS` into the structured JSON the CLI expects.

## Step 1: Interpret the request

Read `$ARGUMENTS`. Determine whether it describes a **decision** or a **risk**:

- **Decision** → `{"type": "decision", "decision": "...", "rationale": "...", "date": "YYYY-MM-DD"?}` (`date` optional, defaults to today)
- **Risk** → `{"type": "risk", "risk": "...", "impact": "High"|"Medium"|"Low", "mitigation": "..."}`

If it's genuinely ambiguous which one applies, or a required field is missing from the request, ask the user rather than guessing.

Note: adding a task to a phase or the Future table is `/capture`'s job, not this command's — if the request is really "add a task," say so and suggest `/capture` instead of forcing it into this shape.

## Step 2: Call the CLI

```bash
getsitrep plan-update --data '<the JSON from Step 1>'
```

Print its output verbatim.
