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
- `users` 表字段：`id, dao_name(道号,唯一), email(唯一), password(bcrypt哈希), email_code(邮箱验证码), role(0玩家/1管理员), status(0禁用/1正常), realm_id(当前境界, 默认1=凡人), is_online(0离线/1在线), death_count(死亡次数), ling_shi(灵石), cultivation(修为), dao_yun(道韵), dao_law(道法领悟), comprehension(悟性%), register_time, login_time, last_sign_time, last_cultivate_time(修炼冷却), access_token`。
- **悟性 `comprehension`**：整数百分比，上限 100。规则集中在 `node/src/utils/comprehension.js`——注册与后台建号时 `rollComprehension()` 随机生成（99.5% 均匀取 1~10，0.5% 直接得 15）；后台编辑经 `clampComprehension()` 收敛到 0~100。前台 HUD 资源栏、后台用户列表/编辑弹窗均已展示。
- **修炼速度（暂定机制）**：仅作用于功法/心法，**修为获取不走此机制**（签到/打坐等不受影响）。公式：最终修炼速度% = 基础10% + 基础10%×悟性%（悟性满值 100 时封顶 20%）。计算函数 `cultivationSpeedPercent()` 在 `utils/comprehension.js`，功法/心法系统实装时在后端结算调用。设计文档：`资源文件/机制相关/悟性与修炼速度机制.md`。
- **修为修炼（已实装）**：每次修炼获得当前境界（含小境界）总经验 `advance_exp` 的 5%；修为丹生效时段内数值再乘 (1+加成%/100)，最后一步四舍五入、保底 1 点（丹药服用玩法未实装，加成暂按 0 计）。与悟性无关，签到奖励也不受丹药加成影响。计算函数 `cultivationGainPerSession()` 在 `utils/cultivationGain.js`，结算在 `controllers/cultivateController.js`（原子 UPDATE 防连点，同签到模式）；冷却秒数为系统配置 `cultivate_cooldown_seconds`（默认 60）。仙王及以上 `advance_exp=0`（靠道法晋级），修炼接口返回不可打坐的提示。设计文档：`资源文件/机制相关/修为修炼机制.md`。
- **修行日志表 `player_logs`**：`id, user_id, type(register/login/logout/sign_in/cultivate...), content(叙事文本), created_time`，索引 `(user_id, created_time)`。写入用 `playerLogModel.addLog()`——**旁路功能，内部 try/catch 只告警不抛错**，各控制器在操作成功后调用；管理员的登录/登出不写。删除玩家时手动级联清理其日志（无外键）。新增玩家操作时记得补一条 addLog。
- **修为圆满**：修炼接口在 `cultivation >= advance_exp` 时停止收益（409「修为已圆满」），状态接口带 `isFull`；前台按钮切换为「突破」打开突破弹窗。签到修为不截断，可能略超圆满值。
- **境界突破（已实装）**：条件按当前境界行的 `requirement_type` 判定——经验型需修为≥`advance_exp`（成功后扣除，溢出保留）、道韵型需道韵≥`dao_yun_required`（成功后扣除）、道法型需道法≥`dao_law_required`（**不消耗**）、终点（圣人）不可突破。含「雷劫」的类型先按 `tribulation_death_rate` 掷死亡：陨落则 `death_count+1`、对应资源折半、境界不跌。成功/陨落均原子 UPDATE（带境界+资源守卫防并发），写日志 type=`breakthrough`/`death`。逻辑在 `controllers/breakthroughController.js`；免死药/突破丹待丹药服用系统接入。设计文档：`资源文件/机制相关/境界突破机制.md`。
- **打坐（定时挂机修炼，已实装）**：玩家选定时长（一炷香30/半个时辰60/一个时辰120/两个时辰240 分钟，白名单）入定，**期间不可中断**——修炼/突破/再次打坐接口均拦截，无取消接口（除控制器前置校验外，`applyCultivate`/`applyBreakthroughSuccess`/`applyBreakthroughDeath` 的 `WHERE` 亦加打坐守卫 `meditation_end_time IS NULL OR <= NOW()`，SQL 层兜底并发下入定与修炼/突破同时成功）。期满按时长一次性结算修为：每小时得当前境界圆满修为(`advance_exp`)的 30%（系统配置 `meditation_gain_percent_per_hour`，收敛 [0,1000]），最后四舍五入、保底 1，结算封顶到圆满；`advance_exp=0` 的境界不可打坐。`users` 表 `meditation_start_time/meditation_end_time`（NULL=未打坐，到期结算后清空）；`applyMeditationStart/Settle` 原子读写并以 DB 时钟守卫防并发重复开场/结算。**惰性结算**：`meditationController.settleDueMeditation()` 被打坐/修炼/突破各接口在处理前调用，补结算离线到期的场次（无定时任务）。日志 type=`meditate_start`（入定）/`meditate`（出定）。计算函数 `cultivationGain` 类比的 `utils/meditation.js`，逻辑在 `controllers/meditationController.js`。设计文档：`资源文件/机制相关/打坐机制.md`。
- **丹药表 `pills` / `pill_grades`**：`pills` 一行一种丹药（id 为数据文件字符串主键，如 `pill_fanren_cultivation`，含 realm/realm_rank/category/effect_mode 等）；`pill_grades` 每丹药 凡(fan)/灵(ling)/道(dao) 三档，`effects` 为 JSON 列（元素字段 `target/targetName/type(percent|flat)/value/duration/hours/polarity`，mysql2 读出时已自动解析为对象）。种子数据 `node/src/data/pills.json`（由 `资源文件/丹药相关/pills.json` 复制，顶层含元信息，取 `.pills`），`seedPills()` 表空时导入（475 种 / 1425 件）。数据访问在 `models/pillModel.js`，后台编辑校验（效果白名单等）在 `controllers/pillController.js`。
- **在线态**：登录/注册时置 `is_online=1`，`POST /api/auth/logout`(需鉴权) 置 0；服务启动时 `UPDATE users SET is_online=0` 清零，避免残留。`death_count` 目前无游戏机制写入（突破/死亡系统未做），排行榜查询已就绪，待机制接入后自然填充。
- **境界表 `realms`**：`id`(境界序号, 1=凡人 … 83=圣人, 非自增, 直接用数据文件的 id 作主键) + 各项属性(hp/ling_qi/attack/defense/spirit)与晋级要求(requirement_type/advance_exp/dao_yun_required/dao_law_required/tribulation_type/tribulation_death_rate/next_realm/note)。种子数据在 `node/src/data/realms.json`（由 `资源文件/境界相关/cultivation_realm_table.json` 复制而来），`seedRealms()` 在表为空时批量导入(用 `pool.query` 的 `VALUES ?` 批插，execute 不支持)。
- `users.realm_id` 绑定境界，所有人初始化为 `1`(凡人)；`userModel` 的用户视图 `USER_SELECT` 用 `LEFT JOIN realms` 带出 `realm_name`。
- **默认管理员**：`initDatabase()` 中的 `seedDefaultAdmin()` 在 `users` 表无 `role=1` 记录时插入一条管理员（道号=`ADMIN_USERNAME`，邮箱=`ADMIN_EMAIL`，密码=`ADMIN_PASSWORD`，默认 `admin` / `admin@xiuxian.local` / `admin123456`）。幂等，已存在则跳过。管理员用道号或邮箱登录。
- **迁移**：`ensureColumn()` 幂等补列（MySQL 无 `ADD COLUMN IF NOT EXISTS`），启动时给老 `users` 表补 `role`、`realm_id` 列；并 `DROP TABLE IF EXISTS admins` 清理旧设计。新增字段照此模式在 `initDatabase()` 里加 `ensureColumn` 调用。
- 数据访问集中在 `node/src/models/userModel.js`（原生 SQL + `query()` 封装），不使用 ORM。后台的玩家统计/列表/改状态都限定 `role=0`——管理员不出现在用户管理里，也无法被误禁用（`updateUserStatus` 带 `AND role=0`，改不到会返回 404）。分页 `listUsers` 因 mysql2 对 LIMIT 占位符的限制，把已 clamp 的整数 `LIMIT/OFFSET` 直接内联，仅关键字用 `?` 占位。

## 鉴权

- 注册/登录成功后由 `utils/jwt.js` 签发 JWT，同时把 token 与登录时间写回 `users.access_token`/`login_time`。
- 受保护接口在路由上挂 `middleware/auth.js` 的 `authRequired`：校验 `Authorization: Bearer <token>` → 验签 → 查用户 → 挂 `req.user`（不含 password/email_code）。
- 密码用 `utils/password.js`（bcryptjs）哈希与校验，明文密码绝不入库或返回。

- **登录统一在一个入口**：玩家和管理员都走 `POST /api/auth/login`。认证成功后令牌 payload 带 `role`（`role=1` 签 `'admin'`，否则 `'user'`）。**认证与授权分离**：登录只认证身份，能否进后台由「受保护接口校验 role」决定，没有单独的后台登录接口。
- 普通接口挂 `middleware/auth.js` 的 `authRequired`（校验 `Authorization: Bearer <token>` → 验签 → 查用户 → 挂 `req.user`，不含 password/email_code）。
- 后台接口挂 `middleware/adminAuth.js` 的 `adminAuthRequired`：校验令牌 `role==='admin'`，并查 `users` 确认该行 `role=1`。玩家令牌访问后台接口返回 403。
- **Token 吊销（单会话）**：登录/注册把新签发的 token 写入 `users.access_token`；`authRequired`/`adminAuthRequired` 除验签外，还用 `findAccessTokenById()` 比对请求 token 与库中 `access_token` 是否一致，不一致（登出已清空、异地重新登录已覆盖）即返回 401「登录状态已失效」。登出 `POST /api/auth/logout` 改走 `clearLoginState()`（清空 `access_token` 并置离线），旧 token 立即失效。
- **生产安全配置**：`config/env.js` 新增 `NODE_ENV`（`isProduction`）；生产启动前 `server.js` 调 `assertProductionConfig()` 强制校验 `JWT_SECRET`（非开发默认且 ≥16 位）、`DB_PASSWORD`、`ADMIN_PASSWORD`（非默认口令），任一不满足即打印原因并退出。生产未配 `ADMIN_PASSWORD` 时 `seedDefaultAdmin()` 跳过播种（`allowSeedDefaultAdmin`），避免默认弱口令管理员。CORS 由 `FRONTEND_ORIGIN`（逗号分隔多来源）收敛：配置则仅放行这些来源（带 `credentials`）；未配置时开发放开、生产 `origin:false` 从严。新增环境变量见 `node/.env.example`。
- 密码用 `utils/password.js`（bcryptjs）哈希与校验，明文密码绝不入库或返回。

### API 一览
游戏用户：
- `POST /api/auth/register` — `{ daoName, email, password }` → `{ token, user }`（新用户恒为玩家）
- `POST /api/auth/login` — `{ account, password }`（account 可为道号或邮箱；管理员也用此接口登录）→ `{ token, user }`，`user.role` 决定前端跳向后台还是游戏
- `GET /api/user/profile` — 需用户鉴权 → `{ user }`
- `GET /api/user/rankings` — 需用户鉴权 → `{ realmTop, onlineTop, deathTop }`（各前十，供前台首页展示；与后台 `/admin/rankings` 同源，仅鉴权层不同）
- `GET /api/user/cultivate` — 需用户鉴权 → 修炼状态 `{ canCultivate, isFull, gain, cooldownSeconds, lastCultivateTime, nextCultivateTime, cultivation, advanceExp, realmName }`
- `POST /api/user/cultivate` — 需用户鉴权，执行修炼 → 状态 + `gained`；冷却未到或修为已圆满返回 409
- `GET /api/user/breakthrough` — 需用户鉴权 → 突破状态 `{ atPeak, canBreakthrough, realmName, nextRealm, reqKind/reqLabel/required/current/met, hasTribulation, tribulationType, deathRatePercent, successRatePercent }`
- `POST /api/user/breakthrough` — 需用户鉴权，执行突破 → 成功 `{ success:true, newRealm, ... }` / 身陨 `{ died:true, deathCount, lossLabel, ... }`；条件不足 409，圣人 400
- `GET /api/user/meditation` — 需用户鉴权 → 打坐状态 `{ meditating, remainSeconds, durationLabel, canMeditate, reason, options:[{minutes,label,gain}], gainPerHourPercent, cultivation, advanceExp, settled }`（到期场次先行惰性结算，其结果放 `settled`）
- `POST /api/user/meditation` — `{ minutes }` 需用户鉴权，开始打坐（期满自动结算，不可中断）→ 打坐状态；时长非白名单 400，已在打坐/修为圆满/此境不可打坐 409/400
- `GET /api/user/logs?limit` — 需用户鉴权 → `{ list }` 修行日志（最近 N 条，默认 20，上限 50）
- `POST /api/auth/logout` — 需用户鉴权，置离线 → `{ ok: true }`

后台管理（均需管理员鉴权，即 role=admin 的令牌）：
- `GET /api/admin/profile` → `{ admin }`
- `GET /api/admin/dashboard` → `{ totalUsers, activeUsers, disabledUsers, newUsersToday, totalAdmins, totalRealms }`
- `GET /api/admin/users?page&pageSize&keyword` → `{ list, total, page, pageSize }`（list 每项带 `realm_id`/`realm_name`）
- `PATCH /api/admin/users/:id/status` — `{ status: 0|1 }` → `{ user }`
- `GET /api/admin/realms` → `{ list, total }`（全部境界，按 id 升序）
- `GET /api/admin/rankings?limit` → `{ realmTop, onlineTop, deathTop }`（境界榜/在线榜按境界降序，死亡榜按 death_count 降序；均只含 role=0）
- `GET /api/admin/pills?page&pageSize&keyword&category&realm` → `{ list, total, page, pageSize }`（每项带三档 `grades`；meta 路由需先于 `:id` 声明）
- `GET /api/admin/pills/meta` → `{ categories, realms }`（筛选下拉用）
- `PUT /api/admin/pills/:id` — `{ name?, note? }` → `{ pill }`
- `PUT /api/admin/pills/:id/grades/:grade` — `{ itemName?, summary?, effects? }`（effects 全量替换并按白名单校验）→ `{ pill }`

## 前端结构

- **单一登录态**：整个前端只有一套 `token`/`user`（`stores/auth.js` + `api/http.js`，baseURL `/api`）。后台 API（`api/admin.js`）复用同一个 `http` 实例，不再有独立的 admin store/axios。`http` 响应拦截在 401 时清理登录态并跳 `/login`。
- 路由 `src/router/index.js`：`/login`、`/register`、`/home`（游戏），`/admin`（`AdminLayout` + 子路由 `dashboard`/`users`/`realms`）。**没有 `/admin/login`**——登录后 `LoginView` 按 `auth.user.role` 分流（管理员→`admin-dashboard`，玩家→`home`）。
- 全局守卫按单一 `token` + `user.role` 管控：`requiresAuth` 无 token 跳 `login`；`requiresAdmin` 无 token 跳 `login`、非管理员跳 `home`；`guestOnly` 已登录按角色跳对应首页。
- 后台页面在 `src/views/admin/`（`DashboardView` 含统计卡 + 三张排行榜、`UsersView`、`RealmsView`、`PillsView` 丹药管理、`ConfigView` 系统配置），布局 `src/layouts/AdminLayout.vue`（侧边栏 + 顶栏，用 `useAuthStore` 取管理员信息与登出）。用户管理列表与游戏首页均展示玩家当前境界(`realm_name`)。`PillsView` 支持境界/类型/关键字筛选与分页，编辑弹窗 `components/PillFormModal.vue` 可改丹药名/备注及各品质档的成品名/效果数值/持续小时/摘要（摘要为手填文本，改效果后需同步手改）。`ConfigView` 对 `value_type=number` 的配置提供输入框+保存（如修炼间隔秒数），bool 用开关。
- **游戏首页 `HomeView.vue`** 按参考图（`资源文件/参考图/`）做成水墨仙侠 HUD：顶部资源栏 + 左侧模块导航(修行等) + 角色卡 + 中间境界/修炼/常用功能 + 右侧「修仙榜(境界/在线/死亡三 tab, 各前十, 走 `/api/user/rankings` 真实数据)/今日修炼/修行日志」。自带一套固定水墨浅色配色（组件内 CSS 变量，不随系统深浅变化）。真实数据用道号/境界/时间；**修炼已接后端**：境界卡显示「修为 当前/圆满」真实进度条与单次收益预览，「开始修炼」调 `POST /api/user/cultivate`，冷却期间按钮变「调息中 Ns」倒计时（前端每秒 tick，以服务端 `nextCultivateTime` 为准）；**修为圆满后按钮自动切换为赤金色「突破」**（`cultFull` 计算属性），点击打开 `components/BreakthroughModal.vue`：展示下一境界、条件达成度、雷劫类型与死亡率，确认后调 `POST /api/user/breakthrough`，成功/身陨各有结果页；`done` 事件触发首页全量刷新（profile/修炼状态/日志/榜单）。**修行日志为真实数据**（`/api/user/logs`，修炼/签到成功后即时刷新）。**打坐（定时挂机修炼）已接后端**：「常用功能」的「打坐」按钮打开 `components/MeditationModal.vue`（择时辰 → 「是否打坐」二次确认强调不可中断 → 入定倒计时无取消 → 出定「功成」结算页）；入定期间境界卡的修炼/突破按钮替换为禁用「入定中 时:分:秒」，「打坐」快捷键也显示剩余倒计时，倒计时归零自动结算（以 `remainSeconds` 客户端锚定，弹窗开则由弹窗结算、闭则由首页兜底）并全量刷新（profile/修炼/日志/榜单）+toast。宗门、丹药服用等其余系统仍为占位展示（点击提示"敬请期待"）。退出按钮会调 `apiLogout` 置离线。
- 主题：`src/style.css` 用 CSS 变量定义配色，通过 `@media (prefers-color-scheme: dark)` 适配系统深/浅色；表单基元类（`.field/.btn/.form-error`）为全局样式，页面级样式用 SFC `scoped`。
- **全局通知（右上角 toast）**：`composables/toast.js`（模块级单例队列）+ `components/ToastHost.vue`（挂在 `App.vue`，fixed 右上角，info/success/error 三类，自动消失、点击关闭）。**页面级提醒一律走 toast**（首页修炼结果/占位提示、后台各页加载与操作报错、配置保存反馈），不再用页内横幅；表单内的字段校验错误仍留在表单旁（登录/注册/各编辑弹窗）。新页面报错请用 `useToast().error(...)`。

## 架构要点

- 前后端通过 HTTP API 通信。`web/vite.config.js` 已配置 proxy：开发时 `/api` 请求自动转发到 `http://localhost:3000`，前端代码直接请求相对路径 `/api/...` 即可，无跨域问题。
- 新增后端游戏模块时：在 `node/src/routes/` 下建子路由文件，并在 `node/src/routes/index.js` 中挂载（如 `router.use('/player', playerRouter)`）；对应控制器放 `controllers/`、数据访问放 `models/`。
- 游戏核心数值与状态判定（修炼进度、境界突破、战斗结算等）应由后端负责，前端只做展示与交互，防止客户端篡改。
