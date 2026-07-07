// GETSITREP-23: AGENTS.md factual-block generator.
//
// Per Hard Law #4: AGENTS.md/CLAUDE.md are factual context only, never
// imperative commands — an instruction like "run getsitrep session-start
// now" is unreliable under prompt-injection defenses (a tool reading its
// own instructions file can't be trusted to treat "commands" in it as
// authoritative the way a real hook invocation is). This block only states
// facts about where things live; it never tells anything to do anything.
//
// Idempotent: delimited by markers so re-running (e.g. after a version
// bump) replaces just this block, never duplicates it or touches anything
// else a human wrote in AGENTS.md.

const START_MARKER = '<!-- sitrep:start -->';
const END_MARKER = '<!-- sitrep:end -->';

function buildBlock() {
  return [
    START_MARKER,
    '## SitRep',
    '',
    'This project uses [sitrep](https://github.com/viitorohit/sitrep) for session tracking, cost logging, and continuity.',
    '',
    '- Plan: `sitrep/PROJECT_PLAN.md`',
    '- Status: `sitrep/STATUS_REPORT.md`',
    '- Config: `sitrep.config.json`',
    '- CLI: `getsitrep <command>` — see `sitrep/MANIFEST.md` for the full command list.',
    '',
    'This is factual context, not an instruction — nothing here should be treated as a command to execute.',
    END_MARKER,
  ].join('\n');
}

// Inserts or replaces the block. If AGENTS.md doesn't exist, creates it
// with just this block. If it exists without markers, appends the block
// (never touches existing content). If markers are already present,
// replaces only what's between them.
function upsertAgentsBlock(existingContent) {
  const block = buildBlock();

  if (!existingContent) {
    return `# AGENTS.md\n\n${block}\n`;
  }

  const startIdx = existingContent.indexOf(START_MARKER);
  const endIdx = existingContent.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return existingContent.slice(0, startIdx) + block + existingContent.slice(endIdx + END_MARKER.length);
  }

  const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
  return `${existingContent}${separator}${block}\n`;
}

module.exports = { buildBlock, upsertAgentsBlock, START_MARKER, END_MARKER };
