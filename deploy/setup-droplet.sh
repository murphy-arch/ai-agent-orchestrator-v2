#!/bin/bash
set -e

# =============================================================================
# AI Agent Orchestrator — Droplet Setup Script
# =============================================================================
# Run this on a fresh Ubuntu 22.04/24.04 Digital Ocean droplet:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-droplet.sh | bash
# =============================================================================

APP_DIR="/var/www/agent-stack"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48)}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -base64 32)}"

echo "==============================================="
echo "  AI Agent Orchestrator — Droplet Setup"
echo "==============================================="
echo ""

# ─── Update system ───
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── Install Node.js 20 ───
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs
node --version

# ─── Install MySQL ───
echo "[3/8] Installing MySQL..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server
systemctl enable mysql
systemctl start mysql

# Create database and user
mysql -e "CREATE DATABASE IF NOT EXISTS agentstack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'orchestrator'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
mysql -e "GRANT ALL PRIVILEGES ON agentstack.* TO 'orchestrator'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
echo "[3/8] MySQL database 'agentstack' created."

# ─── Install Nginx ───
echo "[4/8] Installing Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx

# ─── Install Certbot (for SSL) ───
if [ -n "$DOMAIN" ]; then
  echo "[4/8] Installing Certbot for SSL..."
  apt-get install -y -qq certbot python3-certbot-nginx
fi

# ─── Install PM2 (process manager) ───
echo "[5/8] Installing PM2..."
npm install -g pm2@latest

# ─── Create app directory ───
echo "[6/8] Creating app directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
chown -R www-data:www-data "$APP_DIR"

# ─── Create environment file ───
echo "[7/8] Creating environment file..."
cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
PUBLIC_URL=${DOMAIN:+https://$DOMAIN}
DATABASE_URL=mysql://orchestrator:${DB_PASSWORD}@localhost:3306/agentstack
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
APP_SECRET=${ENCRYPTION_KEY}
EOF

chmod 600 "$APP_DIR/.env"

# ─── Setup systemd service ───
echo "[8/8] Setting up systemd service..."
cat > /etc/systemd/system/agent-stack.service <<'EOF'
[Unit]
Description=AI Agent Orchestrator
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/agent-stack
ExecStart=/usr/bin/node dist/api.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/var/www/agent-stack/.env
StandardOutput=append:/var/www/agent-stack/logs/app.log
StandardError=append:/var/www/agent-stack/logs/app.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable agent-stack

# ─── Setup logrotate ───
cat > /etc/logrotate.d/agent-stack <<EOF
/var/www/agent-stack/logs/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 www-data www-data
  sharedscripts
  postrotate
    systemctl reload agent-stack || true
  endscript
}
EOF

# ─── Setup Nginx ───
echo "[8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/agent-stack <<EOF
server {
    listen 80;
    server_name ${DOMAIN:-_};

    client_max_body_size 50M;

    location / {
        root /var/www/agent-stack/dist/public;
        try_files \$uri \$uri/ /index.html;
    }

    location /trpc {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/agent-stack /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# ─── SSL (if domain provided) ───
if [ -n "$DOMAIN" ] && [ -n "$EMAIL" ]; then
  echo ""
  echo "[SSL] Obtaining certificate for $DOMAIN..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" || true
fi

# ─── Summary ───
echo ""
echo "==============================================="
echo "  SETUP COMPLETE"
echo "==============================================="
echo ""
echo "App directory:     $APP_DIR"
echo "Database:          agentstack"
echo "DB Password:       $DB_PASSWORD"
echo "JWT Secret:        (saved in $APP_DIR/.env)"
echo "Encryption Key:    (saved in $APP_DIR/.env)"
echo ""
if [ -z "$DOMAIN" ]; then
  echo "Access the app at: http://$(curl -s ifconfig.me)"
else
  echo "Access the app at: https://$DOMAIN"
fi
echo ""
echo "Next steps:"
echo "  1. Deploy your code to $APP_DIR"
echo "  2. Run: cd $APP_DIR && npm install && npm run build"
echo "  3. Run: sudo systemctl start agent-stack"
echo ""
echo "To check status:   sudo systemctl status agent-stack"
echo "To view logs:      sudo tail -f $APP_DIR/logs/app.log"
echo ""
