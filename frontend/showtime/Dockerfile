
# Multi-stage build for ShowTime React frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build production bundle (generates dist/)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Nginx production stage (supports dynamic envsubst via /etc/nginx/templates)
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy dynamic configuration template for envsubst
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Default backend API URL for single-host local development
# In Two-EC2 AWS deployment, override with -e BACKEND_API_URL=http://<BACKEND_PRIVATE_IP>:5000
ENV BACKEND_API_URL=http://api-gateway:5000

# Also copy static fallback conf in case templates directory is bypassed
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
