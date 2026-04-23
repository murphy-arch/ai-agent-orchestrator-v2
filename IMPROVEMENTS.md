# Improvements & Next Steps

## Priority 1 - Critical for Launch

1. **Database Setup Wizard**
   - Auto-detect local MySQL or offer SQLite fallback
   - Built-in database initialization on first launch
   - Currently requires manual `npm run db:push`

2. **Self-Contained Database**
   - Bundle SQLite for zero-config deployment
   - Remove MySQL dependency for simpler installs
   - MySQL becomes optional for multi-user deployments

3. **API Key Validation**
   - Test API keys on save (ping each provider)
   - Show green/red status indicators per key
   - Encrypt all keys with master password + AES-256

4. **Agent Testing Console**
   - Inline chat interface to test each agent
   - Show token usage, latency, cost per request
   - Debug panel with raw request/response

5. **Real-Time Agent Logs**
   - WebSocket connection for live agent activity
   - Filterable log viewer with timestamps
   - Error alerting with toast notifications

## Priority 2 - UX Polish

6. **Undo/Redo in Architecture Canvas**
   - Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
   - Action history panel

7. **Template Presets**
   - "Customer Support" template (pre-wired agents)
   - "Sales Pipeline" template
   - "Content Studio" template
   - Import/export templates as JSON

8. **Bulk Operations**
   - Multi-select agents for batch delete/disable
   - Clone agent with all settings
   - Import agents from JSON/CSV

9. **Dark/Light Theme Toggle**
   - Currently dark-only
   - System preference detection

10. **Keyboard Shortcuts**
    - `/` to open command palette
    - `Ctrl+N` new agent
    - `Ctrl+S` save architecture
    - `Delete` remove selected node

## Priority 3 - Advanced Features

11. **n8n / Make.com Integration**
    - Webhook node in architecture canvas
    - Auto-generate n8n workflow JSON
    - Bidirectional sync with automation platforms

12. **Agent Memory & Context**
    - Conversation history per agent
    - Shared context between delegated agents
    - Long-term memory with vector storage

13. **Conditional Routing**
    - IF/ELSE logic nodes in architecture
    - Time-based routing (business hours)
    - Sentiment-based delegation

14. **Usage Analytics Dashboard**
    - Token consumption by agent
    - Cost tracking per provider
    - Uptime/health monitoring

15. **Team Collaboration**
    - Multi-user support with roles
    - Activity audit log
    - Agent change approval workflow

## Priority 4 - Platform Hardening

16. **Auto-Updater**
    - electron-updater integration
    - Silent background updates
    - Update changelog display

17. **Backup/Restore**
    - Export full system state as JSON
    - Scheduled automatic backups
    - One-click restore

18. **Plugin System**
    - Third-party agent type plugins
    - Custom node types for architecture
    - Webhook action plugins

19. **Multi-Language Support**
    - i18n framework integration
    - Language selector in settings
    - Community translation support

20. **Performance**
    - Code splitting (chunk size warnings now)
    - Virtualize large agent lists
    - Debounce architecture auto-save

## Quick Wins (Can Implement Now)

- [ ] Add a Setup Checklist widget to Dashboard
- [ ] Show "connected" green dot when API keys are validated
- [ ] Add empty-state illustrations for each page
- [ ] Add a search bar to agent inventory
- [ ] Add tooltips to all architecture controls
- [ ] Collapsible sections in left panel
- [ ] Pinch-to-zoom on mobile canvas
- [ ] Haptic feedback on mobile actions
- [ ] Add keyboard shortcut help modal (`?` key)
- [ ] Copy-to-clipboard for webhook URLs

## Architecture Improvements

- [ ] Migrate from MySQL to SQLite for standalone builds
- [ ] Add tRPC error boundary with retry UI
- [ ] Implement optimistic updates for agent CRUD
- [ ] Add request deduplication for parallel queries
- [ ] Service worker for offline asset caching
- [ ] WebSocket layer for real-time collaboration
