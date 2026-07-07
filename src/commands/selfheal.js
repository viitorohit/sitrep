// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Usage: selfheal [deep]
//
// Scope note: this implements Check 1 (File Structure, with auto-fix) and
// Check 2 (File Integrity — section presence, report-only) from
// commands/selfheal.md. Checks 3-5 (cross-file consistency recalculation,
// progress-bar/total recomputation, and the "deep" codebase scan) are not
// implemented in this pass — they need substantially more table-parsing and
// recalculation logic than Checks 1-2, and are left as a known gap rather
// than rushed. `mode === 'deep'` is accepted as a valid argument (per the
// canon) but currently has no additional effect beyond Checks 1-2.
//
// The command directory check is intentionally not yet config-driven
// (docs/specs/adapter-contract.md's adapter config doesn't exist as running
// code yet — GETSITREP-36 only defined the contract) — it checks
// `.claude/commands/` as the one real platform in use today, with a comment
// marking this as the spot to make config-driven once an adapter exists.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, writeFile, ensureDir, exists } = require('../lib/fs-helpers');
const paths = require('../lib/paths');
const { commit } = require('../lib/git');
const { computeManifest, readHashManifest, writeHashManifest, diffManifest } = require('../lib/manifest');
const { CANON_COMMANDS } = require('../lib/canon');
const fs = require('fs');
const path = require('path');

const SPEC = {
  positional: { name: 'mode', oneOf: ['deep'], default: null },
};

// TODO(GETSITREP-36 follow-up): read this from adapter config once one
// exists, instead of hardcoding Claude Code's path.
const COMMAND_DIR = () => path.join(process.cwd(), '.claude', 'commands');

function checkFileStructure() {
  const fixed = [];
  const cannotFix = [];

  if (!exists(paths.SITREP_DIR())) {
    ensureDir(paths.SITREP_DIR());
    fixed.push('Created sitrep/ directory');
  }

  for (const [label, filePath] of [
    ['MANIFEST.md', paths.MANIFEST()],
    ['PROJECT_PLAN.md', paths.PROJECT_PLAN()],
    ['STATUS_REPORT.md', paths.STATUS_REPORT()],
  ]) {
    if (!exists(filePath)) {
      cannotFix.push(`sitrep/${label} is missing (run plan-update or session-end to create it)`);
    }
  }

  for (const [label, dirPath] of [
    ['history/sessions', paths.HISTORY_SESSIONS()],
    ['history/handoffs', paths.HISTORY_HANDOFFS()],
    ['history/dashboards', paths.HISTORY_DASHBOARDS()],
  ]) {
    if (!exists(dirPath)) {
      ensureDir(dirPath);
      fixed.push(`Created sitrep/${label}/`);
    }
  }

  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const gitignoreContent = readIfExists(gitignorePath) || '';
  if (!gitignoreContent.includes('sitrep/.sitrep-active-session')) {
    const updated = gitignoreContent.length > 0 && !gitignoreContent.endsWith('\n')
      ? gitignoreContent + '\n' + 'sitrep/.sitrep-active-session\n'
      : gitignoreContent + 'sitrep/.sitrep-active-session\n';
    writeFile(gitignorePath, updated);
    fixed.push('Added sitrep/.sitrep-active-session to .gitignore');
  }

  const commandDir = COMMAND_DIR();
  if (exists(commandDir)) {
    const present = fs.readdirSync(commandDir).map((f) => f.replace(/\.md$/, ''));
    const missing = CANON_COMMANDS.filter((c) => !present.includes(c));
    if (missing.length > 0) {
      cannotFix.push(`Missing command file(s) in ${path.relative(process.cwd(), commandDir)}/: ${missing.join(', ')}`);
    }
  } else {
    cannotFix.push(`Command directory not found at ${path.relative(process.cwd(), commandDir)}/`);
  }

  return { fixed, cannotFix };
}

function checkFileIntegrity() {
  const cannotFix = [];

  const planContent = readIfExists(paths.PROJECT_PLAN());
  if (planContent) {
    for (const section of ['Key Decisions', 'Risk Register', 'Future']) {
      if (!new RegExp(`##\\s*${section}`, 'i').test(planContent)) {
        cannotFix.push(`PROJECT_PLAN.md is missing a "${section}" section`);
      }
    }
  }

  const statusContent = readIfExists(paths.STATUS_REPORT());
  if (statusContent) {
    for (const section of ['Active Sprint', 'Progress Dashboard', 'Session Log', 'Blockers', 'Changes']) {
      if (!new RegExp(`##\\s*${section}`, 'i').test(statusContent)) {
        cannotFix.push(`STATUS_REPORT.md is missing a "${section}" section`);
      }
    }
  }

  return { cannotFix };
}

// GETSITREP-29: create the baseline hash manifest the first time one is
// missing. Comparing against it is checkDrift() below (GETSITREP-30); acting
// on drift (lock/diff/restore, upgrade warnings) is GETSITREP-31.
function checkManifestBaseline() {
  const fixed = [];

  if (!exists(paths.HASH_MANIFEST())) {
    const manifest = computeManifest();
    if (Object.keys(manifest.files).length > 0) {
      writeHashManifest(manifest);
      const count = Object.keys(manifest.files).length;
      fixed.push(`Created baseline hash manifest (sitrep/.sitrep-manifest.json) for ${count} file(s), keyed to v${manifest.version}`);
    }
  }

  return { fixed };
}

// GETSITREP-30: compare the baseline manifest against current disk state.
// Purely informational — never blocks, never auto-fixes, and never
// mutates the baseline (Hard Law #5: fail-open, non-interactive). Every
// modified file is reported regardless of intent; locking a file out of
// this report, or restoring/re-baselining, is GETSITREP-31's job.
function checkDrift(baseline) {
  if (!baseline) {
    return { checked: false, modified: [], added: [], removed: [] };
  }

  const current = computeManifest();
  return { checked: true, ...diffManifest(baseline, current) };
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('selfheal', parsed.values, parsed.errors.join('; '));
  }

  const structure = checkFileStructure();
  const integrity = checkFileIntegrity();
  const manifestBaseline = checkManifestBaseline();
  const baselineManifest = readHashManifest();
  const drift = checkDrift(baselineManifest);

  const allFixed = [...structure.fixed, ...manifestBaseline.fixed];
  const allCannotFix = [...structure.cannotFix, ...integrity.cannotFix];
  const driftCount = drift.modified.length + drift.added.length + drift.removed.length;

  let gitNote = '';
  if (allFixed.length > 0) {
    const gitResult = commit(['sitrep/', '.gitignore'], `sitrep: selfheal — ${allFixed.join('; ')}`);
    gitNote = gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`;
  }

  const manifestLine = baselineManifest
    ? `Manifest Baseline: ✅ ${Object.keys(baselineManifest.files).length} file(s) tracked (v${baselineManifest.version})`
    : 'Manifest Baseline: ⚠️ Not created (no command MDs or MANIFEST.md found to hash)';

  const driftLine = !drift.checked
    ? 'Manifest Drift:  ⏭️ Skipped (no baseline yet)'
    : driftCount === 0
      ? 'Manifest Drift:  ✅ No drift since baseline'
      : `Manifest Drift:  ⚠️ ${driftCount} file(s) changed since baseline`;

  const lines = [
    '=== SELFHEAL ===',
    `File Structure:  ${structure.fixed.length === 0 && structure.cannotFix.length === 0 ? '✅ All good' : '⚠️ see below'}`,
    `File Integrity:  ${integrity.cannotFix.length === 0 ? '✅ Clean' : '⚠️ see below'}`,
    manifestLine,
    driftLine,
    parsed.values.mode === 'deep' ? 'Codebase Sync:   ⏭️ Not yet implemented in the CLI (Checks 3-5 are a known gap)' : 'Codebase Sync:   ⏭️ Skipped (run selfheal deep — note: not yet implemented)',
    '',
  ];

  if (allFixed.length > 0) {
    lines.push('Auto-fixed:');
    for (const f of allFixed) lines.push(`  - ${f}`);
    lines.push('');
  }

  if (allCannotFix.length > 0) {
    lines.push('Needs human input:');
    for (const c of allCannotFix) lines.push(`  - ${c}`);
    lines.push('');
  }

  if (driftCount > 0) {
    lines.push(`Drift since baseline (v${baselineManifest.version}):`);
    for (const f of drift.modified) lines.push(`  - Modified: ${f}`);
    for (const f of drift.added) lines.push(`  - Added: ${f}`);
    for (const f of drift.removed) lines.push(`  - Removed: ${f}`);
    lines.push('  (informational only — locking/restoring drifted files isn\'t implemented yet, GETSITREP-31)');
    lines.push('');
  }

  const hasDrift = driftCount > 0;
  if (allFixed.length === 0 && allCannotFix.length === 0 && !hasDrift) {
    lines.push('Overall: ✅ Healthy');
  } else {
    const parts = [];
    if (allFixed.length > 0) parts.push(`${allFixed.length} fixed`);
    if (allCannotFix.length > 0) parts.push(`${allCannotFix.length} need input`);
    if (hasDrift) parts.push(`${driftCount} drifted (informational)`);
    lines.push(`Overall: ⚠️ ${parts.join(', ')}`);
  }
  if (gitNote) lines.push(gitNote);
  lines.push('===========================');

  return ok('selfheal', parsed.values, lines.join('\n'));
}

module.exports = { name: 'selfheal', execute };
