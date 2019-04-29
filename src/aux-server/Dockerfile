FROM node:11

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

COPY ./server/dist ./server/dist
COPY ./aux-web/dist ./aux-web/dist

ENV PRODUCTION 1

# HTTP
EXPOSE 3000

# WebSocket
EXPOSE 4567

CMD [ "npm", "start" ]
