// GETSITREP-17: CLI onboarding wizard + sitrep.config.json.
//
// Not one of the 8 canon slash commands (docs/specs/command-canon.md) —
// like install.sh before it, `init` is a CLI-only bootstrap step, run once,
// not something an AI tool exposes as `/init`.
//
// Scope boundaries, deliberately:
// - GETSITREP-18 (wizard prompts) + GETSITREP-19 (config schema/writer) +
//   GETSITREP-20 (Jira site/project capture) are all implemented here.
// - GETSITREP-39 (residue detection) stops before overwriting anything if
//   prior sitrep state is found, unless --force is passed. Per its MECE
//   boundary: this handles a missing/broken INSTALL with residue; drift in
//   a live install is selfheal's job (GETSITREP-28), a missing plan is
//   GETSITREP-25's job.
// - Writing actual per-platform hook config files (.claude/settings.json
//   etc.) is explicitly NOT this Story's scope — that's GETSITREP-22, part
//   of the separate GETSITREP-21 Story, not yet built. This command only
//   records which tools are in use, for GETSITREP-21 to consume later.
// - sitrep/ directory scaffolding, the gitignore entry, and the hash-
//   manifest baseline are delegated to selfheal's own execute() rather than
//   reimplemented here — selfheal already does exactly this, tested and
//   idempotent. Bootstrapping the three CONTENT files (MANIFEST.md,
//   PROJECT_PLAN.md, STATUS_REPORT.md from templates/) is NOT something
//   selfheal does — it deliberately refuses to guess file content — so
//   init does that itself (bootstrapTemplates()), mirroring install.sh's
//   existing behavior. This means a fresh `init` produces two commits (one
//   from selfheal's internal call, one for sitrep.config.json + any copied
//   command MDs) rather than one — an accepted tradeoff for reusing
//   existing, tested logic instead of duplicating it.

const path = require('path');
const { execFileSync } = require('child_process');
const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { exists, ensureDir, writeFile, readIfExists } = require('../lib/fs-helpers');
const { commit } = require('../lib/git');
const { createInterface, isInteractive, askChoice, askMultiChoice, askText } = require('../lib/prompt');
const { PLAN_SOURCES, COST_SOURCES, TOOLS, buildConfig, writeConfig } = require('../lib/config');
const { detectResidue } = require('../lib/residue');
const { commandDir, readCanonicalFile } = require('../lib/manifest');
const { CANON_COMMANDS } = require('../lib/canon');
const paths = require('../lib/paths');
const selfheal = require('./selfheal');

// Package root, resolved the same way manifest.js resolves its own
// canonical commands/ dir (relative to __dirname, not process.cwd()) — so
// this points at the CLI's own install location regardless of which
// project directory it's invoked from.
function packageRoot() {
  return path.join(__dirname, '..', '..');
}

// Bootstraps the three core files from templates/ + the package's own
// MANIFEST.md — the one piece selfheal deliberately does NOT do (it only
// creates missing directories; it refuses to guess file content, by
// design). Mirrors install.sh's existing template-copy behavior. Never
// overwrites a file that already exists.
function bootstrapTemplates() {
  const created = [];
  const targets = [
    { target: paths.MANIFEST(), source: path.join(packageRoot(), 'MANIFEST.md') },
    { target: paths.PROJECT_PLAN(), source: path.join(packageRoot(), 'templates', 'PROJECT_PLAN.md') },
    { target: paths.STATUS_REPORT(), source: path.join(packageRoot(), 'templates', 'STATUS_REPORT.md') },
  ];
  for (const { target, source } of targets) {
    if (!exists(target)) {
      const content = readIfExists(source);
      if (content !== null) {
        writeFile(target, content);
        created.push(path.relative(process.cwd(), target));
      }
    }
  }
  return created;
}

const SPEC = {
  flags: {
    yes: { type: 'boolean' },
    force: { type: 'boolean' },
    plan: { type: 'value', pattern: new RegExp(`^(${PLAN_SOURCES.join('|')})$`) },
    cost: { type: 'value', pattern: new RegExp(`^(${COST_SOURCES.join('|')})$`) },
    tools: { type: 'value' },
    'jira-site': { type: 'value' },
    'jira-project': { type: 'value' },
  },
};

function detectCcusage() {
  try {
    execFileSync('which', ['ccusage'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Copies any canon command MD the target platform dir is missing, from the
// package's own canonical commands/ (same resolution manifest.js's
// readCanonicalFile already uses) — never overwrites an existing file.
function copyCanonCommands() {
  const dir = commandDir();
  ensureDir(dir);
  const copied = [];
  for (const name of CANON_COMMANDS) {
    const target = path.join(dir, `${name}.md`);
    if (!exists(target)) {
      const content = readCanonicalFile(name);
      if (content !== null) {
        writeFile(target, content);
        copied.push(name);
      }
    }
  }
  return copied;
}

async function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('init', parsed.values, parsed.errors.join('; '));
  }

  const residue = detectResidue();
  if (residue.hasResidue && !parsed.values.force) {
    const lines = [
      '=== INIT ===',
      '⚠️  Existing sitrep state found — not reinitializing automatically:',
      ...residue.found.map((f) => `  - ${f.label}`),
      '',
      'Nothing was changed. Re-run with --force to proceed anyway (sitrep/PROJECT_PLAN.md and STATUS_REPORT.md content is never overwritten regardless of --force — only sitrep.config.json and missing scaffolding are (re)created).',
      '============',
    ];
    return ok('init', parsed.values, lines.join('\n'));
  }

  const interactive = !parsed.values.yes && isInteractive();
  const rl = interactive ? createInterface() : null;

  try {
    const planOptions = [
      { value: 'native', label: 'Native — sitrep/PROJECT_PLAN.md (default)' },
      { value: 'jira', label: 'Jira' },
      { value: 'openspec', label: 'OpenSpec' },
      { value: 'speckit', label: 'Spec Kit' },
      { value: 'none', label: 'None' },
    ];
    const planSource =
      parsed.values.plan ||
      (rl ? await askChoice(rl, { question: 'Which tool tracks your plan?', options: planOptions, defaultValue: 'native' }) : 'native');

    let jiraSite = parsed.values['jira-site'];
    let jiraProjectKey = parsed.values['jira-project'];
    if (planSource === 'jira' && rl) {
      jiraSite = jiraSite || (await askText(rl, { question: 'Jira site (e.g. yourteam.atlassian.net)' }));
      jiraProjectKey = jiraProjectKey || (await askText(rl, { question: 'Jira project key (e.g. GETSITREP)' }));
    }

    const ccusageAvailable = detectCcusage();
    const costOptions = [
      { value: 'manual', label: 'Thin local estimate (default, zero-setup)' },
      { value: 'ccusage', label: `ccusage${ccusageAvailable ? ' (detected on PATH)' : ' (not detected)'}` },
      { value: 'none', label: 'None' },
    ];
    const costSource =
      parsed.values.cost ||
      (rl
        ? await askChoice(rl, { question: 'Cost tracking?', options: costOptions, defaultValue: ccusageAvailable ? 'ccusage' : 'manual' })
        : ccusageAvailable
          ? 'ccusage'
          : 'manual');

    const toolOptions = [
      { value: 'claude-code', label: 'Claude Code' },
      { value: 'codex', label: 'Codex' },
      { value: 'cursor', label: 'Cursor' },
      { value: 'copilot', label: 'Copilot / VS Code' },
    ];
    const tools = parsed.values.tools
      ? parsed.values.tools
          .split(',')
          .map((t) => t.trim())
          .filter((t) => TOOLS.includes(t))
      : rl
        ? await askMultiChoice(rl, { question: 'Which AI coding tool(s) do you use?', options: toolOptions, defaultValues: ['claude-code'] })
        : ['claude-code'];

    const config = buildConfig({ planSource, jiraSite, jiraProjectKey, costSource, tools });
    writeConfig(config);

    const copiedCommands = tools.includes('claude-code') ? copyCanonCommands() : [];
    const bootstrappedTemplates = bootstrapTemplates();

    const commitPaths = ['sitrep.config.json'];
    if (copiedCommands.length > 0) commitPaths.push(path.relative(process.cwd(), commandDir()));
    const gitResult = commit(commitPaths, `sitrep: init — plan=${planSource} cost=${costSource} tools=${tools.join(',') || 'none'}`);

    const selfhealResult = await selfheal.execute([]);

    const lines = [
      '=== INIT ===',
      `Plan source: ${planSource}${planSource === 'jira' && jiraSite ? ` (${jiraSite}, ${jiraProjectKey || 'no project key given'})` : ''}`,
      `Cost source: ${costSource}`,
      `Tools: ${tools.length ? tools.join(', ') : 'none'}`,
      `Config: sitrep.config.json ${gitResult.committed ? '(committed)' : `(not committed: ${gitResult.reason})`}`,
      copiedCommands.length > 0
        ? `Command MDs copied into ${path.relative(process.cwd(), commandDir())}/: ${copiedCommands.join(', ')}`
        : 'Command MDs: none copied (Claude Code not selected, or already present)',
      bootstrappedTemplates.length > 0
        ? `Templates bootstrapped: ${bootstrappedTemplates.join(', ')}`
        : 'Templates: none needed (already present)',
      '',
      'Scaffolding sitrep/ (via selfheal):',
      selfhealResult.message,
      '',
      tools.includes('claude-code')
        ? 'Next: type /session-start in Claude Code to begin.'
        : 'Next: run `getsitrep session-start` to begin.',
      '============',
    ];

    return ok('init', parsed.values, lines.join('\n'));
  } finally {
    if (rl) rl.close();
  }
}

module.exports = { name: 'init', execute };
