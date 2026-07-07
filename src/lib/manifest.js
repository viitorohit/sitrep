// GETSITREP-29/30/31: hash manifest baseline, drift comparison, and
// lock/restore support (foundation for GETSITREP-28).
//
// Scope note: this module computes/persists the baseline (GETSITREP-29),
// diffs it against current disk state (GETSITREP-30), and provides the pure
// lock/unlock transforms plus canonical-file access that GETSITREP-31's
// lock/diff/restore CLI actions (in selfheal.js) are built on.
//
// "At install" per the Story description: there is no CLI init/install
// command yet (that's GETSITREP-17, Tier 2) — today's install path is the
// bash installer (install.sh), which never invokes this CLI. The honest
// scope available now is for /selfheal to create the baseline the first
// time it finds one missing, the same way it already auto-creates missing
// directories in Check 1. Once GETSITREP-17 ships a real init command, that
// becomes the more natural place to seed the baseline instead.
//
// Same reasoning applies to "upgrade protection": there is no `getsitrep
// upgrade` command either, so the one real write-path that can clobber a
// customized command file today is `selfheal restore` — that's where the
// warn-before-overwrite behavior lives (see selfheal.js's restoreFile()).

const crypto = require('crypto');
const path = require('path');
const { readIfExists, readJsonIfExists, writeJson } = require('./fs-helpers');
const paths = require('./paths');
const { CANON_COMMANDS } = require('./canon');

// TODO(GETSITREP-36 follow-up): read this from adapter config once one
// exists, instead of hardcoding Claude Code's path.
function commandDir() {
  return path.join(process.cwd(), '.claude', 'commands');
}

// The canonical, shipped-with-the-package command MDs — what `diff` and
// `restore` compare/restore against. Resolved relative to this file, not
// process.cwd(), so it points at the CLI's own install location regardless
// of which project directory it's invoked from.
function packageCommandsDir() {
  return path.join(__dirname, '..', '..', 'commands');
}

function readCanonicalFile(name) {
  return readIfExists(path.join(packageCommandsDir(), `${name}.md`));
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function extractVersion(manifestMdContent) {
  if (!manifestMdContent) return 'unknown';
  const match = manifestMdContent.match(/\*\*Current:\*\*\s*v?([\d.]+)/);
  return match ? match[1] : 'unknown';
}

// Computes a fresh baseline from whatever's on disk right now. Does not
// read or compare against any previously-written manifest.
function computeManifest() {
  const files = {};
  const dir = commandDir();

  for (const name of CANON_COMMANDS) {
    const filePath = path.join(dir, `${name}.md`);
    const content = readIfExists(filePath);
    if (content !== null) {
      files[path.relative(process.cwd(), filePath)] = hashContent(content);
    }
  }

  const manifestMdContent = readIfExists(paths.MANIFEST());
  if (manifestMdContent !== null) {
    files[path.relative(process.cwd(), paths.MANIFEST())] = hashContent(manifestMdContent);
  }

  return {
    version: extractVersion(manifestMdContent),
    generatedAt: new Date().toISOString(),
    commandDir: path.relative(process.cwd(), dir),
    files,
  };
}

function readHashManifest() {
  return readJsonIfExists(paths.HASH_MANIFEST());
}

function writeHashManifest(manifest) {
  writeJson(paths.HASH_MANIFEST(), manifest);
}

// GETSITREP-30/31: compares a baseline manifest against a freshly computed
// one. Pure comparison — never mutates the baseline and never touches disk
// beyond what computeManifest() already reads. Locked files (GETSITREP-31)
// are left out of modified/added/removed entirely and reported separately —
// "a locked file is left alone" per GETSITREP-28's acceptance criteria,
// permanently, until explicitly unlocked.
function diffManifest(baseline, current) {
  const baselineFiles = (baseline && baseline.files) || {};
  const currentFiles = (current && current.files) || {};
  const lockedSet = (baseline && baseline.locked) || {};

  const modified = [];
  const added = [];
  const removed = [];
  const locked = [];

  for (const [file, hash] of Object.entries(currentFiles)) {
    if (lockedSet[file]) {
      locked.push(file);
    } else if (!(file in baselineFiles)) {
      added.push(file);
    } else if (baselineFiles[file] !== hash) {
      modified.push(file);
    }
  }

  for (const file of Object.keys(baselineFiles)) {
    if (!lockedSet[file] && !(file in currentFiles)) {
      removed.push(file);
    }
  }

  return { modified, added, removed, locked };
}

// GETSITREP-31: pure transforms over a manifest object — return a new
// manifest, never mutate the one passed in, so callers stay in control of
// when (and whether) writeHashManifest() persists the result.
//
// Deliberately does NOT touch `files[relPath]` — locked files are excluded
// from diffManifest()'s comparison entirely (see above), regardless of what
// hash is on record, so there's nothing to gain from rewriting it here and
// it would cost something real: unlocking is supposed to resume monitoring
// against the *original* pre-customization baseline, and overwriting the
// hash at lock time would silently erase that baseline instead.
function lockPath(manifest, relPath) {
  return {
    ...manifest,
    locked: { ...(manifest.locked || {}), [relPath]: true },
  };
}

function unlockPath(manifest, relPath) {
  const locked = { ...(manifest.locked || {}) };
  delete locked[relPath];
  return { ...manifest, locked };
}

module.exports = {
  computeManifest,
  readHashManifest,
  writeHashManifest,
  diffManifest,
  lockPath,
  unlockPath,
  hashContent,
  commandDir,
  readCanonicalFile,
};
