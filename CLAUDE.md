# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 **Web 文字修仙小游戏**（前后端分离）：

- `node/` — **后端**，技术栈：Node.js + Express 5（ESM）+ MySQL（mysql2）+ JWT + bcryptjs
- `web/` — **前端**，技术栈：Vue 3 + Vite + vue-router + pinia + axios

## 强制目录规范（必须遵守）

**所有开发必须严格按文件夹分类执行：**

- 后端代码（Express 路由、服务、数据模型、游戏逻辑运算等）**只能**写在 `node/` 目录内。
- 前端代码（Vue 组件、页面、状态管理、样式、静态资源等）**只能**写在 `web/` 目录内。
- 禁止在仓库根目录或对方目录中混放前后端代码。
- `node/` 和 `web/` 各自维护独立的 `package.json`，依赖分别在各自目录内安装（不要在根目录安装依赖）。

## 常用命令

前后端需分别在各自目录中启动：

```bash
# 后端（在 node/ 目录内），默认端口 3000（可用环境变量 PORT 覆盖）
cd node
npm install
npm run dev        # node --watch 热重载启动
npm start          # 普通启动

# 前端（在 web/ 目录内），Vite 默认端口 5173
cd web
npm install
npm run dev        # Vite 开发服务器
npm run build      # 生产构建
npm run preview    # 预览构建产物
```

后端无 nodemon，热重载依赖 Node 自带的 `--watch`。健康检查接口：`GET /api/health`。

> 注意：`npm start`/`npm run dev` 通过 npm 启动 node 子进程；直接杀 npm 进程可能残留占用 3000 端口的孤儿 node 进程。排查端口占用用 `netstat -ano | grep :3000`，必要时 `taskkill //PID <pid> //F`。

## 数据库

- MySQL，连接参数全部来自 `node/.env`（见 `.env.example`）：`DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`、`JWT_SECRET/JWT_EXPIRES_IN`。`.env` 已被 gitignore。
- **自动初始化**：`node/src/config/db.js` 的 `initDatabase()` 在服务启动时执行——先创建数据库（`CREATE DATABASE IF NOT EXISTS`），再建表，最后创建连接池。`server.js` 会先 `await initDatabase()` 再 `app.listen`，连库失败则退出。
- 建表 DDL 内联在 `db.js` 中。新增表时在此追加 `CREATE TABLE IF NOT EXISTS`，无独立迁移工具。
- **单表模型**：玩家和管理员同在 `users` 表，用 `role` 区分（0=玩家，1=管理员），没有独立的 admins 表。
- `users` 表字段：`id, dao_name(道号,唯一), email(唯一), password(bcrypt哈希), email_code(邮箱验证码), role(0玩家/1管理员), status(0禁用/1正常), register_time, login_time, access_token`。
- **默认管理员**：`initDatabase()` 中的 `seedDefaultAdmin()` 在 `users` 表无 `role=1` 记录时插入一条管理员（道号=`ADMIN_USERNAME`，邮箱=`ADMIN_EMAIL`，密码=`ADMIN_PASSWORD`，默认 `admin` / `admin@xiuxian.local` / `admin123456`）。幂等，已存在则跳过。管理员用道号或邮箱登录。
- **迁移**：`ensureColumn()` 幂等补列（MySQL 无 `ADD COLUMN IF NOT EXISTS`），启动时给老 `users` 表补 `role` 列；并 `DROP TABLE IF EXISTS admins` 清理旧设计。新增字段照此模式在 `initDatabase()` 里加 `ensureColumn` 调用。
- 数据访问集中在 `node/src/models/userModel.js`（原生 SQL + `query()` 封装），不使用 ORM。后台的玩家统计/列表/改状态都限定 `role=0`——管理员不出现在用户管理里，也无法被误禁用（`updateUserStatus` 带 `AND role=0`，改不到会返回 404）。分页 `listUsers` 因 mysql2 对 LIMIT 占位符的限制，把已 clamp 的整数 `LIMIT/OFFSET` 直接内联，仅关键字用 `?` 占位。

## 鉴权

- 注册/登录成功后由 `utils/jwt.js` 签发 JWT，同时把 token 与登录时间写回 `users.access_token`/`login_time`。
- 受保护接口在路由上挂 `middleware/auth.js` 的 `authRequired`：校验 `Authorization: Bearer <token>` → 验签 → 查用户 → 挂 `req.user`（不含 password/email_code）。
- 密码用 `utils/password.js`（bcryptjs）哈希与校验，明文密码绝不入库或返回。

- **登录统一在一个入口**：玩家和管理员都走 `POST /api/auth/login`。认证成功后令牌 payload 带 `role`（`role=1` 签 `'admin'`，否则 `'user'`）。**认证与授权分离**：登录只认证身份，能否进后台由「受保护接口校验 role」决定，没有单独的后台登录接口。
- 普通接口挂 `middleware/auth.js` 的 `authRequired`（校验 `Authorization: Bearer <token>` → 验签 → 查用户 → 挂 `req.user`，不含 password/email_code）。
- 后台接口挂 `middleware/adminAuth.js` 的 `adminAuthRequired`：校验令牌 `role==='admin'`，并查 `users` 确认该行 `role=1`。玩家令牌访问后台接口返回 403。
- 密码用 `utils/password.js`（bcryptjs）哈希与校验，明文密码绝不入库或返回。

### API 一览
游戏用户：
- `POST /api/auth/register` — `{ daoName, email, password }` → `{ token, user }`（新用户恒为玩家）
- `POST /api/auth/login` — `{ account, password }`（account 可为道号或邮箱；管理员也用此接口登录）→ `{ token, user }`，`user.role` 决定前端跳向后台还是游戏
- `GET /api/user/profile` — 需用户鉴权 → `{ user }`

后台管理（均需管理员鉴权，即 role=admin 的令牌）：
- `GET /api/admin/profile` → `{ admin }`
- `GET /api/admin/dashboard` → `{ totalUsers, activeUsers, disabledUsers, newUsersToday, totalAdmins }`
- `GET /api/admin/users?page&pageSize&keyword` → `{ list, total, page, pageSize }`
- `PATCH /api/admin/users/:id/status` — `{ status: 0|1 }` → `{ user }`

## 前端结构

- **单一登录态**：整个前端只有一套 `token`/`user`（`stores/auth.js` + `api/http.js`，baseURL `/api`）。后台 API（`api/admin.js`）复用同一个 `http` 实例，不再有独立的 admin store/axios。`http` 响应拦截在 401 时清理登录态并跳 `/login`。
- 路由 `src/router/index.js`：`/login`、`/register`、`/home`（游戏），`/admin`（`AdminLayout` + 子路由 `dashboard`/`users`）。**没有 `/admin/login`**——登录后 `LoginView` 按 `auth.user.role` 分流（管理员→`admin-dashboard`，玩家→`home`）。
- 全局守卫按单一 `token` + `user.role` 管控：`requiresAuth` 无 token 跳 `login`；`requiresAdmin` 无 token 跳 `login`、非管理员跳 `home`；`guestOnly` 已登录按角色跳对应首页。
- 后台页面在 `src/views/admin/`（`DashboardView`/`UsersView`），布局 `src/layouts/AdminLayout.vue`（侧边栏 + 顶栏，用 `useAuthStore` 取管理员信息与登出）。
- 主题：`src/style.css` 用 CSS 变量定义配色，通过 `@media (prefers-color-scheme: dark)` 适配系统深/浅色；表单基元类（`.field/.btn/.form-error`）为全局样式，页面级样式用 SFC `scoped`。

## 架构要点

- 前后端通过 HTTP API 通信。`web/vite.config.js` 已配置 proxy：开发时 `/api` 请求自动转发到 `http://localhost:3000`，前端代码直接请求相对路径 `/api/...` 即可，无跨域问题。
- 新增后端游戏模块时：在 `node/src/routes/` 下建子路由文件，并在 `node/src/routes/index.js` 中挂载（如 `router.use('/player', playerRouter)`）；对应控制器放 `controllers/`、数据访问放 `models/`。
- 游戏核心数值与状态判定（修炼进度、境界突破、战斗结算等）应由后端负责，前端只做展示与交互，防止客户端篡改。
