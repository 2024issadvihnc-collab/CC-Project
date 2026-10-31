
FROM node:20-alpine

WORKDIR /app

# Copy Payment Service dependencies
COPY services/payment-service/package*.json ./

RUN npm install --omit=dev

# Copy Payment Service source code
COPY services/payment-service/ ./

# Include shared project modules
COPY shared/ /shared/

ENV NODE_ENV=production
ENV PORT=5004

EXPOSE 5004

CMD ["node", "server.js"]
