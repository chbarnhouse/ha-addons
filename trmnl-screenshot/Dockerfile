# Use official Home Assistant base image with S6 overlay
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

# Let Home Assistant's S6 overlay manage the container initialization
# The supervisor will handle calling run.sh with init: true in config.yaml
CMD ["/run.sh"]
