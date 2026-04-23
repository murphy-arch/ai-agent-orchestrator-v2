# AI Agent Orchestrator - Production Dockerfile
# Optimized for Digital Ocean / Ubuntu deployment

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit

# Build the application
FROM deps AS build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init mysql-client

WORKDIR /app

# Copy built assets and dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY scripts/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
USER nextjs

# Expose app port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
ENV NODE_ENV=production
ENV PORT=3000
CMD ["dumb-init", "./start.sh"]
