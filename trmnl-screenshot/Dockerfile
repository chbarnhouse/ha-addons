ARG BUILD_FROM=node:20-alpine
FROM ${BUILD_FROM}

# Set working directory
WORKDIR /app

# Install system dependencies needed for Puppeteer and Sharp
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    noto-sans \
    ttf-liberation \
    libx11 \
    libxkbcommon \
    libxrandr \
    libxdamage \
    libxcomposite \
    libxcursor \
    libxi \
    libxext \
    libxrender

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY src ./src

# Create data directory for screenshots
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port (internal to addon, via HA Ingress)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/index.js"]
