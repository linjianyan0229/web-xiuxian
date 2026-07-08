ARG DOCKER_MIRROR=docker.m.daocloud.io
FROM ${DOCKER_MIRROR}/library/node:22-alpine

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine

WORKDIR /app

ENV NODE_ENV=production

RUN sed -i "s#https://dl-cdn.alpinelinux.org/alpine#${ALPINE_MIRROR}#g" /etc/apk/repositories \
  && apk add --no-cache tzdata

RUN npm config set registry ${NPM_REGISTRY}

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p uploads

EXPOSE 3000

CMD ["npm", "start"]
