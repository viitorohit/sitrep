#!/usr/bin/env node
// GETSITREP-35: unit tests for the proactive advisor's trigger heuristics —
// pure functions, no filesystem/CLI involved.

const assert = require('assert');
const {
  evaluateTriggers,
  selfhealDriftTrigger,
  captureReminderTrigger,
  dashboardStaleTrigger,
  handoffLongSessionTrigger,
  sitrepPeriodicTrigger,
  SESSIONS_WITHOUT_DASHBOARD_THRESHOLD,
} = require('../src/lib/nudge-triggers');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test('selfhealDriftTrigger fires only when real drift was detected, never guesses', () => {
  assert.strictEqual(selfhealDriftTrigger({ driftResult: null }), null);
  assert.strictEqual(selfhealDriftTrigger({ driftResult: { drifted: [] } }), null);
  const nudge = selfhealDriftTrigger({ driftResult: { drifted: ['commands/selfheal.md'] } });
  assert.strictEqual(nudge.command, 'selfheal');
  assert.strictEqual(nudge.triggerId, 'selfheal-drift');
});

test('captureReminderTrigger requires both uncommitted changes AND enough ticks', () => {
  assert.strictEqual(captureReminderTrigger({ hasUncommittedChanges: false, tickCount: 999 }), null);
  assert.strictEqual(captureReminderTrigger({ hasUncommittedChanges: true, tickCount: 1 }), null);
  const nudge = captureReminderTrigger({ hasUncommittedChanges: true, tickCount: 10 });
  assert.strictEqual(nudge.command, 'capture');
});

test('dashboardStaleTrigger only fires once enough sessions have passed without a dashboard view', () => {
  assert.strictEqual(dashboardStaleTrigger({ sessionCount: 5, dashboardArchiveCount: 4 }), null);
  const nudge = dashboardStaleTrigger({ sessionCount: 5, dashboardArchiveCount: 1 });
  assert.strictEqual(nudge.command, 'dashboard');
  assert.match(nudge.reason, /4 sessions/);
});

// GETSITREP-51: session-end.js's dashboard fold reuses this exact exported
// constant rather than a hardcoded copy of "3" — this guards against the
// export and the trigger's own internal comparison silently diverging.
test('SESSIONS_WITHOUT_DASHBOARD_THRESHOLD is exported and matches what actually fires the trigger', () => {
  assert.strictEqual(typeof SESSIONS_WITHOUT_DASHBOARD_THRESHOLD, 'number');
  const atThreshold = dashboardStaleTrigger({ sessionCount: SESSIONS_WITHOUT_DASHBOARD_THRESHOLD, dashboardArchiveCount: 0 });
  const belowThreshold = dashboardStaleTrigger({ sessionCount: SESSIONS_WITHOUT_DASHBOARD_THRESHOLD - 1, dashboardArchiveCount: 0 });
  assert.ok(atThreshold, 'must fire exactly at the threshold');
  assert.strictEqual(belowThreshold, null, 'must not fire one session below the threshold');
});

test('handoffLongSessionTrigger and sitrepPeriodicTrigger both gate on tick thresholds', () => {
  assert.strictEqual(handoffLongSessionTrigger({ tickCount: 5 }), null);
  assert.strictEqual(handoffLongSessionTrigger({ tickCount: 40 }).command, 'handoff');
  assert.strictEqual(sitrepPeriodicTrigger({ tickCount: 5 }), null);
  assert.strictEqual(sitrepPeriodicTrigger({ tickCount: 15 }).command, 'sitrep');
});

test('tick-bucketed trigger ids change as tickCount grows past each new threshold multiple', () => {
  const first = sitrepPeriodicTrigger({ tickCount: 15 });
  const second = sitrepPeriodicTrigger({ tickCount: 30 });
  assert.notStrictEqual(first.triggerId, second.triggerId, 're-fires at the next milestone with a distinct id, not silenced forever');
});

test('evaluateTriggers returns every currently-eligible nudge, selfheal drift first', () => {
  const state = {
    driftResult: { drifted: ['x.md'] },
    hasUncommittedChanges: true,
    tickCount: 40,
    sessionCount: 10,
    dashboardArchiveCount: 0,
  };
  const nudges = evaluateTriggers(state);
  assert.ok(nudges.length >= 4, 'expected multiple eligible triggers at this state');
  assert.strictEqual(nudges[0].command, 'selfheal', 'real drift detection must outrank the softer proxy heuristics');
});

console.log(`\n${passed}/${passed} nudge-trigger tests passed`);
