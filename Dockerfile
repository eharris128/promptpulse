# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with fallback
RUN if [ -f package-lock.json ]; then \
      npm ci --only=production; \
    else \
      npm install --only=production; \
    fi

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S promptpulse -u 1001

# Change ownership of app directory
RUN chown -R promptpulse:nodejs /app
USER promptpulse

# Expose port (Railway will set PORT environment variable)
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(() => process.exit(0)).catch(() => process.exit(1))"

# Start the server
CMD ["node", "server.js"]