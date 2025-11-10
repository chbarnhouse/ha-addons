# Use official Home Assistant base image
FROM ghcr.io/home-assistant/amd64-base:latest

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Copy rootfs structure
COPY rootfs /
