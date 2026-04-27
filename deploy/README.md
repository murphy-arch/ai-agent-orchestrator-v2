# Deployment Guide

## Quick Start (Digital Ocean)

### 1. Create a Droplet

- **OS:** Ubuntu 24.04 (LTS)
- **Plan:** Basic, 2GB RAM / 1 vCPU / 50GB SSD ($12/month)
- **Datacenter:** Closest to your users
- **Authentication:** SSH key (recommended)

### 2. Run Setup on the Droplet

SSH into your droplet and run:

```bash
# Option A: With a domain (auto SSL)
export DOMAIN=yourdomain.com
export EMAIL=you@example.com
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-droplet.sh | bash

# Option B: No domain (IP only, no SSL)
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-droplet.sh | bash
```

This installs:
- Node.js 20
- MySQL 8
- Nginx
- PM2
- Creates the database
- Sets up systemd service
- Configures Nginx reverse proxy
- Obtains SSL certificate (if domain provided)

### 3. Deploy Your Code

From your local machine:

```bash
# macOS / Linux / WSL
./deploy/deploy.sh root@YOUR_DROPLET_IP

# Windows (PowerShell) — use Git Bash or WSL
# Or manually:
```

**Manual Windows deploy:**
```powershell
# 1. Build locally
npm run build

# 2. Copy files (use WinSCP, FileZilla, or scp in Git Bash)
# 3. SSH into droplet and run:
cd /var/www/agent-stack
npm install --production
npx drizzle-kit migrate
sudo systemctl restart agent-stack
```

### 4. Verify

```bash
# Check service is running
ssh root@YOUR_DROPLET_IP "sudo systemctl status agent-stack"

# View logs
ssh root@YOUR_DROPLET_IP "sudo tail -f /var/www/agent-stack/logs/app.log"

# Health check
curl http://YOUR_DROPLET_IP/health
```

---

## Environment Variables

Copy `deploy/.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Random 32+ char string for auth tokens |
| `ENCRYPTION_KEY` | Yes | Random 32+ char string for API key encryption |
| `PUBLIC_URL` | No | Your domain (for Telegram webhooks) |
| `PORT` | No | Defaults to 3000 |

---

## Managing the Service

```bash
# Start
sudo systemctl start agent-stack

# Stop
sudo systemctl stop agent-stack

# Restart (after code changes)
sudo systemctl restart agent-stack

# View logs
sudo journalctl -u agent-stack -f

# Or tail the app log
sudo tail -f /var/www/agent-stack/logs/app.log
```

---

## Updating the App

```bash
# From your local machine (macOS/Linux/WSL)
./deploy/deploy.sh root@YOUR_DROPLET_IP
```

This builds locally, rsyncs to the droplet, installs deps, runs migrations, and restarts.

---

## Troubleshooting

### Port already in use
The systemd service auto-restarts on crash. If port 3000 is stuck:
```bash
sudo systemctl stop agent-stack
sudo fuser -k 3000/tcp
sudo systemctl start agent-stack
```

### Database connection failed
```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u orchestrator -p -e "USE agentstack; SHOW TABLES;"
```

### Nginx 502 Bad Gateway
```bash
# Check API is listening
sudo netstat -tlnp | grep 3000

# Check Nginx config
sudo nginx -t
sudo systemctl restart nginx
```
