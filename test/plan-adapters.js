#!/usr/bin/env node
// GETSITREP-49: unit tests for the plan-adapter layer — pure functions plus
// real scratch-directory filesystem reads (mkdtemp), no CLI invocation.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readPlan, parseChecklistFile, readNativePlan } = require('../src/lib/plan-adapters');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function mkScratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'getsitrep-plan-adapter-test-'));
}

test('parseChecklistFile reads both OpenSpec ("1.1") and Spec Kit ("T001") ID conventions', () => {
  const content = [
    '# Tasks',
    '',
    '## 1. Setup',
    '- [ ] 1.1 Create ThemeContext',
    '- [x] 1.2 Add CSS custom properties',
    '',
    '- [ ] T001 Create project structure',
    '- [x] T002 [P] Configure linting',
  ].join('\n');
  const tasks = parseChecklistFile(content);
  assert.strictEqual(tasks.length, 4);
  assert.deepStrictEqual(
    tasks.map((t) => t.id),
    ['1.1', '1.2', 'T001', 'T002']
  );
  assert.deepStrictEqual(
    tasks.map((t) => t.done),
    [false, true, false, true]
  );
});

test('readPlan("openspec") aggregates across every openspec/changes/*/tasks.md', () => {
  const cwd = mkScratch();
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes', 'add-dark-mode'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'openspec', 'changes', 'update-auth-api'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, 'openspec', 'changes', 'add-dark-mode', 'tasks.md'),
    '- [x] 1.1 Create ThemeContext\n- [ ] 1.2 Add toggle component\n'
  );
  fs.writeFileSync(
    path.join(cwd, 'openspec', 'changes', 'update-auth-api', 'tasks.md'),
    '- [x] 1.1 Update token schema\n'
  );
  const plan = readPlan({ planSource: 'openspec' }, { cwd });
  assert.strictEqual(plan.available, true);
  assert.strictEqual(plan.source, 'openspec');
  assert.strictEqual(plan.totalTasks, 3);
  assert.strictEqual(plan.doneTasks, 2);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('readPlan("openspec") reports unavailable, never throws, when openspec/changes/ is missing', () => {
  const cwd = mkScratch();
  const plan = readPlan({ planSource: 'openspec' }, { cwd });
  assert.strictEqual(plan.available, false);
  assert.match(plan.note, /no openspec\/changes\/ directory found/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('readPlan("speckit") aggregates across every specs/*/tasks.md', () => {
  const cwd = mkScratch();
  fs.mkdirSync(path.join(cwd, 'specs', '001-taskify'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, 'specs', '001-taskify', 'tasks.md'),
    '- [ ] T001 Create project structure\n- [x] T002 [P] Configure linting\n'
  );
  const plan = readPlan({ planSource: 'speckit' }, { cwd });
  assert.strictEqual(plan.available, true);
  assert.strictEqual(plan.totalTasks, 2);
  assert.strictEqual(plan.doneTasks, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('readPlan("jira") honestly reports "not yet built" rather than silently falling back', () => {
  const plan = readPlan({ planSource: 'jira' }, {});
  assert.strictEqual(plan.available, false);
  assert.strictEqual(plan.source, 'jira');
  assert.match(plan.note, /not yet built/);
});

test('readPlan defaults to native when no config exists yet', () => {
  const plan = readPlan(null, { statusContent: null });
  assert.strictEqual(plan.source, 'native');
  assert.strictEqual(plan.available, false);
});

test('readNativePlan sums plain-integer phases and skips hybrid Story-tracked phases', () => {
  const planContent = '# Plan\n\n## Phase 1: Foundation\n';
  const statusContent = [
    '## Progress Dashboard',
    '',
    '| Phase | Name | Tasks | Done | Bar |',
    '|-------|------|-------|------|-----|',
    '| 1 | Foundation | 8 | 8 | ██████████ 100% |',
    '| 2 | Operations Layer | 15 | 15 | ██████████ 100% |',
    '| 3 | Sharper & Self-Sufficient | 9 Stories | 9 | ██████████ 100% |',
    '| **TOTAL** | | **32** | **32** | |',
  ].join('\n');
  const plan = readNativePlan(planContent, statusContent);
  assert.strictEqual(plan.available, true);
  // Phase 3 is hybrid ("9 Stories") -- must be skipped, not misparsed as 9.
  assert.strictEqual(plan.totalTasks, 23);
  assert.strictEqual(plan.doneTasks, 23);
  assert.strictEqual(plan.tasks.length, 2);
});

test('readNativePlan stays available:true when PROJECT_PLAN.md is real but the dashboard table is missing/malformed', () => {
  // Regression test: a missing/broken Progress Dashboard table must never
  // be conflated with "no plan exists" -- those are different problems
  // (selfheal's checkFileIntegrity owns flagging the former separately).
  const planContent = '# Real Plan\n\n## Phase 1: Foundation\n\nLots of real content here.\n';
  const plan = readNativePlan(planContent, '# Status\n\nNo dashboard table in this file.\n');
  assert.strictEqual(plan.available, true, 'a real plan must not be reported as unavailable');
  assert.strictEqual(plan.totalTasks, 0);
  assert.match(plan.note, /task counts unavailable/);
});

test('readNativePlan reports unavailable only when PROJECT_PLAN.md itself is missing', () => {
  const plan = readNativePlan(null, '## Progress Dashboard\n\n| Phase | Name | Tasks | Done | Bar |\n|---|---|---|---|---|\n');
  assert.strictEqual(plan.available, false);
  assert.match(plan.note, /PROJECT_PLAN\.md not found/);
});

console.log(`\n${passed}/${passed} plan-adapter tests passed`);
