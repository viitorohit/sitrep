// Loose, line-based extraction helpers for reading sitrep's human-authored
// markdown files. Deliberately not a full markdown parser — these files are
// narrative/human-edited, so extraction is pragmatic regex over strict
// structure, same spirit as the prose commands this replaces.

// Project name from PROJECT_PLAN.md's first heading, e.g.
// "# sitrep — Master Project Plan" -> "sitrep". Falls back to `fallback`.
function extractProjectName(projectPlanContent, fallback) {
  if (!projectPlanContent) return fallback;
  const match = projectPlanContent.match(/^#\s+(.+?)(?:\s+—|\s+-|\n|$)/m);
  return match ? match[1].trim() : fallback;
}

// Version from MANIFEST.md's "**Current:** vX.Y.Z" line. Strips a leading
// "v" if present, so callers can consistently prepend their own "v" prefix
// regardless of whether MANIFEST.md's text includes one.
function extractVersion(manifestContent) {
  if (!manifestContent) return 'unknown';
  const match = manifestContent.match(/\*\*Current:\*\*\s*v?(\S+)/);
  return match ? match[1].trim() : 'unknown';
}

// A "> **Field:** value" header metadata line, e.g. in STATUS_REPORT.md's
// top block. Returns the raw trailing text, or null if not found.
function extractHeaderField(content, fieldName) {
  if (!content) return null;
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`>\\s*\\*\\*${escaped}:\\*\\*\\s*(.+)`);
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

// The most recent (topmost) "### Session N — DATE" block in a Session Log
// section, with its "- **Field:** value" lines parsed into an object.
// Returns null if no session log entry is found.
function extractLatestSessionLogEntry(statusReportContent) {
  if (!statusReportContent) return null;

  const headerMatch = statusReportContent.match(/###\s*Session\s+(\d+)\s*—\s*(.+)/);
  if (!headerMatch) return null;

  const startIndex = headerMatch.index + headerMatch[0].length;
  const rest = statusReportContent.slice(startIndex);
  const endIndex = rest.search(/\n###\s*Session\s+\d+|\n---/);
  const block = endIndex === -1 ? rest : rest.slice(0, endIndex);

  const fields = {};
  const fieldRe = /-\s*\*\*([^*]+):\*\*\s*(.+)/g;
  let fieldMatch;
  while ((fieldMatch = fieldRe.exec(block)) !== null) {
    fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
  }

  return {
    number: parseInt(headerMatch[1], 10),
    date: headerMatch[2].trim(),
    fields,
  };
}

// Splits a "| a | b | c |" markdown table row into ["a", "b", "c"], dropping
// only the empty strings produced by the leading/trailing pipes — NOT every
// empty cell, since a legitimately blank column (e.g. no owner assigned yet)
// must still occupy its position or every cell after it shifts left.
function splitRowCells(row) {
  const parts = row.split('|').map((c) => c.trim());
  if (parts.length > 0 && parts[0] === '') parts.shift();
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

// Rows from the "## Blockers & Risks" table, excluding the "None currently"
// placeholder row. Returns [] when there are no active blockers.
function extractBlockers(statusReportContent) {
  if (!statusReportContent) return [];

  const sectionMatch = statusReportContent.match(/##\s*Blockers\s*&\s*Risks([\s\S]*?)(?:\n---|\n##|$)/);
  if (!sectionMatch) return [];

  const rows = sectionMatch[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .slice(2); // skip header row + separator row

  const blockers = [];
  for (const row of rows) {
    const cells = splitRowCells(row);
    if (cells.length === 0 || cells.every((c) => c === '')) continue;
    if (/none currently/i.test(cells.join(' '))) continue;
    blockers.push(cells.join(' — '));
  }
  return blockers;
}

// Shared primitive: finds the markdown table immediately following a given
// heading regex. Returns { tableEnd, rows, headerLine } or null.
//
// The search is bounded to the text between this heading and the next "##"
// heading (or end of file) — without this bound, a section with no table of
// its own (e.g. a placeholder "_None yet._") would silently match the FIRST
// table found anywhere further down the file, in a completely different
// section, and callers would insert rows into the wrong table.
function findTableAfterHeading(content, headingRe) {
  if (!content) return null;
  const headingMatch = content.match(headingRe);
  if (!headingMatch) return null;

  const afterHeadingFull = content.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = afterHeadingFull.match(/\n##\s/);
  const afterHeading = nextHeadingMatch ? afterHeadingFull.slice(0, nextHeadingMatch.index) : afterHeadingFull;
  const tableMatch = afterHeading.match(/\|[^\n]*\|\n\|[-\s|]+\|\n((?:\|.*\|\n?)*)/);
  if (!tableMatch) return null;

  const rows = tableMatch[1]
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

  const tableEnd = headingMatch.index + headingMatch[0].length + tableMatch.index + tableMatch[0].length;
  const headerLine = tableMatch[0].split('\n')[0];

  return { tableEnd, rows, headerLine };
}

// Finds the "## Phase N: ..." (or "## Phase N " / "## Phase N —") heading
// and the markdown table immediately following it. Returns null if the
// phase heading isn't found. Returns { headingEnd, tableEnd, rows,
// looksLikeTaskTable } if found — `rows` are the raw data rows (excluding
// header/separator), `tableEnd` is the string index right after the last
// row (where a new row can be inserted), and `looksLikeTaskTable` is a
// sanity check that the table's header matches the standard
// "# | Feature | Description" shape this function expects — some phases in
// a given PROJECT_PLAN.md may have been reformatted to a different shape
// (e.g. a Tier/Story table mirroring an external tracker) and callers
// should not blindly insert into those.
function findPhaseTable(planContent, phaseNumber) {
  const headingRe = new RegExp(`^##\\s*Phase\\s+${phaseNumber}\\b.*$`, 'm');
  const table = findTableAfterHeading(planContent, headingRe);
  if (!table) return null;
  const looksLikeTaskTable = /feature|task/i.test(table.headerLine);
  return { tableEnd: table.tableEnd, rows: table.rows, looksLikeTaskTable };
}

// Given rows like "| 3.1 | ... |", finds the highest N in "phaseNumber.N"
// and returns the next one as a string, e.g. "3.4". Returns "phaseNumber.1"
// if no matching row is found.
function nextTaskId(rows, phaseNumber) {
  const escaped = String(phaseNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^\\|\\s*${escaped}\\.(\\d+)\\s*\\|`);
  let max = 0;
  for (const row of rows) {
    const match = row.match(re);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${phaseNumber}.${max + 1}`;
}

// Same idea for the "Future / Post-MVP Ideas" table's "F.N" numbering.
function findFutureTable(planContent) {
  return findTableAfterHeading(planContent, /^##\s*Future\s*\/\s*Post-MVP Ideas.*$/m);
}

function nextFutureId(rows) {
  let max = 0;
  for (const row of rows) {
    const match = row.match(/^\|\s*F\.(\d+)\s*\|/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `F.${max + 1}`;
}

// Key Decisions table: "| # | Decision | Rationale | Date |" — numbered rows.
function findKeyDecisionsTable(planContent) {
  return findTableAfterHeading(planContent, /^##\s*Key Decisions.*$/m);
}

function nextDecisionNumber(rows) {
  let max = 0;
  for (const row of rows) {
    const match = row.match(/^\|\s*(\d+)\s*\|/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return max + 1;
}

// Risk Register table: "| Risk | Impact | Mitigation |" — no numeric column.
function findRiskRegisterTable(planContent) {
  return findTableAfterHeading(planContent, /^##\s*Risk Register.*$/m);
}

function insertRowAt(content, index, row) {
  const rowLine = row.endsWith('\n') ? row : row + '\n';
  return content.slice(0, index) + rowLine + content.slice(index);
}

// Raw text of a "## Heading" section, up to (not including) the next "##"
// heading or "---" separator. Returns null if the heading isn't found.
function extractSection(content, headingRe) {
  if (!content) return null;
  const match = content.match(headingRe);
  if (!match) return null;
  const rest = content.slice(match.index + match[0].length);
  const endIndex = rest.search(/\n##\s|\n---/);
  return (endIndex === -1 ? rest : rest.slice(0, endIndex)).trim();
}

// Replaces a "> **Field:** ..." header line's value in place. If the field
// isn't found, returns content unchanged (callers decide whether that's
// worth warning about — this never throws or inserts a guessed location).
function replaceHeaderField(content, fieldName, newValue) {
  if (!content) return content;
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(>\\s*\\*\\*${escaped}:\\*\\*\\s*).+`);
  return content.replace(re, `$1${newValue}`);
}

// Inserts a new "### Session N — DATE" block right after the "## Session
// Log" heading (i.e. at the top, keeping reverse-chronological order).
// Returns content unchanged if the heading isn't found.
function insertSessionLogEntry(content, entryMarkdown) {
  if (!content) return content;
  const headingMatch = content.match(/##\s*Session Log\s*\n/);
  if (!headingMatch) return content;
  const insertAt = headingMatch.index + headingMatch[0].length;
  return content.slice(0, insertAt) + '\n' + entryMarkdown.trim() + '\n' + content.slice(insertAt);
}

// Appends a row to the "## Changes & Scope Updates" table in STATUS_REPORT.md.
// `cells` is the ordered list of already-formatted column values. Returns
// content unchanged if the section/table isn't found — skip logging rather
// than guess a location. Shared by capture.js and plan-update.js, the two
// commands that log entries here.
function insertChangeLogRow(statusContent, cells) {
  if (!statusContent) return statusContent;
  const rowText = `| ${cells.join(' | ')} |`;
  const sectionMatch = statusContent.match(/##\s*Changes\s*&\s*Scope Updates([\s\S]*?)\n\|[^\n]*\|\n\|[-\s|]+\|\n/);
  if (!sectionMatch) return statusContent;
  const insertAt = sectionMatch.index + sectionMatch[0].length;
  return statusContent.slice(0, insertAt) + rowText + '\n' + statusContent.slice(insertAt);
}

// Strips markdown bold markers ("**23**" -> "23") — the Progress Dashboard
// table bolds the TOTAL row's cells, which would otherwise break a plain
// integer check.
function stripBold(s) {
  return s.replace(/\*\*/g, '').trim();
}

// True only for a cell that is JUST an integer once bold-stripped — used to
// tell a legacy numeric phase ("8") apart from this project's own hybrid
// Story-tracked phases ("9 Stories"), which selfheal must not misparse as a
// number nor silently "fix" into one.
function isPlainInteger(cell) {
  return /^\d+$/.test(stripBold(cell));
}

// All "## Phase N: Name — ..." headings in PROJECT_PLAN.md, in document
// order. Stops at the em-dash (or end of line if there isn't one) so
// trailing version/status annotations aren't captured as part of the name.
function extractPhaseHeadings(planContent) {
  if (!planContent) return [];
  const re = /^##\s*Phase\s+(\d+):\s*([^—\n]+?)\s*(?:—|$)/gm;
  const phases = [];
  let match;
  while ((match = re.exec(planContent)) !== null) {
    phases.push({ number: parseInt(match[1], 10), name: match[2].trim() });
  }
  return phases;
}

// Parses the "## Progress Dashboard" table in STATUS_REPORT.md. Each row
// becomes { phase, name, tasksRaw, doneRaw, bar, rowIndex }; the TOTAL row
// (first cell containing "TOTAL") becomes { isTotal: true, tasksRaw,
// doneRaw, rowIndex } instead. `rowIndex` is the row's position in
// `table.rows` so a caller can rewrite that exact line back into the table.
function extractProgressDashboardTable(statusContent) {
  const table = findTableAfterHeading(statusContent, /^##\s*Progress Dashboard.*$/m);
  if (!table) return null;

  const rows = table.rows.map((row, rowIndex) => {
    const cells = splitRowCells(row);
    const first = stripBold(cells[0] || '');
    if (/TOTAL/i.test(first)) {
      return { isTotal: true, rowIndex, tasksRaw: cells[2], doneRaw: cells[3] };
    }
    return {
      isTotal: false,
      rowIndex,
      phase: parseInt(first, 10),
      name: (cells[1] || '').trim(),
      tasksRaw: cells[2],
      doneRaw: cells[3],
      barRaw: cells[4],
    };
  });

  return { ...table, parsedRows: rows };
}

// Renders a 10-segment block bar + rounded percentage the same way this
// project's own docs already do it (see MANIFEST.md's progress-bar
// examples): block count rounds `done/total*10`; the percentage text is
// independently rounded from the true fraction, not derived from the block
// count, so e.g. 4/9 renders as "████░░░░░░ 44%" (4 blocks, not 40%).
function renderProgressBar(done, total) {
  if (!total || total <= 0) return { bar: '░░░░░░░░░░', percent: 0 };
  const fraction = done / total;
  const filled = Math.max(0, Math.min(10, Math.round(fraction * 10)));
  const percent = Math.round(fraction * 100);
  return { bar: '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${percent}%`, percent };
}

// Rewrites one row of a table by index, replacing specific cell positions.
// `cellUpdates` is { cellIndex: newValue }. Preserves every other cell
// untouched (including any bold markers on cells not being replaced).
function replaceTableRowCells(content, table, rowIndex, cellUpdates) {
  const rows = table.rows.slice();
  const cells = splitRowCells(rows[rowIndex]);
  for (const [idx, value] of Object.entries(cellUpdates)) {
    cells[Number(idx)] = value;
  }
  rows[rowIndex] = `| ${cells.join(' | ')} |`;

  const oldTableBlock = table.rows.join('\n');
  const newTableBlock = rows.join('\n');
  const searchStart = table.tableEnd - oldTableBlock.length - 1;
  return content.slice(0, searchStart) + newTableBlock + content.slice(table.tableEnd - 1);
}

// First column values from the "## Active Sprint" table — could be numeric
// task IDs ("3.4") or Jira-style keys ("GETSITREP-28"); this project has
// used both depending on whether a phase is still task-numbered or has
// moved to Jira-Story tracking (see PROJECT_PLAN.md's roadmap-source-of-
// truth note), so callers must not assume one shape.
function extractActiveSprintIds(statusContent) {
  const table = findTableAfterHeading(statusContent, /^##\s*Active Sprint.*$/m);
  if (!table) return [];
  return table.rows
    .map((row) => splitRowCells(row)[0])
    .filter(Boolean)
    .map((cell) => stripBold(cell))
    .filter((id) => id && id !== '—' && id !== '-');
}

// Active Sprint rows as { id, status } — both the legacy "#|Task|Status|
// Notes" shape and this project's Jira-Story "Story|Task|Status|Notes"
// shape put status in the 3rd column, so this doesn't need to know which
// shape it's reading.
function extractActiveSprintRows(statusContent) {
  const table = findTableAfterHeading(statusContent, /^##\s*Active Sprint.*$/m);
  if (!table) return [];
  return table.rows
    .map((row) => splitRowCells(row))
    .filter((cells) => cells.length >= 3 && cells[0])
    .map((cells) => ({ id: stripBold(cells[0]), status: cells[2] }));
}

// Count of "### Session N — ..." headings in the Session Log section —
// compared against .sitrep-data.json's own session count to catch the two
// stores drifting apart (a real drift this project has hit before).
function countSessionLogEntries(statusContent) {
  if (!statusContent) return 0;
  const matches = statusContent.match(/^###\s*Session\s+\d+\s*—/gm);
  return matches ? matches.length : 0;
}

module.exports = {
  extractSection,
  replaceHeaderField,
  insertSessionLogEntry,
  insertChangeLogRow,
  splitRowCells,
  extractProjectName,
  extractVersion,
  extractHeaderField,
  extractLatestSessionLogEntry,
  extractBlockers,
  findTableAfterHeading,
  findPhaseTable,
  nextTaskId,
  findFutureTable,
  nextFutureId,
  findKeyDecisionsTable,
  nextDecisionNumber,
  findRiskRegisterTable,
  insertRowAt,
  stripBold,
  isPlainInteger,
  extractPhaseHeadings,
  extractProgressDashboardTable,
  renderProgressBar,
  replaceTableRowCells,
  extractActiveSprintIds,
  extractActiveSprintRows,
  countSessionLogEntries,
};
