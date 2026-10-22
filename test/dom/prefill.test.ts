import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { entryView } from "../../src/player-ui";

// Drives the real inline identity script: submitting the pick form stores the identity, and the form prefills from it on the next visit.
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
  const pickForm = () => String(entryView(1, 3, {}, undefined, "S"));

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
    const markup = String(entryView(1, 3, { email: "s@x.com", display_name: "Server" }, undefined, "S"));
    const t = load(markup, JSON.stringify({ email: "a@x.com", display_name: "Ann" }));
    expect([t.email(), t.name()]).toEqual(["s@x.com", "Server"]);
  });

  it("submitting the form stores the identity for the next visit", () => {
    const t = load(pickForm());
    const doc = t.dom.window.document;
    doc.querySelector<HTMLInputElement>("input[name=email]")!.value = " a@x.com ";
    doc.querySelector<HTMLInputElement>("input[name=display_name]")!.value = "Ann";
    doc.querySelector("form")!.dispatchEvent(new t.dom.window.Event("submit", { cancelable: true }));
    expect(JSON.parse(t.dom.window.localStorage.getItem(KEY)!)).toEqual({ email: "a@x.com", display_name: "Ann" });
  });
});
