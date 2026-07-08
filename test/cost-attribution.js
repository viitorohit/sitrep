#!/usr/bin/env node
// GETSITREP-48: unit tests for the cost-to-outcome attribution logic —
// pure functions, no CLI/filesystem involved, so these run as plain
// assertions rather than through the byte-identical CLI harness.

const assert = require('assert');
const { computeCostRollup, phaseForTaskId, extractPhaseSections } = require('../src/lib/cost-attribution');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const PLAN = `
# Test Plan

## Phase 1: Foundation — \`v0.1.0\` ✅

| # | Feature |
|---|---|
| 1.1 | thing |

## Phase 3: Sharper & Self-Sufficient — \`v0.3.0\`

| Story | Status |
|---|---|
| GETSITREP-8 — CLI extraction | ✅ Done (subtasks GETSITREP-9/10/12 all Done) |
`;

test('legacy N.X id resolves to its own phase number without scanning plan text', () => {
  assert.strictEqual(phaseForTaskId('3.4', []), 3);
  assert.strictEqual(phaseForTaskId('1.1', []), 1);
});

test('Jira key resolves via literal substring membership in a phase section', () => {
  const sections = extractPhaseSections(PLAN);
  assert.strictEqual(phaseForTaskId('GETSITREP-8', sections), 3);
  assert.strictEqual(phaseForTaskId('GETSITREP-9', sections), 3);
});

test('a key not literally present anywhere returns null, never a guess', () => {
  const sections = extractPhaseSections(PLAN);
  assert.strictEqual(phaseForTaskId('GETSITREP-12', sections), null);
  assert.strictEqual(phaseForTaskId('GETSITREP-999', sections), null);
});

test('computeCostRollup splits a session evenly across its distinct tickets', () => {
  const dataJson = {
    sessions: [
      { number: 1, tasks_completed: ['1.1', '1.2'], tokens: { total: 100 }, cost_usd: 2, cost_label: 'estimate' },
    ],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_ticket['1.1'].cost_usd, 1);
  assert.strictEqual(rollup.by_ticket['1.2'].cost_usd, 1);
  assert.strictEqual(rollup.by_phase['1'].cost_usd, 2);
  assert.deepStrictEqual(rollup.unattributed, []);
});

test('unattributed ids never remove money from a phase total when a sibling id resolves', () => {
  const dataJson = {
    sessions: [
      { number: 6, tasks_completed: ['GETSITREP-8', 'GETSITREP-12'], tokens: { total: 200 }, cost_usd: 4, cost_label: 'estimate' },
    ],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_phase['3'].cost_usd, 4, 'full session cost must land on phase 3, not half');
  assert.strictEqual(rollup.unattributed.length, 1);
  assert.deepStrictEqual(rollup.unattributed[0].ids, ['GETSITREP-12']);
});

test('a session with no completed tasks contributes nothing (no ticket to attribute to)', () => {
  const dataJson = {
    sessions: [{ number: 5, tasks_completed: [], tokens: { total: 999 }, cost_usd: 99, cost_label: 'estimate' }],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.deepStrictEqual(rollup.by_phase, {});
  assert.deepStrictEqual(rollup.by_ticket, {});
});

test('mixed actual/estimate sessions touching the same ticket are labeled "mixed", never blurred', () => {
  const dataJson = {
    sessions: [
      { number: 1, tasks_completed: ['1.1'], tokens: { total: 100 }, cost_usd: 1, cost_label: 'estimate' },
      { number: 2, tasks_completed: ['1.1'], tokens: { total: 100 }, cost_usd: 1, cost_label: 'actual' },
    ],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_ticket['1.1'].cost_label, 'mixed');
});

test('a session with no cost_usd (not tracked) still attributes tokens, cost stays 0', () => {
  const dataJson = {
    sessions: [{ number: 1, tasks_completed: ['1.1'], tokens: { total: 100 }, cost_usd: null, cost_label: 'estimate' }],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_ticket['1.1'].tokens, 100);
  assert.strictEqual(rollup.by_ticket['1.1'].cost_usd, 0);
});

// GETSITREP-44: model cost comparison — by_model attributes a session's
// FULL cost to its one model, with no splitting (unlike by_phase/by_ticket).
test('computeCostRollup attributes a session\'s full cost/tokens to its model, unsplit', () => {
  const dataJson = {
    sessions: [
      { number: 1, tasks_completed: ['1.1', '1.2'], tokens: { total: 100 }, cost_usd: 2, cost_label: 'estimate', model: 'claude-sonnet-5' },
    ],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_model['claude-sonnet-5'].cost_usd, 2, 'model bucket gets the full session cost, not a per-ticket share');
  assert.strictEqual(rollup.by_model['claude-sonnet-5'].tokens, 100);
});

test('computeCostRollup counts a session toward by_model even with zero completed tasks', () => {
  const dataJson = {
    sessions: [{ number: 5, tasks_completed: [], tokens: { total: 999 }, cost_usd: 99, cost_label: 'estimate', model: 'claude-opus-4-6' }],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_model['claude-opus-4-6'].cost_usd, 99, 'unlike by_phase/by_ticket, a session with no completed tasks still spent money on some model');
});

test('computeCostRollup defaults to "unknown" when a session record has no model field, and labels mixed models correctly', () => {
  const dataJson = {
    sessions: [
      { number: 1, tasks_completed: ['1.1'], tokens: { total: 100 }, cost_usd: 1, cost_label: 'estimate', model: 'claude-sonnet-5' },
      { number: 2, tasks_completed: ['1.2'], tokens: { total: 50 }, cost_usd: 0.5, cost_label: 'actual', model: 'claude-sonnet-5' },
      { number: 3, tasks_completed: [], tokens: { total: 10 }, cost_usd: 0.1, cost_label: 'estimate' },
    ],
  };
  const rollup = computeCostRollup(dataJson, PLAN);
  assert.strictEqual(rollup.by_model['claude-sonnet-5'].cost_label, 'mixed', 'one estimate session + one actual session must be labeled mixed, not silently one or the other');
  assert.strictEqual(rollup.by_model['unknown'].cost_usd, 0.1);
});

console.log(`\n${passed}/${passed} cost-attribution tests passed`);
