#!/bin/sh
set -e

DB_HOST="db"
DB_USER="root"
DB_PASS="rootpassword"
DB_NAME="agent_platform"
MIGRATION_FILE="/app/db/migrations/002-rename-columns.sql"

echo "[startup] Waiting for MySQL..."
until mysqladmin ping -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" --silent 2>/dev/null; do
  sleep 1
done
echo "[startup] MySQL is ready"

if [ -f "$MIGRATION_FILE" ]; then
  echo "[startup] Running DB migration..."
  if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$MIGRATION_FILE" 2>/dev/null; then
    echo "[startup] Migration completed successfully"
  else
    echo "[startup] Migration may have already been applied or encountered non-fatal errors, continuing..."
  fi
else
  echo "[startup] No migration file found, skipping"
fi

echo "[startup] Starting application..."
exec node dist/api.js
