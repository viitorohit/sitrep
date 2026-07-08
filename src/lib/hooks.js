// GETSITREP-21/22/24/37: per-platform SessionStart/SessionEnd hook writers.
//
// Hard Law #5 applies to every hook this writes: fail-open (a sitrep
// failure must never fail the host tool's session), idempotent (re-running
// init must never duplicate entries), non-interactive.
//
// Hook event shapes below are per docs/specs/adapter-contract.md's "Hook
// event support (confirmed 2026-07-02, verify against live vendor docs
// before shipping)" table — that caveat applies here too; this pass
// implements what's already on file in that spec, it doesn't independently
// re-verify it against live vendor docs.
//
// OWNED_COMMAND_PATTERN is how both the merge logic here and residue
// detection (src/lib/residue.js) tell "sitrep wrote this" apart from "this
// file exists for unrelated reasons" — a pre-existing hook config that
// happens to reference `getsitrep session-start`/`session-end` counts as
// already configured; one that doesn't gets merged into carefully, never
// blindly overwritten.

const { readIfExists, readJsonIfExists, writeJson, writeFile, exists } = require('./fs-helpers');
const paths = require('./paths');

const OWNED_COMMAND_PATTERN = /getsitrep (session-(start|end)|nudge-check)/;

function fileHasSitrepEntry(rawContent) {
  return typeof rawContent === 'string' && OWNED_COMMAND_PATTERN.test(rawContent);
}

function isOwnEntry(entry) {
  return OWNED_COMMAND_PATTERN.test(JSON.stringify(entry));
}

// Drops any previous sitrep-owned entry (so re-running init updates in
// place rather than duplicating) while preserving every entry a human
// added for the same event, then appends the current entry.
function replaceOwnEntries(existingArray, ownEntry) {
  const kept = Array.isArray(existingArray) ? existingArray.filter((e) => !isOwnEntry(e)) : [];
  return [...kept, ownEntry];
}

// GETSITREP-35: PostToolUse binds the proactive command advisor
// (nudge-check) — confirmed mid-session event per docs/specs/adapter-
// contract.md's Hook event support table. Fail-open/idempotent/non-
// interactive by nudge-check.js's own design (Hard Law #5 applies to this
// hook exactly as much as SessionStart/SessionEnd).
function mergeClaudeCodeSettings(existing) {
  const settings = existing && typeof existing === 'object' ? { ...existing } : {};
  const hooks = settings.hooks && typeof settings.hooks === 'object' ? { ...settings.hooks } : {};

  hooks.SessionStart = replaceOwnEntries(hooks.SessionStart, {
    hooks: [{ type: 'command', command: 'getsitrep session-start' }],
  });
  hooks.SessionEnd = replaceOwnEntries(hooks.SessionEnd, {
    hooks: [{ type: 'command', command: 'getsitrep session-end' }],
  });
  hooks.PostToolUse = replaceOwnEntries(hooks.PostToolUse, {
    hooks: [{ type: 'command', command: 'getsitrep nudge-check' }],
  });

  settings.hooks = hooks;
  return settings;
}

// Cursor requires a top-level "version": 1 field (different shape from
// Claude Code/Codex) — per docs/specs/adapter-contract.md. Cursor's
// mid-session event names differ from Claude Code's too (afterFileEdit /
// beforeSubmitPrompt, not PostToolUse) — bound to afterFileEdit as the
// closer analog to "meaningful tool use happened," per the same table.
function mergeCursorHooks(existing) {
  const config = existing && typeof existing === 'object' ? { ...existing } : {};
  config.version = 1;
  const hooks = config.hooks && typeof config.hooks === 'object' ? { ...config.hooks } : {};

  hooks.sessionStart = replaceOwnEntries(hooks.sessionStart, { command: 'getsitrep session-start' });
  hooks.sessionEnd = replaceOwnEntries(hooks.sessionEnd, { command: 'getsitrep session-end' });
  hooks.afterFileEdit = replaceOwnEntries(hooks.afterFileEdit, { command: 'getsitrep nudge-check' });

  config.hooks = hooks;
  return config;
}

// Codex's PostToolUse key name below (post_tool_use, snake_case) follows the
// same precedent as session_start/stop — inferred from Codex's own naming
// convention, not independently re-verified against live vendor docs this
// pass, same caveat this file's header already carries for the whole table.
function buildCodexConfigToml() {
  return [
    '[features]',
    'codex_hooks = true',
    '',
    '[hooks]',
    'session_start = "getsitrep session-start"',
    '# Codex has no native SessionEnd event; Stop is the closest available',
    '# equivalent (turn-scoped, not a true session close) — see',
    '# docs/specs/adapter-contract.md.',
    'stop = "getsitrep session-end"',
    '# GETSITREP-35: proactive command advisor, fired on tool use mid-session.',
    'post_tool_use = "getsitrep nudge-check"',
    '',
  ].join('\n');
}

// Writes/merges a JSON hook config, refusing to touch a file that exists
// but fails to parse as strict JSON (e.g. JSONC with comments) — silently
// treating a parse failure as "empty" and overwriting would destroy
// whatever real settings a human already had in there. Returns a status
// string for the caller to report, never throws.
function writeJsonHookConfig(filePath, mergeFn) {
  if (exists(filePath)) {
    const parsed = readJsonIfExists(filePath);
    if (parsed === null) {
      return { status: 'skipped', reason: `${filePath} exists but isn't valid JSON — not touching it. Add the sitrep hook manually.` };
    }
    const raw = readIfExists(filePath);
    if (fileHasSitrepEntry(raw)) {
      writeJson(filePath, mergeFn(parsed));
      return { status: 'updated' };
    }
    writeJson(filePath, mergeFn(parsed));
    return { status: 'merged' };
  }
  writeJson(filePath, mergeFn(null));
  return { status: 'created' };
}

// Codex's config.toml is create-only: no TOML parser/writer exists here
// (zero-dependency law, and a narrow hand-rolled writer can't safely
// merge into arbitrary hand-authored TOML without real risk of
// corrupting it) — if the file already exists, this refuses and tells
// the human what to add themselves instead of guessing at a merge.
function writeCodexConfig() {
  const filePath = paths.CODEX_CONFIG();
  if (exists(filePath)) {
    const raw = readIfExists(filePath);
    if (fileHasSitrepEntry(raw)) {
      return { status: 'already-configured' };
    }
    return {
      status: 'skipped',
      reason: `${filePath} already exists — not editing hand-authored TOML. Add manually:\n\n${buildCodexConfigToml()}`,
    };
  }
  writeFile(filePath, buildCodexConfigToml());
  return { status: 'created' };
}

function writeClaudeCodeHooks() {
  return writeJsonHookConfig(paths.CLAUDE_SETTINGS(), mergeClaudeCodeSettings);
}

function writeCursorHooks() {
  return writeJsonHookConfig(paths.CURSOR_HOOKS(), mergeCursorHooks);
}

module.exports = {
  OWNED_COMMAND_PATTERN,
  fileHasSitrepEntry,
  mergeClaudeCodeSettings,
  mergeCursorHooks,
  buildCodexConfigToml,
  writeClaudeCodeHooks,
  writeCursorHooks,
  writeCodexConfig,
};
