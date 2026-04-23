# Digital Ocean Deployment Guide

## Quick Start (Docker Compose - Recommended)

### 1. Create a Droplet
- **OS:** Ubuntu 24.04 (LTS)
- **Plan:** Basic, 2 vCPU / 4GB RAM minimum
- **Region:** Closest to your users
- **Authentication:** SSH key recommended

### 2. Upload the App
```bash
# On your local machine, run:
rsync -avz --exclude='node_modules' --exclude='.git' ./ ai-orchestrator@YOUR_DROPLET_IP:/opt/ai-orchestrator/

# Or use scp:
scp -r ./ ai-orchestrator@YOUR_DROPLET_IP:/opt/ai-orchestrator/
```

### 3. Configure Environment
```bash
ssh root@YOUR_DROPLET_IP
cd /opt/ai-orchestrator

# Edit the environment file
nano .env
```

Fill in:
```env
DB_ROOT_PASSWORD=your-secure-root-password
DB_PASSWORD=your-secure-db-password
ENCRYPTION_KEY=your-64-char-hex-key
APP_SECRET=your-app-secret-min-32-chars
PUBLIC_URL=https://your-domain.com
```

Generate an encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Launch with Docker Compose
```bash
# Install Docker & Docker Compose if not already present
curl -fsSL https://get.docker.com | sh

# Start everything
docker compose up -d

# View logs
docker compose logs -f app

# Database will auto-initialize on first run via db/init/01-schema.sql
```

### 5. Setup SSL (optional - with Nginx on host)
If you prefer Nginx on the host instead of inside Docker:
```bash
# Run the setup script
chmod +x scripts/setup-droplet.sh
./scripts/setup-droplet.sh your-domain.com
```

---

## Manual Deployment (PM2 + MySQL)

### 1. Prepare the Droplet
```bash
ssh root@YOUR_DROPLET_IP
chmod +x scripts/setup-droplet.sh
./scripts/setup-droplet.sh your-domain.com
```

### 2. Install MySQL
```bash
apt install -y mysql-server
mysql_secure_installation

# Create database and user
mysql -u root -p
CREATE DATABASE agentstack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orchestrator'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON agentstack.* TO 'orchestrator'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Deploy the App
```bash
cd /opt/ai-orchestrator

# Create .env
nano .env
```

```env
DATABASE_URL=mysql://orchestrator:strong-password@localhost:3306/agentstack
ENCRYPTION_KEY=your-64-char-hex-key
APP_SECRET=your-app-secret
PUBLIC_URL=https://your-domain.com
PORT=3000
NODE_ENV=production
```

```bash
npm install
npm run build
npm run db:push

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | MySQL connection string |
| `ENCRYPTION_KEY` | ✅ | 64-char hex key for AES-256 encryption |
| `APP_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `PUBLIC_URL` | ✅ | Public URL for webhook generation |
| `PORT` | ❌ | Server port (default: 3000) |
| `NODE_ENV` | ❌ | production / development |
| `VITE_KIMI_AUTH_URL` | ❌ | Kimi OAuth URL (if using Kimi auth) |
| `VITE_APP_ID` | ❌ | Kimi OAuth app ID |
| `KIMI_AUTH_URL` | ❌ | Backend Kimi auth URL |
| `KIMI_OPEN_URL` | ❌ | Kimi Open Platform URL |
| `OWNER_UNION_ID` | ❌ | Admin user union ID |

---

## Useful Commands

```bash
# Docker Compose
docker compose up -d          # Start
docker compose down           # Stop
docker compose logs -f app    # View app logs
docker compose logs -f db     # View DB logs
docker compose pull && docker compose up -d --build  # Update

# PM2
pm2 status                   # View processes
pm2 logs ai-orchestrator    # View logs
pm2 restart ai-orchestrator # Restart
pm2 reload ai-orchestrator  # Zero-downtime reload
pm2 stop ai-orchestrator    # Stop

# MySQL
docker compose exec db mysql -u orchestrator -p agentstack
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated a strong `ENCRYPTION_KEY`
- [ ] Firewall enabled (UFW)
- [ ] Fail2Ban installed and running
- [ ] SSL certificate installed
- [ ] `.env` file has `chmod 600` permissions
- [ ] Database not exposed to public (bind-address = 127.0.0.1)
- [ ] Regular backups configured
