# Use official Home Assistant base image
FROM ghcr.io/home-assistant/amd64-base:latest

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Create app directory
RUN mkdir -p /app

# Copy run script
COPY run.sh /
RUN chmod +x /run.sh

# Copy app code
COPY app/ /app/

# Use run.sh as entrypoint
CMD ["/run.sh"]
