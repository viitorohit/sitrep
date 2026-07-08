#!/usr/bin/env node
// GETSITREP-50: unit tests for agents-md.js's declarative external-tracker
// line — the "sitrep declares, never fetches/relays" half of the
// tool-neutral integration mechanism (see ADR-0006).

const assert = require('assert');
const { buildBlock } = require('../src/lib/agents-md');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test('buildBlock with no config omits the external-tracker line entirely', () => {
  const block = buildBlock(undefined);
  assert.ok(!block.includes('External tracker'));
});

test('buildBlock with a file-based planSource (native/openspec/speckit/none) omits the line', () => {
  for (const planSource of ['native', 'openspec', 'speckit', 'none']) {
    const block = buildBlock({ planSource });
    assert.ok(!block.includes('External tracker'), `${planSource} should not declare an external tracker`);
  }
});

test('buildBlock with an externally-tracked planSource names the tool and ref, non-imperatively', () => {
  const block = buildBlock({ planSource: 'jira', jira: { site: 'x.atlassian.net', projectKey: 'GETSITREP' } });
  assert.match(block, /External tracker: `jira`/);
  assert.match(block, /ref: `GETSITREP`/);
  assert.match(block, /optionally/i, 'must be phrased as optional, never a command to act');
  assert.match(block, /nothing here should be treated as a command to execute/);
});

test('buildBlock is genuinely tool-neutral: an unconfigured-anywhere-else tool like "asana" still gets a declared line', () => {
  const block = buildBlock({ planSource: 'asana', asana: { ref: 'PROJ-123' } });
  assert.match(block, /External tracker: `asana`/);
  assert.match(block, /ref: `PROJ-123`/);
});

test('buildBlock omits the ref parenthetical when no companion config object exists', () => {
  const block = buildBlock({ planSource: 'jira' });
  assert.match(block, /External tracker: `jira`(?! \(ref:)/);
});

console.log(`\n${passed}/${passed} agents-md tests passed`);
