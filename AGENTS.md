# Repository Guidelines

## 项目结构与模块组织

本仓库是前后端分离的 Web 文字修仙游戏项目。

- `node/`：后端项目，技术栈为 Node.js + Express 5（ESM）。入口为 `src/server.js`，Express 应用定义在 `src/app.js`，API 路由统一挂载到 `src/routes/index.js`，对外前缀为 `/api`。
- `web/`：前端项目，技术栈为 Vue 3 + Vite。入口为 `src/main.js`，根组件为 `src/App.vue`，组件放在 `src/components/`，静态资源放在 `src/assets/` 或 `public/`。
- 根目录仅保留协作说明文件，如 `AGENTS.md`、`CLAUDE.md`。

前后端代码必须按目录隔离，不要在根目录安装依赖或混放业务代码。

## 构建、测试与开发命令

后端命令：

```bash
cd node
npm install
npm run dev    # 使用 node --watch 启动开发服务
npm start      # 普通启动
```

后端默认端口为 `3000`，可通过 `PORT` 环境变量覆盖。健康检查接口为 `GET /api/health`。

前端命令：

```bash
cd web
npm install
npm run dev      # 启动 Vite 开发服务，默认端口 5173
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

`web/vite.config.js` 已配置开发代理：前端请求 `/api/...` 会转发到 `http://localhost:3000`。

## 编码风格与命名规范

项目当前使用 JavaScript ESM。JS、Vue、JSON、CSS 文件统一使用 2 空格缩进。变量和函数使用 `camelCase`，Vue 组件和类使用 `PascalCase`，路由路径与资源文件名使用 kebab-case。

后端新增业务模块时，优先在 `node/src/routes/` 下创建子路由，并在 `node/src/routes/index.js` 中挂载，例如 `router.use('/player', playerRouter)`。核心游戏状态和判定逻辑（修炼进度、境界突破、战斗结算、背包等）应放在后端，前端只负责展示和交互。

## 测试规范

当前尚未配置测试框架，也没有 `npm test` 脚本。添加测试后，后端测试可放在 `node/tests/` 或与源码同目录使用 `*.test.js`；前端测试可放在 `web/src/**/__tests__/` 或使用 `*.spec.js`。

优先覆盖 API 契约、核心游戏规则和关键 UI 流程。引入测试后，应在对应 `package.json` 中补充 `npm test`。

## 提交与 Pull Request 规范

当前目录不是 Git 仓库，无法验证既有提交历史。建议使用简洁的 Conventional Commits，例如 `feat: add player route` 或 `fix: validate cultivation input`。

Pull Request 应包含变更摘要、测试结果、关联 issue（如有），以及 UI 变更的截图或录屏。新增环境变量、端口、迁移或安装步骤时必须明确说明。

## 安全与配置提示

不要提交密钥、本地数据库或 `.env` 文件。需要的环境变量应写入 `.env.example`。前端不要硬编码后端生产地址；开发环境统一通过 Vite `/api` 代理访问后端。

环境变量（详见 `node/.env.example`）：

- `NODE_ENV`：`development`/`production`。设为 `production` 时，`server.js` 启动前会调用 `assertProductionConfig()` 强制校验 `JWT_SECRET`（非开发默认且长度足够）、`DB_PASSWORD`、`ADMIN_PASSWORD`（非默认口令）；任一不满足则打印原因并退出。
- `FRONTEND_ORIGIN`：允许跨域的前端来源，逗号分隔多个。配置后仅放行这些来源；未配置时开发放开、生产从严。
- `JWT_SECRET` / `JWT_EXPIRES_IN`：JWT 密钥与有效期，生产必须使用强随机密钥。
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL`：默认管理员；生产未设置 `ADMIN_PASSWORD` 时不会自动播种默认管理员（避免弱口令）。

鉴权采用单会话 Token：登录把令牌写入 `users.access_token`，鉴权中间件会比对请求 token 与库中值，登出即清空令牌吊销旧 token。
