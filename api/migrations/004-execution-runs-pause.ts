import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "orchestrator",
    password: "orchestrator123",
    database: "agentstack",
  });

  const columns = [
    "paused_node_id INT",
    "session_variables JSON",
  ];
  for (const col of columns) {
    const name = col.split(" ")[0];
    try {
      await connection.execute(`ALTER TABLE execution_runs ADD COLUMN ${col}`);
      console.log(`[migration-004] Added ${name}`);
    } catch (e: any) {
      if (e.message?.includes("Duplicate column")) {
        console.log(`[migration-004] ${name} already exists`);
      } else {
        console.error(`[migration-004] Error adding ${name}:`, e.message);
      }
    }
  }

  console.log("[migration-004] Done.");
  await connection.end();
}

main().catch((err) => {
  console.error("[migration-004] Failed:", err);
  process.exit(1);
});
