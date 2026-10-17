import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { entryView, waitingView } from "../../src/player-ui";

// Drives the real inline identity script: waiting screen stores the identity, the pick form prefills from it.
const timer = { endsAt: Date.now() + 30_000, seconds: 30, now: Date.now(), statusUrl: "/i/tok123/status" };
const KEY = "mj:id:tok123";

const load = (markup: string, store?: string) => {
  const dom = new JSDOM(markup, {
    runScripts: "dangerously",
    url: "https://example.com/i/tok123",
    beforeParse(w) {
      if (store) w.localStorage.setItem(KEY, store);
    },
  });
  const f = (n: string) => dom.window.document.querySelector<HTMLInputElement>(`input[name=${n}]`)!;
  return { dom, email: () => f("email").value, name: () => f("display_name").value };
};

describe("identity prefill", () => {
  const pickForm = () => String(entryView(1, 3, {}, undefined, "S", timer));

  it("fills both pick-form fields from stored identity", () => {
    const t = load(pickForm(), JSON.stringify({ email: "a@x.com", display_name: "Ann" }));
    expect([t.email(), t.name()]).toEqual(["a@x.com", "Ann"]);
  });

  it("leaves them empty without storage or with garbage", () => {
    const a = load(pickForm());
    expect([a.email(), a.name()]).toEqual(["", ""]);
    const b = load(pickForm(), "{not json");
    expect([b.email(), b.name()]).toEqual(["", ""]);
  });

  it("does not overwrite server-provided values", () => {
    const markup = String(entryView(1, 3, { email: "s@x.com", display_name: "Server" }, undefined, "S", timer));
    const t = load(markup, JSON.stringify({ email: "a@x.com", display_name: "Ann" }));
    expect([t.email(), t.name()]).toEqual(["s@x.com", "Server"]);
  });

  it("waiting screen stores the identity for the pick form", () => {
    const t = load(String(waitingView(1, "/i/tok123/status", "S", undefined, { email: "a@x.com", displayName: "Ann" })));
    expect(JSON.parse(t.dom.window.localStorage.getItem(KEY)!)).toEqual({ email: "a@x.com", display_name: "Ann" });
  });
});
