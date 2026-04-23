# AI Agent Orchestrator

A white-label, fullstack AI Agent Stack Orchestration Platform for building, connecting, and deploying multi-agent AI systems.

## Features

- **6 Pre-built Agent Types**: Prospector, Content, Outreach, Qualifier, Voice, Social
- **Multi-Provider AI Support**: OpenAI, Anthropic, Google AI, ElevenLabs, GoHighLevel, Make.com
- **Visual Architecture Builder**: Drag-and-drop React Flow canvas with agent hierarchy
- **Orchestrator System**: Assign primary/secondary delegation with spawnable/constant modes
- **Input Sources**: Telegram, WhatsApp, Slack, Email, Webhook, SMS, Discord, API, WebSocket
- **Master Password Protection**: Secure API key storage with password gate
- **Credential Hub**: Centralized view of all API keys and connection status
- **Asset Management**: Store brand assets, voice files, soul files, documentation
- **Interactive 3D Dashboard**: Three.js carousel with real-time system stats
- **Responsive Design**: Mobile-friendly with touch-optimized architecture canvas

## Tech Stack

**Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Three.js + React Flow
**Backend**: tRPC 11 + Hono + Drizzle ORM + MySQL
**Desktop**: Electron + electron-builder (Windows .exe)

## Quick Start - Local Development

### Prerequisites
- Node.js 20+
- MySQL database (local or cloud)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# .env is pre-configured. Update DATABASE_URL if needed:
DATABASE_URL=mysql://user:pass@host:port/dbname
```

### 3. Push Database Schema
```bash
npm run db:push
```

### 4. Start Development Server
```bash
npm run dev
```

App runs at `http://localhost:3000`

## Build Windows .exe

### Option A: Double-Click Build (Recommended)
1. Ensure Node.js 20+ is installed
2. Double-click `scripts/build-windows.bat`
3. Find your .exe files in the `release/` folder

### Option B: Command Line
```bash
npm install
npm run build
npm run electron:pack
```

Output:
- `release/AI Agent Orchestrator Setup.exe` - Installer version
- `release/AI-Agent-Orchestrator-Portable.exe` - Portable version (no install)

## First-Time Setup

1. **Launch the app** (or open http://localhost:3000 in dev)
2. **Complete Onboarding**: 5-step wizard to configure your environment
3. **Set Master Password**: Protect your API keys
4. **Add API Keys**: OpenAI, Anthropic, Google AI, GHL, Make.com, ElevenLabs
5. **Create Agents**: Use the agent creation portal with model selection
6. **Configure Architecture**: Set orchestrator, hierarchy, spawn modes
7. **Add Input Sources**: Telegram, WhatsApp, Slack, etc.
8. **Upload Assets**: Brand assets, voice files, soul files, documentation

## Project Structure

```
├── api/                    # Backend - tRPC routers & Hono server
│   ├── auth-router.ts      # Kimi OAuth authentication
│   ├── agents-router.ts    # Agent CRUD + hierarchy
│   ├── apikeys-router.ts   # API key management
│   ├── workflow-router.ts  # Visual flow builder
│   └── input-sources-router.ts  # Input source CRUD
├── db/
│   └── schema.ts           # 11 database tables
├── contracts/              # Shared types (frontend/backend)
├── electron/               # Desktop app wrapper
│   ├── main.cjs            # Electron main process
│   └── preload.cjs         # Context bridge
├── src/
│   ├── pages/              # Route pages
│   │   ├── Dashboard.tsx   # 3D carousel + stats
│   │   ├── CreateAgent.tsx # 5-step agent wizard
│   │   ├── Architecture.tsx # React Flow canvas
│   │   ├── Credentials.tsx # Credential Hub
│   │   └── ...
│   ├── components/flow/    # React Flow custom nodes
│   ├── stores/             # Zustand flow store
│   └── providers/          # tRPC client
├── scripts/
│   └── build-windows.bat   # One-click Windows build
└── dist/                   # Production build output
    ├── public/             # Frontend assets
    └── boot.js             # Backend server bundle
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | OAuth user accounts |
| `master_password` | API key encryption password |
| `api_keys` | Stored API credentials |
| `ai_agents` | Agent definitions + hierarchy |
| `brand_assets` | Logo, images, media files |
| `documents` | Documentation, soul files, guides |
| `workflow_nodes` | Visual architecture nodes |
| `workflow_edges` | Node connections |
| `input_sources` | Telegram, WhatsApp, etc. |
| `agent_connections` | Agent-to-agent links |
| `system_config` | Global configuration |

## API Routes (tRPC)

| Router | Endpoints |
|--------|-----------|
| `agents` | list, create, update, delete, setOrchestrator, setHierarchy, toggleSpawnMode |
| `apiKeys` | list, store, delete, listWithValues, checkServices, setMasterPassword, verifyMasterPassword |
| `assets` | upload, list, delete, linkAssetToAgent |
| `workflow` | saveWorkflow, loadWorkflow |
| `inputSources` | list, create, update, delete |
| `system` | health, config, onboardingStatus |
| `auth` | me, logout (Kimi OAuth) |

## License

Unbranded white-label software. Add your own branding on launch.
