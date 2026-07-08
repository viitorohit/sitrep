// GETSITREP-35: session-scoped state for the proactive command advisor.
//
// Ephemeral, gitignored, mirrors the existing .sitrep-active-session
// pattern — reset implicitly by session-start/session-end never touching it
// (there's no formal "session boundary" signal available to a PostToolUse
// hook, so this file's lifetime is really "since it was last deleted or
// since sitrep-nudge-check started counting," not a strict single-session
// guarantee. Documented here rather than overclaiming precision.
//
// `firedTriggers` is what makes the Story's "fires at most once per trigger
// condition per session" requirement real — nudge-check.js checks this
// before ever surfacing a trigger, and records it here immediately after.

const { readJsonIfExists, writeJson } = require('./fs-helpers');
const paths = require('./paths');

function readNudgeState() {
  const data = readJsonIfExists(paths.NUDGE_STATE());
  if (!data || typeof data !== 'object') {
    return { tickCount: 0, firedTriggers: [] };
  }
  return {
    tickCount: typeof data.tickCount === 'number' ? data.tickCount : 0,
    firedTriggers: Array.isArray(data.firedTriggers) ? data.firedTriggers : [],
  };
}

function writeNudgeState(state) {
  writeJson(paths.NUDGE_STATE(), state);
}

// Increments the tick counter (one per nudge-check invocation, i.e. roughly
// one per hook-fired PostToolUse event) and returns the updated state —
// callers get a fresh read+increment+persist in one step since nudge-check
// runs as a fresh process every time, no in-memory state survives between
// invocations.
function tick() {
  const state = readNudgeState();
  state.tickCount += 1;
  writeNudgeState(state);
  return state;
}

function hasFired(state, triggerId) {
  return state.firedTriggers.includes(triggerId);
}

function markFired(triggerId) {
  const state = readNudgeState();
  if (!state.firedTriggers.includes(triggerId)) {
    state.firedTriggers.push(triggerId);
    writeNudgeState(state);
  }
}

module.exports = { readNudgeState, writeNudgeState, tick, hasFired, markFired };
