// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Usage: selfheal [deep]
//        selfheal lock --file <name>      Accept a drifted file as intentional
//        selfheal unlock --file <name>    Resume drift monitoring on a locked file
//        selfheal diff --file <name>      Show live file vs. the canonical shipped version
//        selfheal restore --file <name> [--force]   Overwrite live file with the canonical version
//
// Scope note: the default (no-mode) run implements Check 1 (File Structure,
// with auto-fix), Check 2 (File Integrity — section presence, report-only),
// Check 3 (Cross-File Consistency), and Check 4 (Progress Accuracy) from
// commands/selfheal.md, plus the GETSITREP-29/30 manifest baseline and drift
// report. Check 5 (the "deep" codebase scan) runs only behind `mode ===
// 'deep'`, per the canon — and even there, its "flag code not tracked in
// any task" bullet stays an explicit, documented gap (an LLM-judgment task,
// not a deterministic one); see checkCodebaseSync()'s own comment.
//
// Checks 3/4 degrade gracefully rather than misfire: this project's own
// PROJECT_PLAN.md/STATUS_REPORT.md mix legacy plain-integer task counts
// (Phases 1-2) with Jira-Story tracking ("9 Stories", Phase 3+) — anything
// that isn't a plain integer once bold-markers are stripped is treated as
// "not applicable, hybrid tracking" and skipped rather than guessed at or
// force-fit into a number. See src/lib/markdown.js's isPlainInteger.
//
// lock/unlock/diff/restore are GETSITREP-31. There's no `getsitrep upgrade`
// command to protect (that would need GETSITREP-17's init/upgrade flow), so
// `restore` — the one write-path today that can clobber a customized
// command file — is where the "warn before overwrite, offer a diff" upgrade
// -protection behavior actually lives.
//
// The command directory check is intentionally not yet config-driven
// (docs/specs/adapter-contract.md's adapter config doesn't exist as running
// code yet — GETSITREP-36 only defined the contract) — it checks
// `.claude/commands/` as the one real platform in use today, with a comment
// marking this as the spot to make config-driven once an adapter exists.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, writeFile, ensureDir, exists, readJsonIfExists, writeJson } = require('../lib/fs-helpers');
const paths = require('../lib/paths');
const { commit, tagExists, logSearch } = require('../lib/git');
const {
  stripBold,
  isPlainInteger,
  extractPhaseHeadings,
  extractProgressDashboardTable,
  renderProgressBar,
  replaceTableRowCells,
  extractActiveSprintIds,
  extractActiveSprintRows,
  countSessionLogEntries,
  extractHeaderField,
} = require('../lib/markdown');
const {
  computeManifest,
  readHashManifest,
  writeHashManifest,
  diffManifest,
  lockPath,
  unlockPath,
  hashContent,
  commandDir,
  readCanonicalFile,
} = require('../lib/manifest');
const { diffLines, formatDiff } = require('../lib/diff');
const { CANON_COMMANDS } = require('../lib/canon');
const fs = require('fs');
const path = require('path');

const FILE_ACTIONS = ['lock', 'unlock', 'diff', 'restore'];

const SPEC = {
  positional: { name: 'mode', oneOf: ['deep', ...FILE_ACTIONS], default: null },
  flags: {
    file: { type: 'value' },
    force: { type: 'boolean' },
  },
};

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

  const cmdDir = commandDir();
  if (exists(cmdDir)) {
    const present = fs.readdirSync(cmdDir).map((f) => f.replace(/\.md$/, ''));
    const missing = CANON_COMMANDS.filter((c) => !present.includes(c));
    if (missing.length > 0) {
      cannotFix.push(`Missing command file(s) in ${path.relative(process.cwd(), cmdDir)}/: ${missing.join(', ')}`);
    }
  } else {
    cannotFix.push(`Command directory not found at ${path.relative(process.cwd(), cmdDir)}/`);
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

// Check 3: Cross-File Consistency. Report-only — none of these are
// auto-fixed, deliberately: a phase-name mismatch, a stray task-ID
// reference, or a session-count drift could each be either a real typo or
// an intentional edit, and guessing wrong risks silently corrupting
// user-authored prose. That's a materially different risk than Check 4's
// pure-arithmetic recalculations, which are safe to auto-fix.
function checkCrossFileConsistency() {
  const cannotFix = [];

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const dataJson = readJsonIfExists(paths.DATA_JSON());
  if (!planContent || !statusContent) return { cannotFix };

  const phaseHeadings = extractPhaseHeadings(planContent);
  const dashboard = extractProgressDashboardTable(statusContent);
  if (dashboard) {
    for (const row of dashboard.parsedRows) {
      if (row.isTotal) continue;
      const heading = phaseHeadings.find((p) => p.number === row.phase);
      if (heading && heading.name !== row.name) {
        cannotFix.push(
          `Phase ${row.phase} name mismatch: PROJECT_PLAN.md says "${heading.name}", STATUS_REPORT.md's Progress Dashboard says "${row.name}"`
        );
      }
    }
  }

  const activeIds = extractActiveSprintIds(statusContent);
  for (const id of activeIds) {
    if (!planContent.includes(id)) {
      cannotFix.push(`Active Sprint references "${id}" which doesn't appear anywhere in PROJECT_PLAN.md`);
    }
  }

  if (dataJson && Array.isArray(dataJson.sessions)) {
    const logCount = countSessionLogEntries(statusContent);
    if (logCount !== dataJson.sessions.length) {
      cannotFix.push(
        `Session count mismatch: STATUS_REPORT.md's Session Log has ${logCount} entries, .sitrep-data.json has ${dataJson.sessions.length}`
      );
    }
  }

  const currentPhaseField = extractHeaderField(statusContent, 'Current Phase');
  const currentPhaseMatch = currentPhaseField && currentPhaseField.match(/Phase\s+(\d+)/);
  if (currentPhaseMatch) {
    const currentPhaseNumber = parseInt(currentPhaseMatch[1], 10);
    const headingLineMatch = planContent.match(new RegExp(`^##\\s*Phase\\s+${currentPhaseNumber}\\b.*$`, 'm'));
    if (!headingLineMatch) {
      cannotFix.push(`STATUS_REPORT.md's Current Phase references Phase ${currentPhaseNumber}, which has no heading in PROJECT_PLAN.md`);
    } else if (/✅/.test(headingLineMatch[0])) {
      cannotFix.push(`STATUS_REPORT.md's Current Phase is Phase ${currentPhaseNumber}, but PROJECT_PLAN.md marks that phase ✅ complete`);
    }
  }

  return { cannotFix };
}

// Check 4: Progress Accuracy. Auto-fixes pure arithmetic (bar/percentage
// recomputation, cost-total resync) — safe because these are derived
// entirely from other numbers already in the same files, never guessed.
function checkProgressAccuracy() {
  const fixed = [];
  const cannotFix = [];

  let statusContent = readIfExists(paths.STATUS_REPORT());
  const planContent = readIfExists(paths.PROJECT_PLAN());
  const dataJson = readJsonIfExists(paths.DATA_JSON());
  let statusChanged = false;

  if (statusContent) {
    const initialDashboard = extractProgressDashboardTable(statusContent);
    if (initialDashboard) {
      // `currentDashboard` is re-parsed after every write so its `tableEnd`/
      // `rows` offsets stay valid against the just-updated `statusContent` —
      // a bar string can change length (e.g. "50%" -> "100%"), which shifts
      // every absolute offset after it, so reusing a stale parse across
      // multiple row-rewrites would corrupt the second write's target.
      let currentDashboard = initialDashboard;
      for (const row of initialDashboard.parsedRows) {
        if (row.isTotal) continue;
        if (!isPlainInteger(row.tasksRaw) || !isPlainInteger(row.doneRaw)) continue; // hybrid Story-tracked phase, not applicable

        const tasks = parseInt(stripBold(row.tasksRaw), 10);
        const done = parseInt(stripBold(row.doneRaw), 10);
        const { bar } = renderProgressBar(done, tasks);
        if (row.barRaw !== bar) {
          statusContent = replaceTableRowCells(statusContent, currentDashboard, row.rowIndex, { 4: bar });
          currentDashboard = extractProgressDashboardTable(statusContent);
          statusChanged = true;
          fixed.push(`Recalculated Phase ${row.phase} progress bar in Progress Dashboard (${done}/${tasks})`);
        }
      }
    }

    if (planContent) {
      const phaseHeadingLines = planContent.match(/^##\s*Phase\s+\d+\b.*$/gm) || [];
      for (const line of phaseHeadingLines) {
        const numMatch = line.match(/Phase\s+(\d+)/);
        if (!numMatch || !/✅/.test(line)) continue;
        const phaseNum = parseInt(numMatch[1], 10);
        const row = initialDashboard && initialDashboard.parsedRows.find((r) => !r.isTotal && r.phase === phaseNum);
        if (row && isPlainInteger(row.tasksRaw) && isPlainInteger(row.doneRaw)) {
          const tasks = parseInt(stripBold(row.tasksRaw), 10);
          const done = parseInt(stripBold(row.doneRaw), 10);
          if (done !== tasks) {
            cannotFix.push(`Phase ${phaseNum} is marked ✅ complete in PROJECT_PLAN.md but Progress Dashboard shows only ${done}/${tasks} done`);
          }
        }
      }
    }
  }

  if (dataJson && Array.isArray(dataJson.sessions)) {
    const actualCostSum = dataJson.sessions.reduce((sum, s) => sum + (typeof s.cost_usd === 'number' ? s.cost_usd : 0), 0);
    const roundedSum = Math.round(actualCostSum * 100) / 100;
    const recordedTotal = (dataJson.totals && dataJson.totals.cost_usd) || 0;
    if (Math.abs(roundedSum - recordedTotal) > 0.001) {
      dataJson.totals = dataJson.totals || {};
      dataJson.totals.cost_usd = roundedSum;
      writeJson(paths.DATA_JSON(), dataJson);
      fixed.push(`Recalculated .sitrep-data.json totals.cost_usd (was $${recordedTotal.toFixed(2)}, now $${roundedSum.toFixed(2)})`);
    }
  }

  if (statusChanged) {
    writeFile(paths.STATUS_REPORT(), statusContent);
  }

  return { fixed, cannotFix };
}

// Check 5: Codebase Sync (only in `deep` mode). Deliberately narrower than
// the MD's full checklist: "flag code not tracked in any task" requires
// judging what a diff "is" well enough to match it to a task description —
// that's an LLM-judgment task, not something deterministic Node code can do
// reliably, so it's left as an explicit, isolated gap rather than faked with
// a weak heuristic. Same reasoning applies to a missing phase-completion
// tag: report-only, never auto-created (GETSITREP-47) — there's no reliable
// way for deterministic code to know which historical commit actually
// completed a given phase, so `git tag` would default to HEAD (today's
// commit) and silently create a misleading tag rather than the real one.
// What IS implemented and real: a best-effort search for a commit trace of
// each "done" Active Sprint item (report-only, heuristic — a miss just
// means "no commit message happened to mention it," not "the work wasn't
// done").
function checkCodebaseSync() {
  const fixed = [];
  const cannotFix = [];

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());

  if (planContent) {
    const phaseHeadingLines = planContent.match(/^##\s*Phase\s+\d+\b.*$/gm) || [];
    for (const line of phaseHeadingLines) {
      if (!/✅/.test(line)) continue;
      const versionMatch = line.match(/`(v[\d.]+)`/);
      if (!versionMatch) continue;
      const tag = versionMatch[1];
      if (!tagExists(tag)) {
        cannotFix.push(`Phase marked ✅ complete (${tag}) has no git tag — tag the actual milestone commit yourself; selfheal won't guess (it would default to HEAD, which is almost never the right commit)`);
      }
    }
  }

  if (statusContent) {
    const doneRows = extractActiveSprintRows(statusContent).filter((r) => /✅/.test(r.status));
    for (const row of doneRows) {
      const trace = logSearch(row.id);
      if (!trace) {
        cannotFix.push(`No commit trace found for completed item "${row.id}" (heuristic — a commit message just may not mention it by name)`);
      }
    }
  }

  return { fixed, cannotFix };
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
// mutates the baseline (Hard Law #5: fail-open, non-interactive). Locked
// files (GETSITREP-31) are excluded from modified/added/removed and
// reported separately via diffManifest()'s `locked` array.
function checkDrift(baseline) {
  if (!baseline) {
    return { checked: false, modified: [], added: [], removed: [] };
  }

  const current = computeManifest();
  return { checked: true, ...diffManifest(baseline, current) };
}

// GETSITREP-31: shared setup for all four file actions. Returns either
// { error } or the resolved paths/content every action needs, so each
// action function only has to handle its own logic, not this validation.
function resolveTarget(fileArg) {
  if (!fileArg) {
    return { error: `--file is required — expected one of: ${CANON_COMMANDS.join(', ')}` };
  }
  if (!CANON_COMMANDS.includes(fileArg)) {
    return { error: `Unknown command name "${fileArg}" — expected one of: ${CANON_COMMANDS.join(', ')}` };
  }

  const absPath = path.join(commandDir(), `${fileArg}.md`);
  const relPath = path.relative(process.cwd(), absPath);
  const liveContent = readIfExists(absPath);

  return { name: fileArg, absPath, relPath, liveContent };
}

function lockAction(values) {
  const target = resolveTarget(values.file);
  if (target.error) return fail('selfheal', values, target.error);
  if (target.liveContent === null) {
    return fail('selfheal', values, `Live file not found: ${target.relPath}`);
  }

  const baseline = readHashManifest();
  if (!baseline) {
    return fail('selfheal', values, 'No baseline manifest yet — run selfheal (no args) first to create one');
  }

  const updated = lockPath(baseline, target.relPath);
  writeHashManifest(updated);
  const gitResult = commit(['sitrep/'], `sitrep: selfheal — locked ${target.name} (intentional customization)`);

  return ok('selfheal', values, [
    `Locked ${target.relPath} — accepted as intentional. It won't be reported as drift until unlocked.`,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
  ].join('\n'));
}

function unlockAction(values) {
  const target = resolveTarget(values.file);
  if (target.error) return fail('selfheal', values, target.error);

  const baseline = readHashManifest();
  if (!baseline) {
    return fail('selfheal', values, 'No baseline manifest yet — nothing to unlock');
  }
  if (!baseline.locked || !baseline.locked[target.relPath]) {
    return ok('selfheal', values, `${target.relPath} isn't locked — nothing to do.`);
  }

  const updated = unlockPath(baseline, target.relPath);
  writeHashManifest(updated);
  const gitResult = commit(['sitrep/'], `sitrep: selfheal — unlocked ${target.name}`);

  return ok('selfheal', values, [
    `Unlocked ${target.relPath} — drift will be reported again from the existing baseline.`,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
  ].join('\n'));
}

function diffAction(values) {
  const target = resolveTarget(values.file);
  if (target.error) return fail('selfheal', values, target.error);
  if (target.liveContent === null) {
    return fail('selfheal', values, `Live file not found: ${target.relPath}`);
  }

  const canonicalContent = readCanonicalFile(target.name);
  if (canonicalContent === null) {
    return fail('selfheal', values, `No canonical version of ${target.name} found in this install`);
  }

  if (canonicalContent === target.liveContent) {
    return ok('selfheal', values, `${target.relPath} matches the canonical version — no differences.`);
  }

  const ops = diffLines(canonicalContent, target.liveContent);
  const lines = [
    `--- canonical (${target.name}.md)`,
    `+++ live (${target.relPath})`,
    formatDiff(ops),
  ];
  return ok('selfheal', values, lines.join('\n'));
}

function restoreAction(values) {
  const target = resolveTarget(values.file);
  if (target.error) return fail('selfheal', values, target.error);
  if (target.liveContent === null) {
    return fail('selfheal', values, `Live file not found: ${target.relPath}`);
  }

  const canonicalContent = readCanonicalFile(target.name);
  if (canonicalContent === null) {
    return fail('selfheal', values, `No canonical version of ${target.name} found in this install`);
  }

  if (canonicalContent === target.liveContent) {
    return ok('selfheal', values, `${target.relPath} already matches canonical — nothing to restore.`);
  }

  if (!values.force) {
    const ops = diffLines(canonicalContent, target.liveContent);
    const lines = [
      `⚠️  ${target.relPath} has been customized and restoring would overwrite it.`,
      `--- canonical (${target.name}.md)`,
      `+++ live (${target.relPath})`,
      formatDiff(ops),
      '',
      `Re-run with --force to overwrite anyway: selfheal restore --file ${target.name} --force`,
    ];
    return fail('selfheal', values, lines.join('\n'));
  }

  writeFile(target.absPath, canonicalContent);

  const baseline = readHashManifest() || computeManifest();
  const relocked = unlockPath(baseline, target.relPath);
  const updated = { ...relocked, files: { ...relocked.files, [target.relPath]: hashContent(canonicalContent) } };
  writeHashManifest(updated);

  const gitResult = commit(['sitrep/', path.dirname(target.relPath)], `sitrep: selfheal — restored ${target.name} to canonical`);

  return ok('selfheal', values, [
    `Restored ${target.relPath} to the canonical version.`,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
  ].join('\n'));
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('selfheal', parsed.values, parsed.errors.join('; '));
  }

  if (FILE_ACTIONS.includes(parsed.values.mode)) {
    switch (parsed.values.mode) {
      case 'lock': return lockAction(parsed.values);
      case 'unlock': return unlockAction(parsed.values);
      case 'diff': return diffAction(parsed.values);
      case 'restore': return restoreAction(parsed.values);
    }
  }

  const structure = checkFileStructure();
  const integrity = checkFileIntegrity();
  const crossFile = checkCrossFileConsistency();
  const progress = checkProgressAccuracy();
  const manifestBaseline = checkManifestBaseline();
  const baselineManifest = readHashManifest();
  const drift = checkDrift(baselineManifest);
  const deep = parsed.values.mode === 'deep' ? checkCodebaseSync() : null;

  const allFixed = [...structure.fixed, ...progress.fixed, ...manifestBaseline.fixed, ...(deep ? deep.fixed : [])];
  const allCannotFix = [
    ...structure.cannotFix,
    ...integrity.cannotFix,
    ...crossFile.cannotFix,
    ...progress.cannotFix,
    ...(deep ? deep.cannotFix : []),
  ];
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
    `Cross-File Sync: ${crossFile.cannotFix.length === 0 ? '✅ Consistent' : '⚠️ see below'}`,
    `Progress Accuracy: ${progress.fixed.length === 0 && progress.cannotFix.length === 0 ? '✅ Correct' : '⚠️ see below'}`,
    manifestLine,
    driftLine,
    deep
      ? `Codebase Sync:   ${deep.fixed.length === 0 && deep.cannotFix.length === 0 ? '✅ Clean' : '⚠️ see below'}`
      : 'Codebase Sync:   ⏭️ Skipped (run selfheal deep to include)',
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
    lines.push('  (informational only — selfheal diff/lock/restore --file <name> to act on these)');
    lines.push('');
  }

  if (drift.checked && drift.locked && drift.locked.length > 0) {
    lines.push('Locked (customized, excluded from drift):');
    for (const f of drift.locked) lines.push(`  - ${f}`);
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
