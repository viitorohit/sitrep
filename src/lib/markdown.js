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
};
