// GETSITREP-19: sitrep.config.json schema + read/write helpers.
//
// Schema (v1):
//   {
//     "version": 1,
//     "planSource": "native" | "jira" | "openspec" | "speckit" | "none",
//     "jira": { "site": "...", "projectKey": "..." },   // present only if planSource === "jira"
//     "costSource": "manual" | "ccusage" | "none",
//     "tools": ["claude-code", "codex", "cursor", "copilot"],
//     "createdAt": "<ISO date>"
//   }
//
// Field names/options match docs/specs/adapter-contract.md's plan-source and
// cost-source adapter types exactly (Jira/OpenSpec/Spec Kit/native, and
// ccusage/thin-local-log) — this file is the concrete persistence of that
// contract's choices, not a new vocabulary.
//
// NEVER add a token/credential/secret field to this schema, for jira or any
// future external tool. sitrep.config.json is tracked in git, not
// gitignored — any field here is committed by default. Credentials never
// enter sitrep at all; see ADR-0006 and src/lib/plan-adapters.js's
// readExternalPlan(). `jira: {site, projectKey}` are non-secret identifiers,
// fine to keep committed.
//
// GETSITREP-50: any `planSource` value beyond native/openspec/speckit/none
// is treated generically as an externally-tracked tool by
// src/lib/plan-adapters.js's readExternalPlan() and src/lib/agents-md.js's
// declarative block — adding a new one (asana, linear, github, ...) needs
// no new reader code, just adding its name below and to init.js's wizard
// options.

const { readJsonIfExists, writeJson } = require('./fs-helpers');
const paths = require('./paths');

const PLAN_SOURCES = ['native', 'jira', 'openspec', 'speckit', 'none'];
const COST_SOURCES = ['manual', 'ccusage', 'none'];
const TOOLS = ['claude-code', 'codex', 'cursor', 'copilot'];

function readConfig() {
  return readJsonIfExists(paths.SITREP_CONFIG());
}

function writeConfig(config) {
  writeJson(paths.SITREP_CONFIG(), config);
}

// Builds a schema-valid config object from wizard answers. Does not write —
// callers decide when persisting is appropriate (e.g. after residue/confirm
// checks).
function buildConfig({ planSource, jiraSite, jiraProjectKey, costSource, tools }) {
  const config = {
    version: 1,
    planSource,
    costSource,
    tools: tools || [],
    createdAt: new Date().toISOString(),
  };
  if (planSource === 'jira') {
    config.jira = { site: jiraSite || '', projectKey: jiraProjectKey || '' };
  }
  return config;
}

module.exports = {
  PLAN_SOURCES,
  COST_SOURCES,
  TOOLS,
  readConfig,
  writeConfig,
  buildConfig,
};
