import type { Session } from "../sessions";

export const statusUrl = (s: Session) => `/i/${s.invite_link_token}/status`;

// Only meaningful while the timer runs; `now` is the server clock the client derives its offset from.
export const timerInfo = (s: Session, now: number) => ({
  endsAt: Date.parse(s.timer_ends_at ?? ""),
  seconds: s.timer_seconds ?? 0,
  now,
  statusUrl: statusUrl(s),
});

export const pickedWords = (raw: Record<string, unknown>) => [raw["pick"]].flat().filter((p): p is string => typeof p === "string");
