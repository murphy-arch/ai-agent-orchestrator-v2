import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const isPlanetScale = env.databaseUrl.includes("psdb.cloud") || env.databaseUrl.includes("planetscale");
    instance = drizzle(env.databaseUrl, {
      mode: isPlanetScale ? "planetscale" : "default",
      schema: fullSchema,
    });
  }
  return instance;
}
