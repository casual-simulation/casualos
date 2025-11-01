FROM node:20.19.5

WORKDIR /usr/src/app

# Setup Global NPM package path
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH "/root/.deno/bin:/home/node/.npm-global/bin:${PATH}"

ENV NODE_ENV production
ENV PRODUCTION 1
ENV DENO_INSTALL "/root/.deno"
ENV PRISMA_QUERY_ENGINE_BINARY="/usr/src/app/aux-backend/prisma/generated/libquery_engine-debian-openssl-3.0.x.so.node"

# Install Deno Version v1.4.0
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s v1.4.0

RUN npm install -g prisma@^6.14.0
RUN npm install --no-package-lock --no-save deno-vm@^0.13.0 @libsql/linux-x64-gnu@^0.5.22

COPY ./src/aux-server/package*.json ./
COPY ./src/aux-server/aux-backend/server/dist ./aux-backend/server/dist/
COPY ./src/aux-server/aux-web/dist ./aux-web/dist/
COPY ./src/aux-server/aux-web/aux-auth/dist ./aux-web/aux-auth/dist/
COPY ./src/aux-server/aux-backend/schemas/auth.prisma ./aux-backend/schemas/auth.prisma
COPY ./src/aux-server/aux-backend/schemas/migrations ./aux-backend/schemas/migrations
COPY ./src/aux-server/aux-backend/prisma/generated/libquery_engine-debian-openssl-3.0.x.so.node ./aux-backend/prisma/generated/libquery_engine-debian-openssl-3.0.x.so.node

# HTTP
EXPOSE 3000
EXPOSE 3002

# WebSocket
EXPOSE 4567

CMD [ "npm", "run", "docker:start" ]