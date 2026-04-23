import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: mysql.Pool | null = null;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL || "mysql://root:rootpassword@localhost:3306/agent_platform";
    pool = mysql.createPool({
      uri: databaseUrl,
      connectionLimit: 10,
      queueLimit: 0,
    });
    db = drizzle(pool, { schema, mode: "default" });
  }
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
