# Docker 部署教程

本文档用于部署当前版本的 Web 文字修仙项目。Compose 会启动三个服务：`mysql`、`backend`、`frontend`，其中前端由 Nginx 托管并反向代理 `/api` 到后端。

## 文件说明

- `docker-compose.yml`：编排 MySQL、Node 后端、Nginx 前端。
- `.env.docker.example`：Docker 部署环境变量模板。
- `node/Dockerfile`：后端生产镜像，包含 `node/src/data` 下的境界、丹药、敏感词数据。
- `web/Dockerfile`：前端构建镜像，已复制 `src/`、`public/`、`image/`、`video/`。
- `web/nginx.conf`：静态站点与 `/api/` 反向代理配置。

## 首次部署

1. 复制环境变量：

```bash
copy .env.docker.example .env
```

Linux/macOS 使用：

```bash
cp .env.docker.example .env
```

2. 编辑 `.env`，生产环境至少修改：

```env
MYSQL_ROOT_PASSWORD=强数据库密码
JWT_SECRET=32位以上随机字符串
ADMIN_PASSWORD=管理员强密码
FRONTEND_ORIGIN=http://你的域名或IP:8080
WEB_PORT=8080
TZ=Asia/Shanghai
```

默认 Docker 部署已切到国内源：

```env
DOCKER_MIRROR=docker.m.daocloud.io
NPM_REGISTRY=https://registry.npmmirror.com
ALPINE_MIRROR=https://mirrors.aliyun.com/alpine
```

其中 `DOCKER_MIRROR` 用于 `mysql/node/nginx` 基础镜像，`NPM_REGISTRY` 用于容器内 `npm ci`，`ALPINE_MIRROR` 用于 `apk add tzdata`。如部署环境已有私有镜像仓库，可在 `.env` 中覆盖这些值。

3. 如需启用注册邮箱验证码和重置密码，配置 SMTP：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=你的邮箱
SMTP_PASS=邮箱授权码
MAIL_FROM=文字修仙 <你的邮箱>
```

`SMTP_HOST` 为空时，生产环境发送验证码接口会返回 `503`。如果只是本地试跑，可在后台系统配置中关闭 `register_email_code_enabled` 以跳过注册验证码；重置密码仍需要 SMTP。

4. 构建并启动：

```bash
docker compose up -d --build
```

5. 访问服务：

- 前端：`http://localhost:8080`
- 健康检查：`http://localhost:8080/api/health`

## 常用命令

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart
docker compose down
```

删除数据库和上传文件卷：

```bash
docker compose down -v
```

谨慎使用，`-v` 会删除 `mysql_data` 和 `uploads_data`。

## 数据与资源

- `mysql_data`：MySQL 数据，包含用户、宗门、世界频道、验证码、系统配置等表。
- `uploads_data`：运行时上传文件，例如玩家头像。
- 敏感词库位于后端镜像内的 `node/src/data/sensitive-words.txt` 和 `sensitive-words-allow.txt`，修改后需要重新构建后端镜像。
- 前端构建依赖 `web/image/` 和 `web/video/`，Dockerfile 已复制这些目录；`web/image/logo.png` 是大尺寸源文件，已通过 `.dockerignore` 排除。

## 更新部署

代码更新后重新构建：

```bash
docker compose up -d --build
```

只更新单个服务：

```bash
docker compose up -d --build backend
docker compose up -d --build frontend
```

修改 `.env` 后通常只需重建/重启相关服务：

```bash
docker compose up -d --build backend
```

## 生产注意事项

- 后端以 `NODE_ENV=production` 启动，会强制校验 `JWT_SECRET`、`DB_PASSWORD`、`ADMIN_PASSWORD`，默认弱配置会拒绝启动。
- `FRONTEND_ORIGIN` 应填写浏览器实际访问前端的来源，例如 `https://game.example.com`。
- 当前 Compose 使用 MySQL `root` 连接，因为后端启动时会自动 `CREATE DATABASE IF NOT EXISTS`。
- 世界频道敏感词检测在服务启动时加载词库；词库较大，后端容器建议至少预留 256MB 内存。
- 注册页仍包含较大的 MP4 立绘资源，低带宽服务器建议后续接 CDN 或继续压缩视频。

## 故障排查

后端启动失败：

```bash
docker compose logs backend
```

重点检查 `JWT_SECRET`、`ADMIN_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`SMTP_*`。

前端可打开但接口失败：

```bash
docker compose logs frontend
docker compose logs backend
```

确认 `web/nginx.conf` 中 `/api/` 代理到 `http://backend:3000/api/`，并确认后端健康检查可访问。

验证码发不出：

```bash
docker compose logs backend
```

检查 SMTP 服务商、端口、授权码和 `SMTP_SECURE`。QQ/163/Gmail 通常使用授权码或应用专用密码，不是网页登录密码。
