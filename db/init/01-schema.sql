-- ============================================================
-- AI Agent Orchestrator — Multi-Stack SaaS Schema
-- Fresh install source of truth
-- ============================================================

-- ─── Users (global) ───
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Stacks ───
CREATE TABLE IF NOT EXISTS stacks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(100) NOT NULL UNIQUE,
  owner_id INT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  plan VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Stack Members ───
CREATE TABLE IF NOT EXISTS stack_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(20) DEFAULT 'member',
  invited_by INT,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_membership (stack_id, user_id),
  INDEX idx_members_stack (stack_id),
  INDEX idx_members_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── AI Agents ───
CREATE TABLE IF NOT EXISTS ai_agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT,
  hierarchy_role VARCHAR(30) DEFAULT 'worker',
  model_provider VARCHAR(50) DEFAULT 'openai',
  model_name VARCHAR(100) DEFAULT 'gpt-4o',
  temperature INT DEFAULT 70,
  max_tokens INT DEFAULT 2048,
  is_enabled BOOLEAN DEFAULT TRUE,
  avatar_url VARCHAR(500),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agents_stack (stack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── API Keys ───
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  key_label VARCHAR(255) NOT NULL,
  key_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_api_keys_stack (stack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Workflow Nodes ───
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  agent_id INT,
  type VARCHAR(50) NOT NULL,
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  data JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nodes_stack (stack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Workflow Edges ───
CREATE TABLE IF NOT EXISTS workflow_edges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  source_id INT NOT NULL,
  target_id INT NOT NULL,
  `condition` VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_edges_stack (stack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Input Sources ───
CREATE TABLE IF NOT EXISTS input_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  config JSON,
  is_active BOOLEAN DEFAULT TRUE,
  target_agent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inputs_stack (stack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Conversations ───
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  agent_id INT NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(50) DEFAULT 'web',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversations_stack (stack_id),
  INDEX idx_conversations_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Agent Logs ───
CREATE TABLE IF NOT EXISTS agent_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stack_id INT NOT NULL,
  agent_id INT NOT NULL,
  level VARCHAR(20) DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_stack (stack_id),
  INDEX idx_logs_agent (agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
