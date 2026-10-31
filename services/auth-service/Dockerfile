
FROM node:20-alpine

WORKDIR /app

# Copy Auth Service dependencies
COPY services/auth-service/package*.json ./

RUN npm install --omit=dev

# Copy Auth Service source code
COPY services/auth-service/ ./

# Include shared project modules
COPY shared/ /shared/

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

CMD ["node", "server.js"]
