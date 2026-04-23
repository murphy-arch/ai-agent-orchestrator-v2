#!/bin/bash
BACKUP_DIR=/opt/backups/mysql
DB_NAME=ai_orchestrator
DB_USER=root
DB_PASS=$(grep DB_PASSWORD /opt/ai-orchestrator/.env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DATE=$(date +%Y%m%d_%H%M%S)
FILE=$BACKUP_DIR/ai_orchestrator_$DATE.sql

# Run backup
docker exec ai-orchestrator-db mysqldump -u$DB_USER -p$DB_PASS $DB_NAME > $FILE

# Compress
gzip $FILE

# Keep only last 7 days
find $BACKUP_DIR -name '*.sql.gz' -mtime +7 -delete

# Log
echo "[$(date)] Backup completed: $FILE.gz"
