// GETSITREP-27: builds a draft PROJECT_PLAN.md from templates/PROJECT_PLAN.md
// + repo introspection + an optional user-provided one-line brief.
//
// Deliberately conservative: only the header fields, Product Vision, and
// Tech Stack line are substituted. Phases/Decisions/Risks/Future stay as
// the template's own generic starter examples — inventing believable-
// looking phases from a repo scan would be worse than an honest, obviously-
// a-template placeholder the human is expected to edit.

const path = require('path');
const { readIfExists } = require('./fs-helpers');
const { today } = require('./dates');

function buildDraftPlan(templateContent, { name, description, techStack, owner, userBrief }) {
  let content = templateContent;

  content = content.replace(/^# My Project — Master Project Plan$/m, `# ${name} — Master Project Plan`);
  content = content.replace(/^> \*\*Project:\*\* My Project$/m, `> **Project:** ${name}`);
  content = content.replace(/^> \*\*Owner:\*\* Your Name$/m, `> **Owner:** ${owner || 'Your Name'}`);
  content = content.replace(/^> \*\*Started:\*\* 2026-01-15$/m, `> **Started:** ${today()}`);
  content = content.replace(/^> \*\*Last Updated:\*\* 2026-01-15$/m, `> **Last Updated:** ${today()}`);

  const vision = userBrief || description;
  if (vision) {
    content = content.replace(
      /^A brief description of what you're building and why\. Replace this with your project's purpose\.$/m,
      vision
    );
  }

  if (techStack) {
    content = content.replace(
      /^\*\*Tech Stack:\*\* Replace with your stack \(e\.g\., Next\.js, FastAPI, PostgreSQL\)$/m,
      `**Tech Stack:** ${techStack}`
    );
  }

  return content;
}

// Reads templates/PROJECT_PLAN.md from the package's own install location
// (same __dirname-relative resolution as manifest.js's packageCommandsDir)
// — works regardless of which project directory the CLI is invoked from.
function readPlanTemplate() {
  return readIfExists(path.join(__dirname, '..', '..', 'templates', 'PROJECT_PLAN.md'));
}

module.exports = { buildDraftPlan, readPlanTemplate };
