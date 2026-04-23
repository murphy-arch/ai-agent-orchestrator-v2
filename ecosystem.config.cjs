module.exports = {
  apps: [{
    name: "ai-orchestrator",
    script: "./dist/boot.js",
    cwd: "/opt/ai-orchestrator",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    // Logging
    log_file: "./logs/combined.log",
    out_file: "./logs/out.log",
    error_file: "./logs/error.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    // Restart policy
    min_uptime: "10s",
    max_restarts: 5,
    // Memory limit
    max_memory_restart: "1G",
    // Auto-restart
    autorestart: true,
    kill_timeout: 5000,
    // Health check grace period
    health_check_grace_period: 30000,
  }],
};
