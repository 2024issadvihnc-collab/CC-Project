FROM node:20-alpine

WORKDIR /app

# Copy API Gateway dependencies
COPY api-gateway/package*.json ./

RUN npm install --omit=dev

# Copy API Gateway source code
COPY api-gateway/ ./

# Include shared project modules
COPY shared/ /shared/
COPY shared/ /app/shared/
RUN ln -sf /app/node_modules /shared/node_modules && ln -sf /app/node_modules /app/shared/node_modules

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "server.js"]
