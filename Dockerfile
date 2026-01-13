FROM node:24-alpine AS builder 

ENV NODE_ENV=production

WORKDIR /app/client

# Install client deps and build static assets
COPY client/package*.json ./
RUN npm install

COPY client/ ./
COPY .env.production .env.production
ENV NODE_ENV=production
RUN npm run build

FROM node:24-alpine

ENV NODE_ENV=production

COPY .env.production .env.production

# Install nginx
RUN apk add --no-cache nginx bash

# Configure working dir
WORKDIR /app

# Copy nginx configs from repo root
COPY nginx-main.conf /etc/nginx/nginx.conf
COPY nginx-default.conf /etc/nginx/conf.d/default.conf

# Copy built client static files into nginx html dir
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy server files and install production dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production
COPY server/ ./

EXPOSE 3011 3010

CMD node /app/server/bin/www & nginx -g 'daemon off;'