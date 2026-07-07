# Docker 部署教程

本文档用于将本项目部署为 Docker Compose 服务。部署后包含三个容器：MySQL、Node 后端、Nginx 前端。

## 文件说明

- `docker-compose.yml`：编排 MySQL、后端和前端。
- `.env.docker.example`：Docker 部署环境变量示例。
- `node/Dockerfile`：构建后端运行镜像。
- `web/Dockerfile`：构建前端静态资源并用 Nginx 托管。
- `web/nginx.conf`：前端容器配置，负责把 `/api` 反向代理到后端。

## 前置要求

安装 Docker Desktop 或 Docker Engine，并确保支持 Compose v2：

```bash
docker compose version
```

## 首次部署

1. 复制环境变量文件：

```bash
copy .env.docker.example .env
```

Linux/macOS 使用：

```bash
cp .env.docker.example .env
```

2. 编辑 `.env`，至少修改以下值：

```env
MYSQL_ROOT_PASSWORD=改成强密码
JWT_SECRET=改成32位以上随机字符串
ADMIN_PASSWORD=改成管理员强密码
FRONTEND_ORIGIN=http://localhost:8080
WEB_PORT=8080
```

3. 构建并启动：

```bash
docker compose up -d --build
```

4. 查看运行状态：

```bash
docker compose ps
```

5. 访问项目：

- 前端：http://localhost:8080
- 健康检查：http://localhost:8080/api/health

## 常用命令

查看日志：

```bash
docker compose logs -f
```

只看后端日志：

```bash
docker compose logs -f backend
```

重启服务：

```bash
docker compose restart
```

停止服务但保留数据：

```bash
docker compose down
```

停止并删除数据库、上传文件等卷数据：

```bash
docker compose down -v
```

## 数据持久化

Compose 使用两个命名卷：

- `mysql_data`：保存 MySQL 数据。
- `uploads_data`：保存玩家上传头像等运行时文件。

不要随意执行 `docker compose down -v`，否则会删除数据库和上传文件。

## 生产配置注意事项

后端容器以 `NODE_ENV=production` 启动，启动前会强制检查：

- `JWT_SECRET` 不能是开发默认值，且长度不能过短。
- `ADMIN_PASSWORD` 不能使用默认口令。
- `DB_PASSWORD` 必须存在。

当前后端启动逻辑会执行 `CREATE DATABASE IF NOT EXISTS`，因此 Docker Compose 中后端默认使用 MySQL `root` 用户连接数据库。若要改为普通数据库用户，需要先调整后端数据库初始化逻辑，或提前授予该用户创建数据库权限。

## 更新部署

拉取或修改代码后重新构建：

```bash
docker compose up -d --build
```

如果只改了前端或后端，也可以单独构建：

```bash
docker compose up -d --build frontend
docker compose up -d --build backend
```

## 故障排查

后端启动失败：

```bash
docker compose logs backend
```

重点检查 `.env` 中 `JWT_SECRET`、`ADMIN_PASSWORD`、`MYSQL_ROOT_PASSWORD` 是否已修改。

数据库未就绪：

```bash
docker compose logs mysql
```

前端能打开但接口失败：

```bash
docker compose logs frontend
docker compose logs backend
```

确认 `web/nginx.conf` 中 `/api/` 代理到 `http://backend:3000/api/`，并确认后端容器健康。

