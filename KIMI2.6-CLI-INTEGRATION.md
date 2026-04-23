# Kimi2.6 CLI Integration Guide

## Overview

This document connects the AI Agent Orchestrator to Kimi2.6 CLI (Claude Code), enabling AI-assisted development on your deployed instance.

## What This Enables

- **AI-assisted debugging**: Claude Code reads your live codebase and suggests fixes
- **Feature development**: Describe features in natural language, Claude implements them
- **Database migrations**: Claude generates and validates schema changes
- **Security audits**: Claude reviews your code for vulnerabilities
- **Documentation**: Auto-generate docs from your codebase

---

## Step 1: Install Kimi2.6 CLI (Claude Code)

```bash
# Install globally
npm install -g @anthropics/claude-code

# Verify installation
claude --version
```

---

## Step 2: Connect to Your Deployed Instance

### Option A: SSH into Server + Claude Code

```bash
# SSH to your cloud server
ssh root@your-server-ip

# Navigate to app directory
cd /opt/ai-orchestrator

# Launch Claude Code
claude
```

### Option B: Local Development with Remote Sync

```bash
# On your local machine
cd ~/projects/ai-orchestrator

# Pull from server (or use your Git repo)
git pull origin main

# Launch Claude Code with full context
claude
```

---

## Step 3: Key Files Claude Should Know

When starting a Claude Code session, provide this context:

```
I'm working on the AI Agent Orchestrator, a fullstack React + tRPC + Drizzle ORM + MySQL application.

Key architecture files:
- db/schema.ts — 13 tables including ai_agents, api_keys, conversations, agent_logs
- api/execution-router.ts — AI proxy to OpenAI/Anthropic/Google
- api/webhook-router.ts — Incoming webhooks for Telegram/Slack/Discord
- api/apikeys-router.ts — bcrypt + AES-256 encryption
- src/stores/flowStore.ts — React Flow canvas state with Zustand
- src/pages/Architecture.tsx — Visual agent hierarchy builder
- src/pages/AgentConsole.tsx — Chat testing interface

Stack: React 19, TypeScript, Vite, Tailwind CSS, tRPC 11, Hono, Drizzle ORM, MySQL
```

---

## Step 4: Essential Claude Code Prompts

### Database & Schema
```
Read db/schema.ts and add a new table for [feature]. 
Include proper indexes and foreign keys.
```

### API Development
```
Read api/execution-router.ts and add support for [new AI provider].
Follow the existing pattern with error handling and activity logging.
```

### Frontend Features
```
Read src/pages/AgentConsole.tsx and add:
- Conversation history search
- Token usage charts
- Export chat as JSON
```

### Security Audits
```
Review api/apikeys-router.ts and api/lib/crypto.ts.
Are there any security vulnerabilities? Suggest improvements.
```

### Bug Fixes
```
The Architecture canvas doesn't persist after refresh.
Read src/pages/Architecture.tsx and api/workflow-router.ts — 
what's missing in the save/load flow?
```

---

## Step 5: Claude Code Commands Reference

| Command | Purpose |
|---------|---------|
| `/help` | Show all commands |
| `/config` | View/edit configuration |
| `/cost` | Check API usage cost |
| `/clear` | Clear conversation history |
| `/compact` | Compress conversation context |
| `/exit` | Quit Claude Code |

---

## Step 6: Workflow Patterns

### Pattern 1: Feature Development
```
1. Describe feature to Claude
2. Claude reads relevant files
3. Claude proposes implementation
4. Review changes with Claude
5. Test on staging
6. Deploy to production
```

### Pattern 2: Debugging
```
1. Paste error message to Claude
2. Claude reads stack trace source files
3. Claude identifies root cause
4. Claude suggests fix
5. Apply fix and verify
```

### Pattern 3: Database Migration
```
1. Describe schema change to Claude
2. Claude writes migration SQL
3. Run migration on staging
4. Verify with test data
5. Run on production
```

---

## Step 7: Environment-Specific Tips

### Production Server (SSH)
```bash
# Before running Claude Code on production:
# 1. Create a backup
/opt/ai-orchestrator/backup.sh

# 2. Test in dry-run mode
claude --dry-run "review api/execution-router.ts for security issues"

# 3. Apply changes carefully
# Claude will show diff before applying
```

### Local Development
```bash
# Use git branches for Claude-assisted changes
git checkout -b claude/feature-name

# After Claude makes changes:
git diff  # Review all changes
git add .
git commit -m "Claude: implement [feature]"

# Test locally before pushing:
npm run check && npm run build
npm run dev  # Test in browser
```

---

## Step 8: Security Considerations

When using Claude Code on production:

1. **Never paste API keys** into Claude prompts
2. **Review all changes** before applying — Claude can make mistakes
3. **Test on staging first** — never let Claude directly modify production
4. **Backup before migrations** — always snapshot the database
5. **Use read-only mode** for audits: `claude --read-only "review security"`

---

## Step 9: Integration with CI/CD

### GitHub Actions + Claude Code
```yaml
# .github/workflows/claude-review.yml
name: Claude Code Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Claude Code Review
        run: |
          npm install -g @anthropics/claude-code
          claude --non-interactive \
            "Review this PR for bugs, security issues, and style violations"
```

---

## Quick Start Checklist

- [ ] Install Kimi2.6 CLI: `npm install -g @anthropics/claude-code`
- [ ] SSH into your server (or clone repo locally)
- [ ] Navigate to project directory
- [ ] Launch Claude Code: `claude`
- [ ] Provide initial context (see Step 3)
- [ ] Start with a simple task: "List all API routes in api/router.ts"
- [ ] Progress to complex features
- [ ] Always review changes before applying
- [ ] Test thoroughly before production deployment

---

## Version Reference

| Component | Version |
|-----------|---------|
| AI Agent Orchestrator | 1.0.0 |
| Kimi2.6 CLI (Claude Code) | Latest |
| Node.js | 20+ |
| React | 19 |
| tRPC | 11 |

For support: https://github.com/ai-agent-stack/orchestrator
