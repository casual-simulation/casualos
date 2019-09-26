FROM node:11

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm install --only=production

COPY ./dist ./dist/

ENV PRODUCTION 1

# HTTP
EXPOSE 3000

# WebSocket
EXPOSE 4567

CMD [ "npm", "start" ]
