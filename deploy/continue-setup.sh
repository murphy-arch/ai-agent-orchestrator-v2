#!/bin/bash
set -e

# Continue setup after partial install

echo "[1/4] Installing Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx

echo "[2/4] Setting up app directory..."
mkdir -p /var/www/agent-stack
mkdir -p /var/www/agent-stack/logs
chown -R www-data:www-data /var/www/agent-stack

echo "[3/4] Setting up database..."
mysql -e "CREATE DATABASE IF NOT EXISTS agentstack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'orchestrator'@'localhost' IDENTIFIED BY 'orchestrator123';"
mysql -e "GRANT ALL PRIVILEGES ON agentstack.* TO 'orchestrator'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "[4/4] Setting up systemd service..."
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

echo "[4/4] Configuring Nginx..."
cat > /etc/nginx/sites-available/agent-stack <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        root /var/www/agent-stack/dist/public;
        try_files $uri $uri/ /index.html;
    }

    location /trpc {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/agent-stack /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo ""
echo "==============================================="
echo "  SETUP COMPLETE"
echo "==============================================="
echo ""
echo "App directory:     /var/www/agent-stack"
echo "Database:          agentstack"
echo "DB Password:       orchestrator123"
echo ""
echo "Next steps:"
echo "  1. Deploy your code to /var/www/agent-stack"
echo "  2. Create .env file"
echo "  3. Run: cd /var/www/agent-stack && npm install && npm run build"
echo "  4. Run: sudo systemctl start agent-stack"
echo ""
