#!/bin/bash
cd /opt/ai-orchestrator
DB_ROOT_PASS=$(awk -F= '/^DB_ROOT_PASSWORD/{print $2}' .env)
sudo docker compose exec -T db mysql -u root -p"$DB_ROOT_PASS" agentstack -e "SELECT id, unionId, name, email, password_hash IS NOT NULL AS has_password, createdAt FROM users;"
