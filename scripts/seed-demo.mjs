// Seeds a fixed demo Session into the LOCAL dev database so the UI can be reviewed after every change.
//
//   npm run dev                       (in one terminal)
//   npm run seed:demo                 (open stage: 7 participants have submitted)
//   npm run seed:demo -- --stage locked   (+ locked, ready for the transcript upload)
//   npm run seed:demo -- --stage scored   (+ scripts/demo/transcript.vtt uploaded: leaderboard and recap)
//
// Re-running deletes and recreates the demo Session, so it always starts from the same state.
// Only ever touches the local D1 (--local) and a local server; there is no flag to point it at prod.
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const INVITE_TOKEN = "demo-invite-0000000000000000000000000000000000";
export const ORGANIZER_TOKEN = "demo-organizer-00000000000000000000000000000000";
const SESSION_NAME = "Q4 Planning Sync (demo)";
const PICK_COUNT = 9;

// Picks chosen to exercise scoring: crowd favourites (rarity discount), unique phrases, repeated words
// in the transcript (diminishing frequency) and misses worth 0.
const PARTICIPANTS = [
  ["priya@demo.test", "Priya", ["synergy", "roadmap", "move the needle", "circle back", "stakeholders", "bandwidth", "pivot", "agile", "kpi"]],
  ["marcus@demo.test", "Marcus", ["synergy", "roadmap", "low-hanging fruit", "circle back", "ai", "ecosystem", "blockchain", "leverage", "alignment"]],
  ["dana@demo.test", "Dana", ["synergy", "bandwidth", "at the end of the day", "deep dive", "blockers", "scalable", "metaverse", "roi", "going forward"]],
  ["tomas@demo.test", "Tomas", ["synergy", "roadmap", "ai", "circle back", "paradigm shift", "touch base", "take this offline", "deliverable", "disrupt"]],
  ["aisha@demo.test", "Aisha", ["ai", "deep dive", "stakeholders", "ecosystem", "pivot", "ROI", "north star", "sprint", "quantum"]],
  ["jun@demo.test", "Jun", ["roadmap", "bandwidth", "kpi", "low-hanging fruit", "boil the ocean", "force multiplier", "retention", "synergy", "agile"]],
  ["sam@demo.test", "Sam", ["ai"]],
];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const stage = flag("stage", "open");
const base = flag("base", "http://localhost:8787").replace(/\/$/, "");
if (!["open", "locked", "scored"].includes(stage)) {
  console.error(`--stage must be open, locked or scored (got "${stage}")`);
  process.exit(1);
}

const sql = `
DELETE FROM jargon_results WHERE session_id IN (SELECT id FROM sessions WHERE organizer_link_token = '${ORGANIZER_TOKEN}');
DELETE FROM picks WHERE participant_id IN (SELECT p.id FROM participants p JOIN sessions s ON s.id = p.session_id WHERE s.organizer_link_token = '${ORGANIZER_TOKEN}');
DELETE FROM participants WHERE session_id IN (SELECT id FROM sessions WHERE organizer_link_token = '${ORGANIZER_TOKEN}');
DELETE FROM sessions WHERE organizer_link_token = '${ORGANIZER_TOKEN}';
INSERT INTO sessions (operator_id, pick_count, organizer_link_token, invite_link_token, name)
VALUES (1, ${PICK_COUNT}, '${ORGANIZER_TOKEN}', '${INVITE_TOKEN}', '${SESSION_NAME}');
`;

const dir = mkdtempSync(join(tmpdir(), "mj-seed-"));
const sqlFile = join(dir, "seed.sql");
writeFileSync(sqlFile, sql);
try {
  execSync(`npx wrangler d1 execute DB --local --file "${sqlFile}"`, { stdio: "inherit" });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

async function post(path, body) {
  const res = await fetch(base + path, { method: "POST", body, redirect: "manual" });
  return res;
}

for (const [email, name, picks] of PARTICIPANTS) {
  const form = new URLSearchParams({ email, display_name: name });
  for (const p of picks) form.append("pick", p);
  const res = await post(`/i/${INVITE_TOKEN}`, form);
  if (res.status !== 200) throw new Error(`submit for ${name} failed: ${res.status}`);
}
console.log(`seeded ${PARTICIPANTS.length} participants`);

if (stage !== "open") {
  const res = await post(`/o/${ORGANIZER_TOKEN}/lock`, new URLSearchParams());
  if (res.status !== 200) throw new Error(`lock failed: ${res.status}`);
  console.log("locked");
}

if (stage === "scored") {
  const path = fileURLToPath(new URL("./demo/transcript.vtt", import.meta.url));
  const form = new FormData();
  form.set("transcript", new File([readFileSync(path)], "transcript.vtt", { type: "text/vtt" }));
  const res = await post(`/o/${ORGANIZER_TOKEN}/transcript`, form);
  if (res.status !== 303) throw new Error(`transcript upload failed: ${res.status}`);
  console.log("transcript uploaded");
}

console.log(`
Stage: ${stage}
  Organizer   ${base}/o/${ORGANIZER_TOKEN}
  Invite      ${base}/i/${INVITE_TOKEN}
  Leaderboard ${base}/o/${ORGANIZER_TOKEN}/leaderboard
  Recap card  ${base}/o/${ORGANIZER_TOKEN}/recap.png
  Transcript  scripts/demo/transcript.vtt (upload or paste at the transcript step)
`);
