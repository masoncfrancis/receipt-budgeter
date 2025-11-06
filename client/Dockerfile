FROM node:24-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

ENV NODE_ENV=production

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
