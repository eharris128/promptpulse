# Multi-stage build for Next.js client and Express server

# Stage 1: Build the Next.js client
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./
RUN ls

# Install client dependencies
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# Copy client source code
COPY client/ ./

# Build the Next.js app
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy server package files
COPY package*.json ./
RUN ls
# Install production dependencies only
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy server source code
COPY . .

# Copy built client files from the builder stage
COPY --from=client-builder /app/client/out ./client/out
COPY --from=client-builder /app/client/public ./client/public

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S promptpulse -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R promptpulse:nodejs /app

# Switch to non-root user
USER promptpulse

# Expose port (Railway will set PORT environment variable)
EXPOSE ${PORT:-3000}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(() => process.exit(0)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server.js"]