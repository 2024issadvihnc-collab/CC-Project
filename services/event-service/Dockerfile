FROM node:20-alpine

WORKDIR /app

# Copy Event Service dependencies
COPY services/event-service/package*.json ./

RUN npm install --omit=dev

# Copy Event Service source code
COPY services/event-service/ ./

# Include shared project modules
COPY shared/ /shared/
COPY shared/ /app/shared/
RUN ln -sf /app/node_modules /shared/node_modules && ln -sf /app/node_modules /app/shared/node_modules

ENV NODE_ENV=production
ENV PORT=5002

EXPOSE 5002

CMD ["node", "server.js"]
