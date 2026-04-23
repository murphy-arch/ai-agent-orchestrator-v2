# Self-Hosting Guide + Security Protocols

## Deployed Version
**Live URL:** https://f7ea5b1-agent-orchestrator.httpsvc.vps.kimi.com/
**Version ID:** f7ea5b1

---

## Prerequisites

- **Server**: Ubuntu 22.04 LTS (4GB RAM, 2 vCPU minimum)
- **Database**: MySQL 8.0+ (or PlanetScale, AWS RDS)
- **Node.js**: v20+ (install via nvm)
- **Process Manager**: PM2 (`npm install -g pm2`)
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

---

## 1. Server Setup (Ubuntu 22.04)

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install essentials
apt install -y build-essential nginx certbot python3-certbot-nginx git curl

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /opt/ai-orchestrator
cd /opt/ai-orchestrator

# Clone/download your project
git clone https://github.com/your-repo/ai-agent-orchestrator.git .
# OR upload the ZIP and extract:
# unzip AI-Agent-Orchestrator.zip && mv app/* .

# Install dependencies
npm install
npm run build

# Run database migrations
cd /opt/ai-orchestrator
npx tsx db/migrate-add-lifecycle.ts
```

---

## 2. Environment Configuration

Create `/opt/ai-orchestrator/.env`:

```env
# Database (required)
DATABASE_URL=mysql://user:password@localhost:3306/agentstack

# Encryption (required for API key security)
ENCRYPTION_KEY=your-256-bit-secret-key-change-this-immediately
APP_SECRET=another-long-random-string-for-jwt-signing

# OAuth (for Kimi login - optional if using local auth only)
VITE_KIMI_AUTH_URL=https://your-auth-provider.com/oauth/authorize
VITE_REDIRECT_URI=https://your-domain.com/api/oauth/callback
APP_CLIENT_ID=your-client-id
APP_CLIENT_SECRET=your-client-secret

# Public URL (used for webhook callbacks)
PUBLIC_URL=https://your-domain.com

# Server
PORT=3000
NODE_ENV=production
```

### Generate a secure ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Nginx Configuration

Create `/etc/nginx/sites-available/ai-orchestrator`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates (Certbot will configure these)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com;" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support (for future real-time features)
    location /api/ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # Static files (frontend)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/ai-orchestrator /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 4. PM2 Process Manager

Create `/opt/ai-orchestrator/ecosystem.config.cjs`:

```javascript
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
    // Health check
    health_check_grace_period: 30000,
  }],
};
```

```bash
# Create log directory
mkdir -p /opt/ai-orchestrator/logs

# Start with PM2
cd /opt/ai-orchestrator
pm2 start ecosystem.config.cjs --env production

# Save PM2 config to restart on boot
pm2 save
pm2 startup systemd
```

### PM2 Commands
```bash
pm2 status                 # View running processes
pm2 logs ai-orchestrator   # View logs
pm2 restart ai-orchestrator # Restart
pm2 reload ai-orchestrator # Zero-downtime reload
pm2 stop ai-orchestrator   # Stop
```

---

## 5. Security Protocols

### A. Firewall (UFW)
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

### B. Database Security
```bash
# MySQL hardening
mysql_secure_installation

# Create dedicated user (do NOT use root)
mysql -u root -p
CREATE DATABASE agentstack;
CREATE USER 'orchestrator'@'localhost' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON agentstack.* TO 'orchestrator'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### C. File Permissions
```bash
# Set ownership
chown -R www-data:www-data /opt/ai-orchestrator
chmod -R 755 /opt/ai-orchestrator

# Protect sensitive files
chmod 600 /opt/ai-orchestrator/.env
chmod -R 700 /opt/ai-orchestrator/logs
```

### D. API Key Encryption (Already Implemented)
The app uses:
- **bcrypt** (12 rounds) for master password hashing
- **AES-256-CBC** for API key encryption with random IV per key
- Keys are decrypted only in-memory during the request lifecycle
- Never logged, never cached

### E. Rate Limiting (Add to Nginx)
```nginx
# Add to the server block
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=webhook:10m rate=100r/m;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... existing proxy config
}

location /api/webhook/ {
    limit_req zone=webhook burst=50 nodelay;
    # ... existing proxy config
}
```

### F. Fail2Ban (Brute-force protection)
```bash
apt install -y fail2ban

# Create /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
```

---

## 6. Backup Strategy

```bash
# Create backup script
cat > /opt/ai-orchestrator/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
DB_NAME="agentstack"
DB_USER="orchestrator"

mkdir -p $BACKUP_DIR

# Database backup
mysqldump -u$DB_USER -p'STRONG-PASSWORD' $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# App backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /opt ai-orchestrator --exclude=node_modules --exclude=logs

# Keep only last 14 days
find $BACKUP_DIR -name "*.sql" -mtime +14 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +14 -delete

# Optional: sync to S3
# aws s3 sync $BACKUP_DIR s3://your-bucket/backups/
EOF

chmod +x /opt/ai-orchestrator/backup.sh

# Daily cron
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/ai-orchestrator/backup.sh") | crontab -
```

---

## 7. Monitoring

```bash
# Install node exporter for Prometheus (optional)
# Or use PM2 monitoring:
pm2 monit

# Log rotation
apt install -y logrotate

cat > /etc/logrotate.d/ai-orchestrator << 'EOF'
/opt/ai-orchestrator/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        pm2 reload ai-orchestrator
    endscript
}
EOF
```

---

## 8. Update Procedure

```bash
cd /opt/ai-orchestrator

# Pull latest code
git pull origin main
# OR upload new ZIP and extract

# Install new dependencies
npm install

# Build
npm run build

# Run any new migrations
npx tsx db/migrate-add-lifecycle.ts

# Reload with zero downtime
pm2 reload ai-orchestrator

# Verify
pm2 status
pm2 logs ai-orchestrator --lines 20
```

---

## 9. Claude Code Integration

To point Claude Code at this project:

1. **Install Claude Code** (if not already):
   ```bash
   npm install -g @anthropics/claude-code
   ```

2. **Open the project**:
   ```bash
   cd /opt/ai-orchestrator
   claude
   ```

3. **Key files to reference** in Claude Code prompts:
   - `db/schema.ts` — Database structure
   - `api/router.ts` — API routes
   - `api/execution-router.ts` — AI proxy layer
   - `api/webhook-router.ts` — Webhook handlers
   - `src/stores/flowStore.ts` — Frontend state

4. **Example Claude Code prompts**:
   ```
   Read api/execution-router.ts and add support for Azure OpenAI as a provider
   ```
   ```
   Add a new table to db/schema.ts for tracking token usage per agent
   ```
   ```
   Read the webhook router and add proper Telegram bot webhook verification
   ```

---

## File Checklist

| File | Purpose |
|------|---------|
| `api/lib/crypto.ts` | Encryption utilities |
| `api/execution-router.ts` | AI proxy (OpenAI/Anthropic/Google) |
| `api/webhook-router.ts` | Incoming webhook handlers |
| `api/apikeys-router.ts` | Secure API key storage |
| `src/components/ToastProvider.tsx` | Toast notifications |
| `src/components/ErrorBoundary.tsx` | Error handling |
| `db/migrate-add-lifecycle.ts` | Database migration |
| `HOSTING.md` | This guide |
