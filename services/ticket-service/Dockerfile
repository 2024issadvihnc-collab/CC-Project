
FROM node:20-alpine

WORKDIR /app

# Copy Ticket Service dependencies
COPY services/ticket-service/package*.json ./

RUN npm install --omit=dev

# Copy Ticket Service source code
COPY services/ticket-service/ ./

# Include shared project modules
COPY shared/ /shared/

ENV NODE_ENV=production
ENV PORT=5005

EXPOSE 5005

CMD ["node", "server.js"]
