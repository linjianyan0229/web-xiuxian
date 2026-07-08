ARG DOCKER_MIRROR=docker.m.daocloud.io
FROM ${DOCKER_MIRROR}/library/node:22-alpine AS build

ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

RUN npm config set registry ${NPM_REGISTRY}

COPY package*.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY image ./image
COPY video ./video
COPY src ./src

RUN npm run build

ARG DOCKER_MIRROR=docker.m.daocloud.io
FROM ${DOCKER_MIRROR}/library/nginx:1.27-alpine

ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine

RUN sed -i "s#https://dl-cdn.alpinelinux.org/alpine#${ALPINE_MIRROR}#g" /etc/apk/repositories \
  && apk add --no-cache tzdata

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
