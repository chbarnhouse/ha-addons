# Use official Home Assistant base image
FROM ghcr.io/home-assistant/amd64-base:latest

# Install Node.js, npm, and Chromium dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy run script and app code
COPY run.sh /
RUN chmod +x /run.sh

COPY app/ ./

# Expose port
EXPOSE 5001

# Use run.sh as entrypoint
CMD ["/run.sh"]
