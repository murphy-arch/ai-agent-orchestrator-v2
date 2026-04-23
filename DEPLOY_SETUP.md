# CI/CD Deploy Setup

## GitHub Secrets Required

Add these secrets in your GitHub repo: **Settings → Secrets and variables → Actions**

| Secret | How to Get It |
|--------|---------------|
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale admin console → OAuth clients → Create (read scope for `devices`) |
| `TAILSCALE_OAUTH_SECRET` | Generated alongside the OAuth client ID |
| `DEPLOY_SSH_KEY` | Private key for `root@olympus-ollama-cd.tail218dac.ts.net`. Generate with `ssh-keygen -t ed25519 -C "deploy"` and add public key to `/root/.ssh/authorized_keys` on the droplet. |

## Tailscale OAuth Client Setup

1. Go to https://login.tailscale.com/admin/settings/oauth
2. Create new OAuth client
3. Scopes needed: `devices:read` (to discover the node)
4. Tag: `tag:ci`
5. Copy Client ID and Secret to GitHub secrets

## SSH Key Setup on Droplet

```bash
# On the droplet
mkdir -p /root/.ssh
chmod 700 /root/.ssh
cat >> /root/.ssh/authorized_keys << 'EOF'
<paste your deploy public key here>
EOF
chmod 600 /root/.ssh/authorized_keys
```

## How It Works

1. **Build workflow** runs on every PR:
   - Type checks
   - Lints
   - Builds client + server
   - Runs tests

2. **Deploy workflow** runs on every push to `main`:
   - Builds the app
   - Joins Tailscale network
   - Creates tarball
   - SCPs to droplet
   - Runs remote deploy (backup .env, extract, restore .env, docker compose up)
   - Health check

## Manual Deploy

If CI is down, deploy manually:

```bash
# From project root
bash scripts/deploy.sh
```

Or directly on the droplet:

```bash
cd /opt/ai-orchestrator
sudo docker compose up -d --build app
```
