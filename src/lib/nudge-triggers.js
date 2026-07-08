// GETSITREP-35: opportunity-detection heuristics for the 6 nudge-eligible
// commands. Each trigger function is pure — given already-loaded state, it
// returns a nudge descriptor or null, never touches the filesystem itself
// (nudge-check.js gathers state once and passes it in).
//
// Two of the ticket's six original triggers are deliberately NOT
// implemented here, flagged rather than faked:
//
// - `plan-update` ("plan-vs-reality divergence detected") is literally
//   GETSITREP-52 (Scoped conflict check), a separate Tier-2 Story that
//   doesn't exist yet. Firing this trigger today would mean inventing a
//   divergence check this codebase doesn't have — skipped until GETSITREP-52
//   ships, at which point this file gets a real trigger wired to it.
// - The context-hygiene trigger family (context size thresholds, compaction
//   proximity) depends on per-platform context telemetry that
//   docs/specs/adapter-contract.md's own "explicitly unresolved — do not
//   guess" list already flags as unverified beyond Claude Code. Guessing a
//   context-size signal here would violate that same discipline. Deferred
//   until that telemetry question is actually answered.
//
// The four triggers below use only signals this codebase can genuinely
// observe today: GETSITREP-30's real drift detection, git's real working-
// tree state, and the nudge-state tick counter (one tick per nudge-check
// invocation — a rough proxy for "meaningful interaction has happened,"
// not a literal cost/context measurement).

const TICKS_BEFORE_PERIODIC_STATUS = 15;
const TICKS_BEFORE_CAPTURE_REMINDER = 10;
const TICKS_BEFORE_LONG_SESSION = 40;
const SESSIONS_WITHOUT_DASHBOARD_THRESHOLD = 3;

// selfheal: reuses GETSITREP-30's real drift result — never re-derives it.
function selfhealDriftTrigger({ driftResult }) {
  if (!driftResult || !Array.isArray(driftResult.drifted) || driftResult.drifted.length === 0) return null;
  return {
    command: 'selfheal',
    triggerId: 'selfheal-drift',
    reason: `${driftResult.drifted.length} command file(s) have drifted from the canonical version`,
  };
}

// capture: uncommitted work sitting around for a while is a reasonable,
// real (not guessed) proxy for "something worth capturing may exist" — not
// the ticket's literal "cost threshold crossed" (no live in-session cost
// telemetry exists to measure that yet).
function captureReminderTrigger({ hasUncommittedChanges, tickCount }) {
  if (!hasUncommittedChanges) return null;
  if (tickCount < TICKS_BEFORE_CAPTURE_REMINDER) return null;
  const bucket = Math.floor(tickCount / TICKS_BEFORE_CAPTURE_REMINDER);
  return {
    command: 'capture',
    triggerId: `capture-reminder-${bucket}`,
    reason: 'uncommitted changes present for a while — worth capturing as a tracked task if this is new scope',
  };
}

// dashboard: real signal — sessions logged since the last dashboard archive.
function dashboardStaleTrigger({ sessionCount, dashboardArchiveCount }) {
  const sessionsSinceDashboard = sessionCount - dashboardArchiveCount;
  if (sessionsSinceDashboard < SESSIONS_WITHOUT_DASHBOARD_THRESHOLD) return null;
  return {
    command: 'dashboard',
    triggerId: `dashboard-stale-${dashboardArchiveCount}`,
    reason: `${sessionsSinceDashboard} sessions logged since the last dashboard view`,
  };
}

// handoff: tick count as a long-session proxy — no true wall-clock session
// duration is available to a hook-fired process with no persistent memory.
function handoffLongSessionTrigger({ tickCount }) {
  if (tickCount < TICKS_BEFORE_LONG_SESSION) return null;
  const bucket = Math.floor(tickCount / TICKS_BEFORE_LONG_SESSION);
  return {
    command: 'handoff',
    triggerId: `handoff-long-session-${bucket}`,
    reason: 'this has been a long session — consider a handoff checkpoint',
  };
}

// sitrep: periodic milestone check-in, same tick-bucket re-fire pattern.
function sitrepPeriodicTrigger({ tickCount }) {
  if (tickCount < TICKS_BEFORE_PERIODIC_STATUS) return null;
  const bucket = Math.floor(tickCount / TICKS_BEFORE_PERIODIC_STATUS);
  return {
    command: 'sitrep',
    triggerId: `sitrep-periodic-${bucket}`,
    reason: 'periodic status check-in',
  };
}

// Evaluated in this fixed priority order — selfheal drift (a real, already-
// detected correctness issue) always outranks the softer proxies below it.
// Returns every currently-eligible nudge; nudge-check.js is the one that
// enforces "surface at most one" (no-nag discipline) and does the
// already-fired filtering via nudge-state.js.
const TRIGGERS = [selfhealDriftTrigger, captureReminderTrigger, dashboardStaleTrigger, handoffLongSessionTrigger, sitrepPeriodicTrigger];

function evaluateTriggers(state) {
  return TRIGGERS.map((fn) => fn(state)).filter(Boolean);
}

module.exports = {
  evaluateTriggers,
  selfhealDriftTrigger,
  captureReminderTrigger,
  dashboardStaleTrigger,
  handoffLongSessionTrigger,
  sitrepPeriodicTrigger,
};
