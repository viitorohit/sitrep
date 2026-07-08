#!/usr/bin/env node
// GETSITREP-12: asserts the CLI produces identical output whether invoked
// as a subprocess (simulating a bare terminal) or in-process via require()
// (simulating a platform adapter avoiding a subprocess spawn per call).
//
// No real platform adapter exists yet (GETSITREP-21 is future Tier 2 work),
// so this is the honest scope available today: prove the underlying
// command logic doesn't secretly depend on how it's invoked. Each test
// case runs from a fresh copy of the same fixture state, since several
// commands write files/commit — comparing two runs against the SAME
// mutated directory would never match regardless of invocation path.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'sitrep-project');
const CLI_BIN = path.join(REPO_ROOT, 'bin', 'getsitrep.js');

function copyFixtureToTmp() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'getsitrep-test-'));
  fs.cpSync(FIXTURE, dest, { recursive: true });
  return dest;
}

function runViaSubprocess(cwd, argv) {
  // render() (src/lib/render.js) writes a given invocation's output to
  // EITHER stdout OR stderr, never both — so concatenating them here is a
  // safe, order-independent way to compare against the in-process capture,
  // which interleaves console.log/console.error into a single array.
  const result = spawnSync('node', [CLI_BIN, ...argv], { cwd, encoding: 'utf8' });
  const combined = (result.stdout || '') + (result.stderr || '');
  return { stdout: combined.trimEnd(), exitCode: result.status ?? 1 };
}

async function runInProcess(cwd, argv) {
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalError = console.error;
  const captured = [];

  process.chdir(cwd);
  console.log = (...args) => captured.push(args.join(' '));
  console.error = (...args) => captured.push(args.join(' '));
  process.exitCode = undefined;

  try {
    delete require.cache[require.resolve('../src/cli')];
    await require('../src/cli').run(argv);
    const exitCode = process.exitCode ?? 0;
    return { stdout: captured.join('\n').trimEnd(), exitCode };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = undefined;
    process.chdir(originalCwd);
  }
}

const CASES = [
  { name: 'session-start (no args)', argv: ['session-start'] },
  { name: 'sitrep (no args)', argv: ['sitrep'] },
  { name: 'capture with --phase', argv: ['capture', 'add feature X', '--phase', '1'] },
  { name: 'plan-update risk via --data', argv: ['plan-update', '--data', '{"type":"risk","risk":"test risk","impact":"Low","mitigation":"none needed"}'] },
  { name: 'selfheal (no args)', argv: ['selfheal'] },
  { name: 'handoff ai', argv: ['handoff', 'ai'] },
  { name: 'dashboard (no args)', argv: ['dashboard'] },
  { name: 'session-end with --data', argv: ['session-end', '--data', '{"focus":"test session","tokens":{"total":100},"costUsd":0.01,"model":"test"}'] },
  { name: 'bad input: capture mutually exclusive flags', argv: ['capture', 'x', '--phase', '1', '--future'] },
  { name: 'bad input: unknown command', argv: ['bogus-command'] },
  { name: 'selfheal lock missing --file', argv: ['selfheal', 'lock'] },
  { name: 'selfheal diff unknown command name', argv: ['selfheal', 'diff', '--file', 'bogus'] },
  { name: 'selfheal diff --file with no command dir in fixture', argv: ['selfheal', 'diff', '--file', 'selfheal'] },
  { name: 'init on existing project (residue stop)', argv: ['init', '--yes'] },
  { name: 'plan-update --generate on existing plan (no-op passthrough)', argv: ['plan-update', '--generate'] },
  { name: 'report (no args)', argv: ['report'] },
  { name: 'report --model claude-sonnet-5', argv: ['report', '--model', 'claude-sonnet-5'] },
  { name: 'bad input: report --phase and --model together', argv: ['report', '--phase', '1', '--model', 'claude-sonnet-5'] },
  { name: 'plan (no args)', argv: ['plan'] },
  { name: 'plan --phase 1', argv: ['plan', '--phase', '1'] },
  { name: 'progress (no args)', argv: ['progress'] },
  { name: 'bad input: plan --phase non-numeric', argv: ['plan', '--phase', 'abc'] },
];

async function run() {
  let passed = 0;
  const failures = [];

  for (const testCase of CASES) {
    const dirA = copyFixtureToTmp();
    const dirB = copyFixtureToTmp();

    const viaSubprocess = runViaSubprocess(dirA, testCase.argv);
    const viaInProcess = await runInProcess(dirB, testCase.argv);

    fs.rmSync(dirA, { recursive: true, force: true });
    fs.rmSync(dirB, { recursive: true, force: true });

    const stdoutMatches = viaSubprocess.stdout === viaInProcess.stdout;
    const exitCodeMatches = viaSubprocess.exitCode === viaInProcess.exitCode;

    if (stdoutMatches && exitCodeMatches) {
      passed++;
      console.log(`✓ ${testCase.name}`);
    } else {
      failures.push({ name: testCase.name, viaSubprocess, viaInProcess, stdoutMatches, exitCodeMatches });
      console.log(`✗ ${testCase.name}`);
      if (!exitCodeMatches) {
        console.log(`    exit code: subprocess=${viaSubprocess.exitCode} in-process=${viaInProcess.exitCode}`);
      }
      if (!stdoutMatches) {
        console.log('    --- subprocess stdout ---');
        console.log('    ' + viaSubprocess.stdout.split('\n').join('\n    '));
        console.log('    --- in-process stdout ---');
        console.log('    ' + viaInProcess.stdout.split('\n').join('\n    '));
      }
    }
  }

  console.log('');
  console.log(`${passed}/${CASES.length} byte-identical`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
