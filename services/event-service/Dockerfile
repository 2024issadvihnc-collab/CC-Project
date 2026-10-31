FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5002

ENV NODE_ENV=production
ENV PORT=5002

CMD ["node", "server.js"]

