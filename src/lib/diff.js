// Minimal line-based diff (LCS via dynamic programming). Zero-dependency
// per the project's hard law — command MDs are small enough (low hundreds
// of lines) that the O(n*m) table is trivial.

function diffLines(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: 'context', line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', line: oldLines[i] });
      i++;
    } else {
      ops.push({ type: 'add', line: newLines[j] });
      j++;
    }
  }
  while (i < m) {
    ops.push({ type: 'remove', line: oldLines[i] });
    i++;
  }
  while (j < n) {
    ops.push({ type: 'add', line: newLines[j] });
    j++;
  }

  return ops;
}

// Renders diffLines() output as a compact unified-style text block: runs of
// unchanged context are collapsed to a count instead of printed in full, so
// a single one-line edit in a long file doesn't dump the whole file.
function formatDiff(ops) {
  const out = [];
  let contextRun = 0;

  function flushContext() {
    if (contextRun > 0) {
      out.push(`  ... ${contextRun} unchanged line(s) ...`);
      contextRun = 0;
    }
  }

  for (const op of ops) {
    if (op.type === 'context') {
      contextRun++;
      continue;
    }
    flushContext();
    out.push(`${op.type === 'add' ? '+' : '-'} ${op.line}`);
  }
  flushContext();

  return out.join('\n');
}

module.exports = { diffLines, formatDiff };
