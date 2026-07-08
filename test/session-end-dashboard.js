#!/usr/bin/env node
// GETSITREP-51: verifies session-end's dashboard fold (ADR-0007) — the
// threshold-gated regeneration must never produce a second, separate
// commit, must never block session-end's own commit if dashboard
// generation fails, and must only fire once the shared staleness signal
// (dashboardStaleTrigger) says the dashboard is stale enough.
//
// This needs a REAL git repo (unlike test/byte-identical.js's tmp copies,
// which are never git-initialized, so commit() always no-ops there) since
// the core assertion is "exactly one commit happened."

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const FIXTURE = path.join(__dirname, 'fixtures', 'sitrep-project');

let passed = 0;
const failures = [];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });
}

function commitCount(cwd) {
  try {
    return parseInt(git(cwd, ['rev-list', '--count', 'HEAD']).trim(), 10);
  } catch {
    return 0;
  }
}

function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'getsitrep-dashboard-test-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  git(dir, ['init', '--quiet']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test Runner']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'initial fixture commit']);
  return dir;
}

// Bumps the fixture's recorded session count so the NEXT session-end run
// lands at a chosen total (the fixture starts at session 1) — lets each
// case reach a specific point relative to SESSIONS_WITHOUT_DASHBOARD_THRESHOLD
// without depending on that constant's exact value here.
function bumpSessionCountTo(dir, targetCurrentTotal) {
  const dataPath = path.join(dir, 'sitrep', '.sitrep-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  while (data.sessions.length < targetCurrentTotal) {
    const n = data.sessions.length + 1;
    data.sessions.push({
      number: n,
      date: '2026-01-01',
      user: 'Test Owner',
      focus: `filler session ${n}`,
      tasks_completed: [],
      tasks_in_progress: [],
      tasks_blocked: [],
      blockers: [],
      decisions: [],
      tokens: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 },
      cost_usd: 0,
      cost_label: 'estimate',
      cost_source: 'manual_estimate',
      model: 'test',
      duration_minutes: 0,
      notes: '',
    });
  }
  data.totals.sessions = data.sessions.length;
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'bump session count for test setup']);
}

async function runSessionEnd(dir, dataOverride) {
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalError = console.error;
  const captured = [];

  process.chdir(dir);
  console.log = (...args) => captured.push(args.join(' '));
  console.error = (...args) => captured.push(args.join(' '));
  process.exitCode = undefined;

  try {
    delete require.cache[require.resolve('../src/cli')];
    const argv = ['session-end', '--data', JSON.stringify(dataOverride)];
    await require('../src/cli').run(argv);
    return { stdout: captured.join('\n'), exitCode: process.exitCode ?? 0 };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = undefined;
    process.chdir(originalCwd);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function main() {
  await test('below threshold: no dashboard write, exactly one commit', async () => {
    const dir = setupGitFixture();
    try {
      const before = commitCount(dir);
      const result = await runSessionEnd(dir, { focus: 'below threshold test' });
      assert.ok(result.stdout.includes('Dashboard: up to date'), result.stdout);
      assert.ok(!fs.existsSync(path.join(dir, 'sitrep', 'dashboard.html')), 'dashboard.html must not be created below the threshold');
      assert.strictEqual(commitCount(dir), before + 1, 'exactly one new commit expected');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('at threshold: dashboard regenerated, still exactly one commit (no double-commit)', async () => {
    const dir = setupGitFixture();
    try {
      // Fixture starts at 1 recorded session; bump to 2 so this session-end
      // call becomes session 3 (sessionsSinceDashboard = 3 - 0 = 3).
      bumpSessionCountTo(dir, 2);
      const before = commitCount(dir);
      const result = await runSessionEnd(dir, { focus: 'at threshold test' });
      assert.ok(result.stdout.includes('Dashboard: regenerated'), result.stdout);
      assert.ok(fs.existsSync(path.join(dir, 'sitrep', 'dashboard.html')), 'dashboard.html must be created at the threshold');
      assert.strictEqual(commitCount(dir), before + 1, 'exactly one new commit expected, not two');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('dashboard generation failure degrades to a warning, never blocks the commit', async () => {
    const dir = setupGitFixture();
    try {
      bumpSessionCountTo(dir, 2);
      // Force a deterministic write error: dashboard.html is a directory,
      // so fs.writeFileSync (and archivePreviousDashboard's copyFileSync)
      // both throw EISDIR when generate() tries to write to that path.
      fs.mkdirSync(path.join(dir, 'sitrep', 'dashboard.html'));
      const before = commitCount(dir);
      const result = await runSessionEnd(dir, { focus: 'forced failure test' });
      assert.strictEqual(result.exitCode, 0, 'session-end must still succeed overall');
      assert.ok(result.stdout.includes('Dashboard: regeneration failed'), result.stdout);
      assert.strictEqual(commitCount(dir), before + 1, 'the commit must still happen despite the dashboard failure');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  console.log('');
  console.log(`${passed}/${passed + failures.length} session-end-dashboard tests passed`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
