FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5005

ENV NODE_ENV=production
ENV PORT=5005

CMD ["node", "server.js"]

