import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ASSETS: Fetcher;
      SESSIONS_LIMITER: RateLimit;
      INVITE_LIMITER: RateLimit;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
