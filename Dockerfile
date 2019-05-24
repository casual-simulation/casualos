FROM node:11

WORKDIR /usr/src/app

COPY ./src/aux-server/package*.json ./

RUN npm install --only=production

COPY ./src/aux-server/server/dist ./server/dist/
COPY ./src/aux-server/aux-web/dist ./aux-web/dist/

ENV PRODUCTION 1

# HTTP
EXPOSE 3000

# WebSocket
EXPOSE 4567

CMD [ "npm", "start" ]
