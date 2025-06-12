# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install security updates and dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
FROM base AS deps
RUN npm ci --only=production --omit=dev
RUN cd server && npm ci --only=production --omit=dev
RUN cd client && npm ci --only=production --omit=dev

# Build client
FROM base AS client-builder
COPY client/ ./client/
RUN cd client && npm ci && npm run build

# Build server
FROM base AS server-builder
COPY server/ ./server/
RUN cd server && npm ci

# Production image
FROM base AS production

# Copy built applications
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=client-builder /app/client/dist ./client/dist
COPY --from=server-builder /app/server ./server

# Copy configuration files
COPY .env.example ./.env.example
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Set ownership and permissions
RUN chown -R nodejs:nodejs /app && \
    chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Expose ports
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["./docker-entrypoint.sh"]