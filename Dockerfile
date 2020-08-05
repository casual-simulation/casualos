FROM node:12

WORKDIR /usr/src/app

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh

COPY ./src/aux-server/package*.json ./

RUN npm install --only=production

COPY ./src/aux-server/server/dist ./server/dist/
COPY ./src/aux-server/aux-web/dist ./aux-web/dist/

ENV PRODUCTION 1
ENV PATH "/root/.deno/bin:${PATH}"
ENV DENO_INSTALL "/root/.deno"

# HTTP
EXPOSE 3000

# WebSocket
EXPOSE 4567

CMD [ "npm", "start" ]
