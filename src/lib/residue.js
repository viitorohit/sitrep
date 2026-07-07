// GETSITREP-39: residue detection for `getsitrep init`.
//
// MECE boundary (per the Story): GETSITREP-28/selfheal handles drift in a
// present, live install; GETSITREP-25 handles a missing plan; this handles
// a missing/broken INSTALL that has residue — leftover config, data files,
// or command MDs from a prior init. Detection lives here, at init, because
// that's where a dev lands when things are broken or they're re-adopting
// sitrep on a repo that already has some trace of it.
//
// Hook config paths (.claude/settings.json etc.) are checked for
// completeness against a future where GETSITREP-21/22 actually writes them —
// today they'll always come back absent, since nothing writes them yet.
// That's expected, not a bug in this detector.

const { exists, readIfExists } = require('./fs-helpers');
const paths = require('./paths');
const { CANON_COMMANDS } = require('./canon');
const { commandDir } = require('./manifest');
const path = require('path');

function detectResidue() {
  const found = [];

  if (exists(paths.SITREP_CONFIG())) {
    found.push({ kind: 'config', label: 'sitrep.config.json' });
  }

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  if (planContent || statusContent) {
    found.push({ kind: 'data', label: 'sitrep/ (PROJECT_PLAN.md and/or STATUS_REPORT.md already has content)' });
  }

  const dir = commandDir();
  if (exists(dir)) {
    const present = CANON_COMMANDS.filter((name) => exists(path.join(dir, `${name}.md`)));
    if (present.length > 0) {
      found.push({ kind: 'commands', label: `${path.relative(process.cwd(), dir)}/ already has ${present.length}/${CANON_COMMANDS.length} canon command file(s)` });
    }
  }

  const hookPaths = [
    ['Claude Code hooks', paths.CLAUDE_SETTINGS()],
    ['Cursor hooks', paths.CURSOR_HOOKS()],
    ['Codex config', paths.CODEX_CONFIG()],
    ['GitHub hooks dir', paths.GITHUB_HOOKS_DIR()],
  ];
  for (const [label, p] of hookPaths) {
    if (exists(p)) {
      found.push({ kind: 'hooks', label: `${label} (${path.relative(process.cwd(), p)}) already exists — not yet inspected for sitrep entries, GETSITREP-21 territory` });
    }
  }

  return { hasResidue: found.length > 0, found };
}

module.exports = { detectResidue };
