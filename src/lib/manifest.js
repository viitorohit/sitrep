// GETSITREP-29/30: hash manifest baseline + drift comparison (foundation
// for GETSITREP-28).
//
// Scope note: this module computes/persists the baseline (GETSITREP-29) and
// diffs it against current disk state (GETSITREP-30). It does not act on
// the diff — lock/diff/restore and upgrade-protection warnings are
// GETSITREP-31, built on top of diffManifest()'s output.
//
// "At install" per the Story description: there is no CLI init/install
// command yet (that's GETSITREP-17, Tier 2) — today's install path is the
// bash installer (install.sh), which never invokes this CLI. The honest
// scope available now is for /selfheal to create the baseline the first
// time it finds one missing, the same way it already auto-creates missing
// directories in Check 1. Once GETSITREP-17 ships a real init command, that
// becomes the more natural place to seed the baseline instead.

const crypto = require('crypto');
const path = require('path');
const { readIfExists, readJsonIfExists, writeJson } = require('./fs-helpers');
const paths = require('./paths');
const { CANON_COMMANDS } = require('./canon');

// TODO(GETSITREP-36 follow-up): read this from adapter config once one
// exists, instead of hardcoding Claude Code's path. Mirrors the same
// hardcoding + TODO already in selfheal.js's COMMAND_DIR.
function commandDir() {
  return path.join(process.cwd(), '.claude', 'commands');
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

// GETSITREP-30: compares a baseline manifest against a freshly computed one.
// Pure comparison — never mutates the baseline and never touches disk beyond
// what computeManifest() already reads. Locking a file as intentional so it
// stops showing up as "modified" is GETSITREP-31's job, not this function's;
// every modified file is reported here regardless of intent.
function diffManifest(baseline, current) {
  const baselineFiles = (baseline && baseline.files) || {};
  const currentFiles = (current && current.files) || {};

  const modified = [];
  const added = [];
  const removed = [];

  for (const [file, hash] of Object.entries(currentFiles)) {
    if (!(file in baselineFiles)) {
      added.push(file);
    } else if (baselineFiles[file] !== hash) {
      modified.push(file);
    }
  }

  for (const file of Object.keys(baselineFiles)) {
    if (!(file in currentFiles)) {
      removed.push(file);
    }
  }

  return { modified, added, removed };
}

module.exports = {
  computeManifest,
  readHashManifest,
  writeHashManifest,
  diffManifest,
  hashContent,
};
