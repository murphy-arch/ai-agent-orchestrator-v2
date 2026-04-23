import { createConnection } from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root:@localhost:3306/agentstack";

// Parse the DATABASE_URL manually
function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306"),
    user: u.username,
    password: decodeURIComponent(u.password || ""),
    database: u.pathname.replace(/^\//, ""),
    ssl: u.searchParams.get("ssl") === "true" ? {} : undefined,
  };
}

async function migrate() {
  const config = parseUrl(DATABASE_URL);
  const conn = await createConnection(config);

  console.log("Connected to database. Running migrations...");

  // Add new columns to ai_agents
  try {
    await conn.execute(`ALTER TABLE ai_agents ADD COLUMN last_tested_at TIMESTAMP NULL`);
    console.log("  + last_tested_at column added");
  } catch {
    console.log("  ~ last_tested_at already exists");
  }

  try {
    await conn.execute(`ALTER TABLE ai_agents ADD COLUMN last_error TEXT`);
    console.log("  + last_error column added");
  } catch {
    console.log("  ~ last_error already exists");
  }

  // Create conversations table
  try {
    await conn.execute(`
      CREATE TABLE conversations (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        agent_id BIGINT UNSIGNED NOT NULL,
        role ENUM('system','user','assistant') NOT NULL,
        content TEXT NOT NULL,
        tokens_used INT,
        latency INT,
        model VARCHAR(255),
        provider VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_agent_id (agent_id),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log("  + conversations table created");
  } catch {
    console.log("  ~ conversations table already exists");
  }

  // Create agent_logs table
  try {
    await conn.execute(`
      CREATE TABLE agent_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        agent_id BIGINT UNSIGNED NOT NULL,
        event_type ENUM('chat','test','error','status_change','webhook') NOT NULL,
        message TEXT NOT NULL,
        tokens_used INT,
        latency INT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        INDEX idx_agent_id (agent_id),
        INDEX idx_event_type (event_type),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log("  + agent_logs table created");
  } catch {
    console.log("  ~ agent_logs table already exists");
  }

  console.log("Migration complete!");
  await conn.end();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
