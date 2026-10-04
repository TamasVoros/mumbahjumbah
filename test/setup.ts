import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Applies migrations/*.sql to the isolated test D1 before each test file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
