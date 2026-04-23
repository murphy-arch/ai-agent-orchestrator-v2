-- ============================================================
-- Migration 002: Rename old columns to new schema
-- Idempotent: safe to run multiple times
-- Run this BEFORE deploying v2.0.0 if your DB has old column names
-- ============================================================

-- ─── ai_agents column renames ───
-- Rename connectedModel → model_name (if old column exists)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'connectedModel'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents CHANGE connectedModel model_name VARCHAR(100) DEFAULT "gpt-4o"',
  'SELECT "connectedModel already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename modelProvider → model_provider
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'modelProvider'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents CHANGE modelProvider model_provider VARCHAR(50) DEFAULT "openai"',
  'SELECT "modelProvider already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename hierarchyRole → hierarchy_role
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'hierarchyRole'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents CHANGE hierarchyRole hierarchy_role VARCHAR(30) DEFAULT "worker"',
  'SELECT "hierarchyRole already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename maxTokens → max_tokens
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'maxTokens'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents CHANGE maxTokens max_tokens INT DEFAULT 2048',
  'SELECT "maxTokens already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename isEnabled → is_enabled
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'isEnabled'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents CHANGE isEnabled is_enabled BOOLEAN DEFAULT TRUE',
  'SELECT "isEnabled already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Convert temperature from string/varchar to INT (0.7 → 70)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'temperature'
    AND data_type IN ('varchar', 'char', 'text')
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents ADD COLUMN temp_temperature INT DEFAULT 70',
  'SELECT "temperature is already numeric or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'temp_temperature'
);
SET @sql = IF(@col_exists > 0,
  'UPDATE ai_agents SET temp_temperature = CAST(CAST(temperature AS DECIMAL(5,2)) * 100 AS SIGNED) WHERE temp_temperature IS NULL',
  'SELECT "temp_temperature not needed" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'temp_temperature'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE ai_agents DROP COLUMN temperature, CHANGE temp_temperature temperature INT DEFAULT 70',
  'SELECT "temperature conversion already done" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add temperature column if completely missing
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'temperature'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE ai_agents ADD COLUMN temperature INT DEFAULT 70',
  'SELECT "temperature already exists" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old columns that no longer exist in schema (if present)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'status'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE ai_agents DROP COLUMN status', 'SELECT "status column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'lastTestedAt'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE ai_agents DROP COLUMN lastTestedAt', 'SELECT "lastTestedAt column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'lastError'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE ai_agents DROP COLUMN lastError', 'SELECT "lastError column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'spawnMode'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE ai_agents DROP COLUMN spawnMode', 'SELECT "spawnMode column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'ai_agents'
    AND column_name = 'parentAgentId'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE ai_agents DROP COLUMN parentAgentId', 'SELECT "parentAgentId column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─── api_keys column renames ───
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'api_keys'
    AND column_name = 'serviceName'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE api_keys CHANGE serviceName provider VARCHAR(50) NOT NULL',
  'SELECT "serviceName already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add key_label and key_value if using old schema
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'api_keys'
    AND column_name = 'keyLabel'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE api_keys ADD COLUMN key_label VARCHAR(255) NOT NULL DEFAULT "API Key"',
  'SELECT "key_label already exists" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'api_keys'
    AND column_name = 'keyValue'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE api_keys ADD COLUMN key_value TEXT NOT NULL',
  'SELECT "key_value already exists" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─── input_sources column renames ───
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'input_sources'
    AND column_name = 'webhook_url'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE input_sources DROP COLUMN webhook_url', 'SELECT "webhook_url column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'input_sources'
    AND column_name = 'target_node_id'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE input_sources DROP COLUMN target_node_id', 'SELECT "target_node_id column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'input_sources'
    AND column_name = 'credentials'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE input_sources DROP COLUMN credentials', 'SELECT "credentials column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add config JSON if missing
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'input_sources'
    AND column_name = 'config'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE input_sources ADD COLUMN config JSON',
  'SELECT "config already exists" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ─── users table cleanup ───
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'unionId'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE users DROP COLUMN unionId', 'SELECT "unionId column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'lastSignInAt'
);
SET @sql = IF(@col_exists > 0, 'ALTER TABLE users DROP COLUMN lastSignInAt', 'SELECT "lastSignInAt column not present" AS msg');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add password_hash if using old passwordHash naming
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'passwordHash'
);
SET @sql = IF(@col_exists > 0,
  'ALTER TABLE users CHANGE passwordHash password_hash VARCHAR(255) NOT NULL',
  'SELECT "passwordHash already renamed or does not exist" AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '[migration-002] Column rename migration complete' AS result;
