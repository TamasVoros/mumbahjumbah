import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { entryView } from "../../src/player-ui";

// Drives the real inline pick-entry script against the server-rendered HTML.
const load = async (count = 3, values: Parameters<typeof entryView>[2] = {}, error?: string) => {
  const markup = String(await entryView(7, count, values, error));
  const dom = new JSDOM(markup, { runScripts: "dangerously" });
  const { document } = dom.window;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const field = $<HTMLInputElement>("pickfield");
  const type = (word: string) => {
    field.value = word;
    return field.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  };
  const form = document.querySelector("form") as HTMLFormElement;
  return {
    dom, document, $, field, type, form, markup,
    pills: () => [...document.querySelectorAll("#pills li")].map((li) => li.firstChild!.textContent),
    posted: () => new dom.window.FormData(form).getAll("pick"),
  };
};

describe("pick-entry script", () => {
  it("starts with an empty, disabled grid and shows the app (JS on)", async () => {
    const t = await load(3);
    expect(t.$("pickapp").hidden).toBe(false);
    expect(t.$("count").textContent).toBe("YOUR PICKS · 0 / 3");
    expect(t.$<HTMLButtonElement>("submit").disabled).toBe(true);
    expect(t.$("submit").textContent).toBe("Submit grid · 3 to go");
  });

  it("Enter adds a pick as a normalised pill, clears the field, and does not submit", async () => {
    const t = await load(3);
    const notPrevented = t.type("  Synergy   Pivot ");
    expect(notPrevented).toBe(false); // preventDefault called, so the form is not submitted
    expect(t.pills()).toEqual(["synergy pivot"]);
    expect(t.field.value).toBe("");
    expect(t.$("count").textContent).toBe("YOUR PICKS · 1 / 3");
    expect(t.$("submit").textContent).toBe("Submit grid · 2 to go");
  });

  it("the Add button adds a pick too", async () => {
    const t = await load(3);
    t.field.value = "roadmap";
    t.$("pickadd").click();
    expect(t.pills()).toEqual(["roadmap"]);
  });

  it("ignores blank input", async () => {
    const t = await load(3);
    t.type("   ");
    expect(t.pills()).toEqual([]);
  });

  it("rejects a duplicate (case/space-insensitive) with a message and keeps the typed text", async () => {
    const t = await load(3);
    t.type("synergy");
    t.type("  SYNERGY ");
    expect(t.pills()).toEqual(["synergy"]);
    expect(t.$("msg").className).toBe("msg err");
    expect(t.$("msg").textContent).toContain("already in your picks");
    expect(t.field.value).toBe("  SYNERGY ");
  });

  it("× removes a pick, re-numbers the counter, and re-enables the entry field", async () => {
    const t = await load(2);
    t.type("a");
    t.type("b");
    expect(t.$("entry").hidden).toBe(true);
    expect(t.$("full").hidden).toBe(false);
    (t.document.querySelector("#pills li button") as HTMLButtonElement).click();
    expect(t.pills()).toEqual(["b"]);
    expect(t.$("entry").hidden).toBe(false);
    expect(t.$("full").hidden).toBe(true);
    expect(t.$("count").textContent).toBe("YOUR PICKS · 1 / 2");
    expect(t.$<HTMLButtonElement>("submit").disabled).toBe(true);
  });

  it("submit enables exactly at N picks, field is replaced by the full message, and no more can be added", async () => {
    const t = await load(2);
    t.type("a");
    expect(t.$<HTMLButtonElement>("submit").disabled).toBe(true);
    t.type("b");
    expect(t.$<HTMLButtonElement>("submit").disabled).toBe(false);
    expect(t.$("submit").textContent).toBe("Submit grid");
    expect(t.$("full").textContent).toContain("All 2 picked. Remove one to swap it.");
    t.type("c");
    expect(t.pills()).toEqual(["a", "b"]);
    expect(t.$("fill").style.width).toBe("100%");
  });

  it("posts one hidden `pick` input per pill, in order", async () => {
    const t = await load(3);
    t.type("one");
    t.type("two");
    t.type("three");
    expect(t.posted()).toEqual(["one", "two", "three"]);
    expect(t.document.querySelectorAll('#hidden input[type="hidden"][name="pick"]').length).toBe(3);
  });

  it("pre-populates prior picks after a failed submit (HTML-escaped, not injected)", async () => {
    const t = await load(3, { picks: ["<b>x</b>", "y"], email: "a@b.co" }, "Something was wrong");
    expect(t.pills()).toEqual(["<b>x</b>", "y"]);
    expect(t.document.querySelector("#pills b")).toBeNull();
    expect(t.posted()).toEqual(["<b>x</b>", "y"]);
    expect(t.$("count").textContent).toBe("YOUR PICKS · 2 / 3");
    expect(t.document.querySelector('[role="alert"]')!.textContent).toBe("Something was wrong");
  });

  it("JS-off fallback: <noscript> offers N plain pick inputs and a submit button", async () => {
    const t = await load(4, { picks: ["a"] });
    const ns = t.document.querySelector("noscript")!;
    // jsdom with scripting enabled treats noscript content as text; parse it.
    const inner = new JSDOM(`<body>${ns.textContent}</body>`).window.document;
    const inputs = [...inner.querySelectorAll('input[name="pick"]')] as HTMLInputElement[];
    expect(inputs.length).toBe(4);
    expect(inputs[0]!.value).toBe("a");
    expect(inner.querySelector('button[type="submit"]')).not.toBeNull();
  });
});
