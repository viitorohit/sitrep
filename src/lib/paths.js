// Central definition of every sitrep/ file path, relative to the current
// working directory (the project root the CLI is invoked from — same
// convention install.sh already uses).

const path = require('path');

const cwd = () => process.cwd();

const SITREP_DIR = () => path.join(cwd(), 'sitrep');
const MANIFEST = () => path.join(SITREP_DIR(), 'MANIFEST.md');
const PROJECT_PLAN = () => path.join(SITREP_DIR(), 'PROJECT_PLAN.md');
const STATUS_REPORT = () => path.join(SITREP_DIR(), 'STATUS_REPORT.md');
const DATA_JSON = () => path.join(SITREP_DIR(), '.sitrep-data.json');
const HASH_MANIFEST = () => path.join(SITREP_DIR(), '.sitrep-manifest.json');
const ACTIVE_SESSION = () => path.join(SITREP_DIR(), '.sitrep-active-session');
const HANDOFF = () => path.join(SITREP_DIR(), 'HANDOFF.md');
const DASHBOARD_HTML = () => path.join(SITREP_DIR(), 'dashboard.html');
const CLAUDE_MD = () => path.join(cwd(), 'CLAUDE.md');

const HISTORY_SESSIONS = () => path.join(SITREP_DIR(), 'history', 'sessions');
const HISTORY_HANDOFFS = () => path.join(SITREP_DIR(), 'history', 'handoffs');
const HISTORY_DASHBOARDS = () => path.join(SITREP_DIR(), 'history', 'dashboards');

module.exports = {
  SITREP_DIR,
  MANIFEST,
  PROJECT_PLAN,
  STATUS_REPORT,
  DATA_JSON,
  HASH_MANIFEST,
  ACTIVE_SESSION,
  HANDOFF,
  DASHBOARD_HTML,
  CLAUDE_MD,
  HISTORY_SESSIONS,
  HISTORY_HANDOFFS,
  HISTORY_DASHBOARDS,
};
