ARG BUILD_FROM=node:20-slim
FROM ${BUILD_FROM}

# Set working directory
WORKDIR /app

# Install system dependencies needed for Puppeteer and Sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto \
    fonts-liberation \
    libx11-6 \
    libxkbcommon0 \
    libxrandr2 \
    libxdamage1 \
    libxcomposite1 \
    libxcursor1 \
    libxi6 \
    libxext6 \
    libxrender1 \
    dumb-init \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy application code
COPY src ./src

# Create data directory for screenshots
RUN mkdir -p /data

# Set environment
ENV NODE_ENV=production
ENV DATA_PATH=/data
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port (internal to addon, via HA Ingress)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# S6-overlay will handle process management with init: false
# No need for explicit ENTRYPOINT/CMD
