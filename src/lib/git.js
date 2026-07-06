// Best-effort git commit helper. Never throws — every write-command's git
// step is allowed to fail open (no git repo, nothing staged, git missing)
// without blocking the file writes that already happened. Uses execFileSync
// with an argument array (no shell), never string-interpolated commands.

const { execFileSync } = require('child_process');

function run(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts });
}

function isGitRepo() {
  try {
    run(['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

// paths: string[] of paths to stage (relative to cwd). message: commit message.
// Returns { committed: boolean, reason?: string }.
function commit(paths, message) {
  if (!isGitRepo()) {
    return { committed: false, reason: 'not a git repository' };
  }

  try {
    run(['add', ...paths]);
  } catch (err) {
    return { committed: false, reason: `git add failed: ${err.message}` };
  }

  try {
    // --allow-empty-message not needed; but if nothing is staged, git commit
    // exits non-zero with "nothing to commit" — that's expected/benign, not
    // a real failure, so we distinguish it rather than surfacing it as an error.
    run(['commit', '-m', message]);
    return { committed: true };
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`;
    if (/nothing to commit/i.test(output)) {
      return { committed: false, reason: 'nothing to commit' };
    }
    return { committed: false, reason: `git commit failed: ${err.message}` };
  }
}

// Best-effort read helpers, all routed through the same run() so every git
// invocation in the codebase consistently sets stdio:'pipe' — without it,
// execFileSync's default stdio still captures stderr into err.stderr but
// ALSO leaks it straight to the parent process's real terminal, which is
// exactly the kind of confusing "fatal: not a git repository" noise a
// fail-open helper must never let through.
function recentLog(n) {
  try {
    return run(['log', '--oneline', `-${n}`]).trim();
  } catch {
    return '(not a git repository, or no commits)';
  }
}

function userName() {
  try {
    return run(['config', 'user.name']).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function currentBranch() {
  try {
    return run(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch {
    return 'unknown';
  }
}

module.exports = { commit, isGitRepo, recentLog, userName, currentBranch };
