// GETSITREP-48: cost-to-outcome pipeline.
//
// Attributes each session's already-recorded cost/tokens (session-end.js
// owns collecting those, this module never re-measures anything) to plan
// phases and to individual tickets/tasks, so downstream consumers
// (GETSITREP-42 dashboard charts, GETSITREP-44 model breakdown, GETSITREP-53
// cost advisory) can answer "what did phase/ticket X cost" without each
// re-deriving the mapping themselves.
//
// Two task-ID conventions coexist in this project's own real data (see
// sitrep/.sitrep-data.json): legacy "N.X" IDs from Phases 1-2, and Jira Story
// keys ("GETSITREP-N") from Phase 3 onward, where Jira is the roadmap source
// of truth (per CLAUDE.md) and PROJECT_PLAN.md just lists the same keys in
// its Tier tables rather than assigning its own numbering. A legacy ID
// encodes its phase in the ID itself; a Jira key doesn't, so it's resolved by
// checking which Phase section's body text mentions that key. A key that
// appears in neither form is left unattributed at the phase level rather
// than guessed — surfaced in the `unattributed` list instead. In practice
// this also catches subtask keys PROJECT_PLAN.md only mentions via a
// compressed shorthand ("subtasks GETSITREP-9/10/12 all Done") rather than
// spelling each one out — "GETSITREP-12" isn't a literal substring of that
// text even though the work it names is real. This doesn't lose any money:
// as long as at least one sibling ID from the same session resolves to a
// phase, that session's full cost still lands in `byPhase` — the
// unattributed list is a per-ID transparency detail, not a financial gap.
//
// A session that touches multiple tickets, or tickets spanning multiple
// phases, has its cost/tokens split evenly across whatever it touched at
// that level (per-ticket split for `byTicket`, per-distinct-phase split for
// `byPhase` — these are computed independently, not by summing per-ticket
// shares, so a session with 3 tickets all in the same phase attributes its
// full cost to that one phase, not one-third of it). This is a deliberately
// simple, honest allocation — sitrep has no finer-grained signal than "this
// session touched these tickets" to split by, so it doesn't pretend to.
//
// Every aggregate keeps the `actual`/`estimate` label of the sessions that
// fed it. If a phase or ticket drew from sessions with different labels, the
// aggregate is labeled `mixed` rather than picking one and hiding the
// blend — per the project's cost-schema hard law, no figure may imply more
// precision than it has.

const { extractPhaseHeadings } = require('./markdown');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Phase sections as { number, name, bodyText }, bodyText running from just
// after this phase's heading to just before the next phase heading (or end
// of document for the last one). Used only to test "does this phase's
// section mention ticket key X" — not a full markdown parse.
function extractPhaseSections(planContent) {
  if (!planContent) return [];
  const headings = extractPhaseHeadings(planContent);
  const re = /^##\s*Phase\s+\d+:/gm;
  const positions = [];
  let match;
  while ((match = re.exec(planContent)) !== null) {
    positions.push(match.index);
  }
  return headings.map((h, i) => {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : planContent.length;
    return { number: h.number, name: h.name, bodyText: planContent.slice(start, end) };
  });
}

const LEGACY_ID_RE = /^(\d+)\.\d+$/;

// Resolves a single task/ticket ID to a phase number, or null if it can't be
// determined — never a guess. Legacy "N.X" IDs are self-describing; anything
// else (Jira keys, ad-hoc IDs) is resolved by literal substring membership in
// a phase section's body text.
function phaseForTaskId(id, phaseSections) {
  const legacyMatch = id.match(LEGACY_ID_RE);
  if (legacyMatch) return parseInt(legacyMatch[1], 10);
  const hit = phaseSections.find((p) => p.bodyText.includes(id));
  return hit ? hit.number : null;
}

function mergeLabel(existingLabel, incomingLabel) {
  if (!existingLabel) return incomingLabel;
  if (existingLabel === incomingLabel) return existingLabel;
  return 'mixed';
}

function bumpBucket(bucket, tokensShare, costShare, label, sessionNumber) {
  bucket.tokens = round2(bucket.tokens + tokensShare);
  if (costShare !== null) {
    bucket.cost_usd = round2((bucket.cost_usd || 0) + costShare);
  }
  bucket.cost_label = mergeLabel(bucket.cost_label, label);
  if (!bucket.sessions.includes(sessionNumber)) bucket.sessions.push(sessionNumber);
}

// Computes the full rollup from scratch every time (never an incremental
// add-on-top) — same reasoning as this project's other recompute-not-mutate
// fixes (e.g. checkProgressAccuracy's stale-object bug): re-deriving from
// `dataJson.sessions` each time means a hand-edited session record or a
// PROJECT_PLAN.md edit can never leave a stale, silently-wrong rollup behind.
function computeCostRollup(dataJson, planContent) {
  const phaseSections = extractPhaseSections(planContent);
  const byPhase = {};
  const byTicket = {};
  const byModel = {};
  const unattributed = [];

  for (const session of (dataJson && dataJson.sessions) || []) {
    const label = session.cost_label || 'estimate';
    const totalTokens = (session.tokens && session.tokens.total) || 0;
    const totalCost = typeof session.cost_usd === 'number' ? session.cost_usd : null;

    // GETSITREP-44: every session's full cost/tokens goes to its one model —
    // unlike by_phase/by_ticket, there's nothing to split, and this counts
    // even a session with no completed tasks (its spend still went
    // somewhere), so this lives outside the ids.length===0 guard below.
    const model = session.model || 'unknown';
    if (!byModel[model]) byModel[model] = { tokens: 0, cost_usd: 0, cost_label: null, sessions: [] };
    bumpBucket(byModel[model], totalTokens, totalCost, label, session.number);

    const ids = Array.isArray(session.tasks_completed) ? session.tasks_completed : [];
    if (ids.length === 0) continue;

    const perTicketTokens = totalTokens / ids.length;
    const perTicketCost = totalCost === null ? null : totalCost / ids.length;

    const phasesTouched = new Set();
    const idsUnattributed = [];
    for (const id of ids) {
      const phase = phaseForTaskId(id, phaseSections);
      if (phase !== null) phasesTouched.add(phase);
      else idsUnattributed.push(id);

      if (!byTicket[id]) byTicket[id] = { tokens: 0, cost_usd: 0, cost_label: null, sessions: [] };
      bumpBucket(byTicket[id], perTicketTokens, perTicketCost, label, session.number);
    }

    if (phasesTouched.size > 0) {
      const perPhaseTokens = totalTokens / phasesTouched.size;
      const perPhaseCost = totalCost === null ? null : totalCost / phasesTouched.size;
      for (const phase of phasesTouched) {
        if (!byPhase[phase]) byPhase[phase] = { tokens: 0, cost_usd: 0, cost_label: null, sessions: [] };
        bumpBucket(byPhase[phase], perPhaseTokens, perPhaseCost, label, session.number);
      }
    }

    if (idsUnattributed.length > 0) {
      unattributed.push({ session: session.number, ids: idsUnattributed });
    }
  }

  return { by_phase: byPhase, by_ticket: byTicket, by_model: byModel, unattributed };
}

module.exports = { extractPhaseSections, phaseForTaskId, computeCostRollup };
