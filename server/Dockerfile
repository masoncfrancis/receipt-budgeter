FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p actualcache

EXPOSE 3010

CMD ["npm", "start"]