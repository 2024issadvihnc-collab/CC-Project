FROM node:20-alpine

WORKDIR /app

# Copy Booking Service dependencies
COPY services/booking-service/package*.json ./

RUN npm install --omit=dev

# Copy Booking Service source code
COPY services/booking-service/ ./

# Include shared project modules
COPY shared/ /shared/
COPY shared/ /app/shared/
RUN ln -sf /app/node_modules /shared/node_modules && ln -sf /app/node_modules /app/shared/node_modules

ENV NODE_ENV=production
ENV PORT=5003

EXPOSE 5003

CMD ["node", "server.js"]
