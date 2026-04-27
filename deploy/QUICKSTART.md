# Quick Deploy (5 minutes)

## 1. Buy a Droplet

- **Provider:** Digital Ocean
- **OS:** Ubuntu 24.04
- **Size:** 2GB RAM / 1 vCPU / 50GB SSD ($12/month)
- **Region:** Closest to you

## 2. SSH into your droplet

```bash
ssh root@YOUR_DROPLET_IP
```

## 3. Run the setup script

```bash
export DOMAIN=yourdomain.com      # optional — skip for IP-only
export EMAIL=you@gmail.com        # optional — for SSL cert
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-droplet.sh | bash
```

This takes ~3 minutes. When it finishes, copy the **DB password** it prints.

## 4. Deploy your code

**From your local machine:**

```bash
# macOS / Linux / WSL:
./deploy/deploy.sh root@YOUR_DROPLET_IP

# Windows PowerShell:
.\deploy\deploy.ps1 -Droplet root@YOUR_DROPLET_IP
```

## 5. Open the app

```
http://YOUR_DROPLET_IP
```

Or if you set up a domain:
```
https://yourdomain.com
```

Register your first account — it becomes the admin automatically.

---

## Common Commands

```bash
# View logs
ssh root@YOUR_DROPLET_IP "sudo tail -f /var/www/agent-stack/logs/app.log"

# Restart app
ssh root@YOUR_DROPLET_IP "sudo systemctl restart agent-stack"

# Check status
ssh root@YOUR_DROPLET_IP "sudo systemctl status agent-stack"
```
