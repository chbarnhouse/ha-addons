FROM node:22-alpine3.20

WORKDIR /app

# Copy application and run script
COPY app/index.js ./index.js
COPY run.sh /run.sh

RUN chmod +x /run.sh && chmod +x ./index.js

# Health check for Home Assistant supervisor
# This tells supervisor when the addon is ready for ingress
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Run the shell script which will execute Node.js as PID 1
CMD ["/run.sh"]
