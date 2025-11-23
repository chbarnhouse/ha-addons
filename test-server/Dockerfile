FROM node:22-alpine3.20

WORKDIR /app

# Copy application and run script
COPY app/index.js ./index.js
COPY run.sh /run.sh

RUN chmod +x /run.sh && chmod +x ./index.js

# Run the shell script which will execute Node.js as PID 1
CMD ["/run.sh"]
