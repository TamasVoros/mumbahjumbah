import { resolve } from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  const alias = { harfbuzzjs: resolve("src/harfbuzz-shim.ts") };
  return {
    test: {
      projects: [
        {
          resolve: { alias },
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            }),
          ],
          test: {
            name: "workers",
            include: ["test/**/*.test.ts"],
            exclude: ["test/dom/**"],
            setupFiles: ["./test/setup.ts"],
          },
        },
        // Browser-behaviour tests run under jsdom in plain Node (workerd has no DOM).
        { test: { name: "dom", include: ["test/dom/**/*.test.ts"], environment: "node" } },
      ],
    },
  };
});
