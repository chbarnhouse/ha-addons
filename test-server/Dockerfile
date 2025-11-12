ARG BUILD_FROM=node:22-alpine3.20
FROM ${BUILD_FROM}

WORKDIR /app

# Copy application
COPY app/index.js ./index.js

RUN chmod +x ./index.js

CMD ["node", "index.js"]
