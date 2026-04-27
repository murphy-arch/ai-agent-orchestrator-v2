import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "orchestrator",
    password: "orchestrator123",
    database: "agentstack",
  });

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS human_approvals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      run_id INT NOT NULL,
      node_id INT NOT NULL,
      stack_id INT NOT NULL,
      user_id INT,
      status VARCHAR(20) DEFAULT 'pending',
      context TEXT,
      response TEXT,
      prompt TEXT,
      timeout_minutes INT DEFAULT 0,
      timeout_action VARCHAR(20) DEFAULT 'approve',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      INDEX idx_run_id (run_id),
      INDEX idx_stack_id_status (stack_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log("[migration-003] human_approvals table created.");
  await connection.end();
}

main().catch((err) => {
  console.error("[migration-003] Failed:", err);
  process.exit(1);
});
