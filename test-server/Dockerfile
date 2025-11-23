ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy application
COPY app/index.js ./index.js

# Set up S6 service for proper supervision
RUN mkdir -p /etc/s6-overlay/s6-rc.d/nodeapp/

COPY s6-scripts/run /etc/s6-overlay/s6-rc.d/nodeapp/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/nodeapp/run

# Create s6 dependencies file
RUN echo "" > /etc/s6-overlay/s6-rc.d/nodeapp/dependencies.d/base

# Let S6 overlay manage everything
ENTRYPOINT ["/init"]
