/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import indexSrc from "../src/index.ts?raw";
import adr from "../docs/adr/0004-module-map.md?raw";

const sources = import.meta.glob("../src/**/*.ts", { query: "?raw", eager: true });

describe("module map (ADR-0004)", () => {
  it("every src path named in the ADR exists", () => {
    const paths = [...adr.matchAll(/`(src\/[^`]+?)`/g)].map((m) => m[1]!);
    expect(paths.length).toBeGreaterThan(10);
    for (const p of paths) {
      const isDir = p.endsWith("/");
      const found = Object.keys(sources).some((k) => (isDir ? k.startsWith(`../${p}`) : k === `../${p}`));
      expect(found, p).toBe(true);
    }
  });

  it("src/index.ts is routing only: no markup, CSS or hono/html", () => {
    const code = indexSrc
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(code).not.toMatch(/hono\/html/);
    expect(code).not.toMatch(/<\/?(html|head|body|style|section|div|main)\b/);
    expect(code).not.toMatch(/font-family|box-sizing/);
  });

  it("the pages module has an entry point exporting the router's screens", async () => {
    const pages = await import("../src/pages");
    for (const name of ["createForm", "leaderboardPage", "notFoundPage", "organizerView", "entryView", "plansPage"]) {
      expect(typeof (pages as Record<string, unknown>)[name], name).toBe("function");
    }
  });
});
