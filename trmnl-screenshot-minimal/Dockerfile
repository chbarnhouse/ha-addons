ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Copy rootfs structure
COPY rootfs /
