#!/usr/bin/env node
// GETSITREP-51: unit tests for the report/plan/progress pure formatting
// helpers — no filesystem/CLI involved, same style as test/cost-attribution.js
// and test/nudge-triggers.js.

const assert = require('assert');
const { buildReportLines } = require('../src/commands/report');
const { buildPlanLines } = require('../src/commands/plan');
const { buildProgressLines } = require('../src/commands/progress');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const PLAN = `
# Test Plan

## Phase 1: Foundation — \`v0.1.0\`

| # | Feature |
|---|---|
| 1.1 | thing |

## Phase 3: Sharper — \`v0.3.0\`

| Story | Status |
|---|---|
| GETSITREP-8 | Done |
`;

const STATUS = `
# Test Status

> **Last Updated:** 2026-01-01 — Session 1

## Progress Dashboard

| Phase | Name | Tasks | Done | Bar |
|-------|------|-------|------|-----|
| 1 | Foundation | 8 | 8 | ██████████ 100% |
| 3 | Sharper | 9 Stories | 4 | ████░░░░░░ 44% |
| TOTAL | | 17 | 12 | |
`;

const PHASE_HEADINGS = [
  { number: 1, name: 'Foundation' },
  { number: 3, name: 'Sharper' },
];

// --- report ---

test('buildReportLines: no cost_rollup at all -> honest "no cost data" guard, never crashes', () => {
  const lines = buildReportLines({
    dataJson: null,
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
  });
  assert.ok(lines.some((l) => l.includes('No cost data yet')));
});

test('buildReportLines: dataJson present but cost_rollup missing -> same guard', () => {
  const lines = buildReportLines({
    dataJson: { sessions: [] },
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
  });
  assert.ok(lines.some((l) => l.includes('No cost data yet')));
});

const ROLLUP = {
  by_phase: {
    1: { tokens: 100, cost_usd: 1, cost_label: 'estimate', sessions: [1] },
    3: { tokens: 200, cost_usd: 2, cost_label: 'mixed', sessions: [2, 3] },
  },
  by_ticket: {
    '1.1': { tokens: 100, cost_usd: 1, cost_label: 'estimate', sessions: [1] },
    'GETSITREP-8': { tokens: 200, cost_usd: 2, cost_label: 'mixed', sessions: [2, 3] },
  },
  unattributed: [{ session: 4, ids: ['GETSITREP-99'] }],
};

test('buildReportLines: default view shows per-phase names, top tickets, and unattributed transparency note', () => {
  const lines = buildReportLines({
    dataJson: { cost_rollup: ROLLUP },
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
  });
  const text = lines.join('\n');
  assert.ok(text.includes('Phase 1: Foundation'));
  assert.ok(text.includes('Phase 3: Sharper'));
  assert.ok(text.includes('GETSITREP-8'));
  assert.ok(text.includes('could not be attributed to a phase'), 'must not read as missing money');
});

test('buildReportLines: "mixed" cost_label is called out explicitly, never silently collapsed', () => {
  const lines = buildReportLines({
    dataJson: { cost_rollup: ROLLUP },
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
  });
  assert.ok(lines.some((l) => l.includes('mixed')));
});

test('buildReportLines: --ticket filter hit and miss', () => {
  const hit = buildReportLines({
    dataJson: { cost_rollup: ROLLUP },
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
    ticketFilter: '1.1',
  });
  assert.ok(hit.some((l) => l.includes('Ticket 1.1')));

  const miss = buildReportLines({
    dataJson: { cost_rollup: ROLLUP },
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
    ticketFilter: 'NOPE-1',
  });
  assert.ok(miss.some((l) => l.includes('No cost recorded for ticket')));
});

test('buildReportLines: --phase filter for an unknown phase lists known phases instead of guessing', () => {
  const lines = buildReportLines({
    dataJson: { cost_rollup: ROLLUP },
    phaseHeadings: PHASE_HEADINGS,
    planSource: 'native',
    planAvailable: true,
    planNote: null,
    phaseFilter: '99',
  });
  assert.ok(lines.some((l) => l.includes('not found')));
  assert.ok(lines.some((l) => l.includes('1, 3')));
});

// --- plan ---

test('buildPlanLines: native, no --phase -> overview lists every dashboard row', () => {
  const plan = { source: 'native', available: true, tasks: [], totalTasks: 17, doneTasks: 12, note: null };
  const lines = buildPlanLines(plan, undefined, PLAN, STATUS);
  const text = lines.join('\n');
  assert.ok(text.includes('Phase 1: Foundation'));
  assert.ok(text.includes('Phase 3: Sharper'));
  assert.ok(text.includes('9 Stories'), 'hybrid Story-tracked phase must show its raw text, not a recomputed count');
});

test('buildPlanLines: native, --phase 1 -> full phase body content', () => {
  const plan = { source: 'native', available: true, tasks: [], totalTasks: 17, doneTasks: 12, note: null };
  const lines = buildPlanLines(plan, '1', PLAN, STATUS);
  const text = lines.join('\n');
  assert.ok(text.includes('Foundation'));
  assert.ok(text.includes('| 1.1 | thing |'), 'must include the raw phase section body, not just the heading');
});

test('buildPlanLines: native, --phase for a number not in PROJECT_PLAN.md -> not-found + known phases', () => {
  const plan = { source: 'native', available: true, tasks: [], totalTasks: 17, doneTasks: 12, note: null };
  const lines = buildPlanLines(plan, '99', PLAN, STATUS);
  const text = lines.join('\n');
  assert.ok(text.includes('not found'));
  assert.ok(text.includes('1, 3'));
});

test('buildPlanLines: openspec source with --phase -> explicit "not applicable", never empty/wrong data', () => {
  const plan = {
    source: 'openspec',
    available: true,
    tasks: [
      { id: '1', description: 'a', done: true, group: 'add-foo' },
      { id: '2', description: 'b', done: false, group: 'add-bar' },
    ],
    totalTasks: 2,
    doneTasks: 1,
    note: null,
  };
  const lines = buildPlanLines(plan, '1', PLAN, STATUS);
  const text = lines.join('\n');
  assert.ok(text.includes('not applicable'));
  assert.ok(text.includes('add-foo'));
  assert.ok(text.includes('add-bar'));
});

test('buildPlanLines: external (jira) source with --phase -> aggregate-only message, not silently empty', () => {
  const plan = { source: 'jira', available: true, tasks: [], totalTasks: 5, doneTasks: 2, note: 'jira status as of now' };
  const lines = buildPlanLines(plan, '1', PLAN, STATUS);
  assert.ok(lines.some((l) => l.includes('aggregate-only')));
});

test('buildPlanLines: source unavailable -> note surfaced, never a throw', () => {
  const plan = { source: 'jira', available: false, tasks: [], totalTasks: 0, doneTasks: 0, note: 'no --plan-data provided' };
  const lines = buildPlanLines(plan, undefined, PLAN, STATUS);
  assert.ok(lines.some((l) => l.includes('no --plan-data provided')));
});

// --- progress ---

test('buildProgressLines: available with tasks -> renders a bar', () => {
  const plan = { source: 'native', available: true, tasks: [], totalTasks: 10, doneTasks: 4, note: null };
  const lines = buildProgressLines(plan);
  assert.ok(lines.some((l) => l.includes('4/10 tasks done')));
});

test('buildProgressLines: zero total tasks -> note shown, no divide-by-zero crash', () => {
  const plan = { source: 'native', available: true, tasks: [], totalTasks: 0, doneTasks: 0, note: 'no Progress Dashboard table found' };
  const lines = buildProgressLines(plan);
  assert.ok(lines.some((l) => l.includes('no Progress Dashboard table found')));
});

test('buildProgressLines: unavailable -> note shown, never a throw', () => {
  const plan = { source: 'none', available: false, tasks: [], totalTasks: 0, doneTasks: 0, note: 'no plan source configured' };
  const lines = buildProgressLines(plan);
  assert.ok(lines.some((l) => l.includes('no plan source configured')));
});

console.log(`\n${passed}/${passed} plan-commands tests passed`);
