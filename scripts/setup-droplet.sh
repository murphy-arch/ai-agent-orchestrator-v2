#!/bin/bash
# AI Agent Orchestrator - Digital Ocean Droplet Setup Script
# Run this on a fresh Ubuntu 22.04/24.04 Droplet

set -e

APP_DIR="/opt/ai-orchestrator"
DOMAIN="${1:-}"

echo "=========================================="
echo "  AI Agent Orchestrator - Droplet Setup"
echo "=========================================="

# 1. System update
echo "[1/8] Updating system..."
apt update && apt upgrade -y

# 2. Install dependencies
echo "[2/8] Installing dependencies..."
apt install -y \
  build-essential \
  nginx \
  certbot \
  python3-certbot-nginx \
  git \
  curl \
  ufw \
  fail2ban \
  logrotate

# 3. Install Node.js 20
echo "[3/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

# 4. Firewall setup
echo "[4/8] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# 5. Create app directory
echo "[5/8] Creating app directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"

# 6. Setup Fail2Ban
echo "[6/8] Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
EOF
systemctl restart fail2ban

# 7. Setup logrotate
echo "[7/8] Configuring logrotate..."
cat > /etc/logrotate.d/ai-orchestrator << EOF
$APP_DIR/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        pm2 reload ai-orchestrator || true
    endscript
}
EOF

# 8. Nginx config (optional - if domain provided)
if [ -n "$DOMAIN" ]; then
  echo "[8/8] Setting up Nginx for $DOMAIN..."
  cat > /etc/nginx/sites-available/ai-orchestrator << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/ai-orchestrator /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl restart nginx

  # SSL
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || true
else
  echo "[8/8] Skipping Nginx setup (no domain provided)."
  echo "        Run again with: ./setup-droplet.sh your-domain.com"
fi

echo ""
echo "=========================================="
echo "  Droplet setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Upload your app to: $APP_DIR"
echo "  2. Create .env file:   nano $APP_DIR/.env"
echo "  3. Install deps:       cd $APP_DIR && npm install"
echo "  4. Build app:          npm run build"
echo "  5. Setup DB:           npm run db:push"
echo "  6. Start with PM2:     pm2 start ecosystem.config.cjs"
echo "  7. Save PM2 config:    pm2 save && pm2 startup systemd"
echo ""
