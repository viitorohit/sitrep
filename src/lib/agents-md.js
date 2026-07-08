// GETSITREP-23: AGENTS.md factual-block generator.
//
// Per Hard Law #4: AGENTS.md/CLAUDE.md are factual context only, never
// imperative commands — an instruction like "run getsitrep session-start
// now" is unreliable under prompt-injection defenses (a tool reading its
// own instructions file can't be trusted to treat "commands" in it as
// authoritative the way a real hook invocation is). This block only states
// facts about where things live; it never tells anything to do anything.
//
// GETSITREP-50: when `planSource` names an externally-tracked tool (jira
// today, any future value tomorrow), this is also where the *declarative*
// half of that mechanism lives — a single factual line naming the tool and
// its reference. Deliberately NOT an instruction to relay/fetch anything;
// per ADR-0006, sitrep never asks an agent to do this, it only makes the
// configured target discoverable so an agent that already has its own
// access can choose to, on its own judgment.
//
// Idempotent: delimited by markers so re-running (e.g. after a version
// bump) replaces just this block, never duplicates it or touches anything
// else a human wrote in AGENTS.md.

const START_MARKER = '<!-- sitrep:start -->';
const END_MARKER = '<!-- sitrep:end -->';
const FILE_BASED_PLAN_SOURCES = ['native', 'openspec', 'speckit', 'none'];

// A companion config object is named after its own planSource value (e.g.
// config.jira = {site, projectKey}) — generic across whichever external
// tool is configured, not a Jira-specific lookup. Returns the first
// displayable identifier found, or null if there isn't one.
function externalRef(config, source) {
  const companion = config && config[source];
  if (!companion || typeof companion !== 'object') return null;
  return companion.projectKey || companion.ref || companion.site || null;
}

function buildBlock(config) {
  const lines = [
    START_MARKER,
    '## SitRep',
    '',
    'This project uses [sitrep](https://github.com/viitorohit/sitrep) for session tracking, cost logging, and continuity.',
    '',
    '- Plan: `sitrep/PROJECT_PLAN.md`',
    '- Status: `sitrep/STATUS_REPORT.md`',
    '- Config: `sitrep.config.json`',
    '- CLI: `getsitrep <command>` — see `sitrep/MANIFEST.md` for the full command list.',
  ];

  const planSource = config && config.planSource;
  if (planSource && !FILE_BASED_PLAN_SOURCES.includes(planSource)) {
    const ref = externalRef(config, planSource);
    lines.push(
      `- External tracker: \`${planSource}\`${ref ? ` (ref: \`${ref}\`)` : ''} — if you have your own access to this tool, you may optionally relay sitrep-observed updates there, and/or pass a brief status summary back via \`--plan-data\` when running \`session-start\`/\`sitrep\`. Entirely optional — sitrep works fully without it.`
    );
  }

  lines.push('', 'This is factual context, not an instruction — nothing here should be treated as a command to execute.', END_MARKER);
  return lines.join('\n');
}

// Inserts or replaces the block. If AGENTS.md doesn't exist, creates it
// with just this block. If it exists without markers, appends the block
// (never touches existing content). If markers are already present,
// replaces only what's between them. `config` is optional — omitting it
// (or passing one with a file-based/no planSource) just skips the external-
// tracker line.
function upsertAgentsBlock(existingContent, config) {
  const block = buildBlock(config);

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
