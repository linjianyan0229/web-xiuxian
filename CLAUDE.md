# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 **Web 文字修仙小游戏**（前后端分离）：

- `node/` — **后端**，技术栈：Node.js + Express 5（ESM）+ MySQL（mysql2）+ JWT + bcryptjs
- `web/` — **前端**，技术栈：Vue 3 + Vite + vue-router + pinia + axios

面向人的完整技术文档在 `docs/技术文档.md`（架构/库表/API/机制/部署），改动表结构、接口或机制后请同步更新它与本文件。**`docs/` 已纳入版本库（随 GitHub 同步）。**

**`docs/` 目录结构（本地文档统一归置）：**
- `docs/技术文档.md` — 面向人的完整技术文档。
- `docs/设计文档/` — **各系统机制设计稿/初稿**（修为修炼、境界突破、打坐、悟性、宗门、探索、功法等）。设计新机制先在此写文档，文档内互相引用用同目录相对路径 `./xxx.md`。
- `docs/记录/` — **改动/设计记录**（每次改动的总结 md，见下节）。

## 强制目录规范（必须遵守）

**所有开发必须严格按文件夹分类执行：**

- 后端代码（Express 路由、服务、数据模型、游戏逻辑运算等）**只能**写在 `node/` 目录内。
- 前端代码（Vue 组件、页面、状态管理、样式、静态资源等）**只能**写在 `web/` 目录内。
- 禁止在仓库根目录或对方目录中混放前后端代码。
- `node/` 和 `web/` 各自维护独立的 `package.json`，依赖分别在各自目录内安装（不要在根目录安装依赖）。

## 改动总结文档（每次改动必写）

**每完成一项改动（功能/修复/重构），在 `docs/记录/` 下写一份总结 md**，文件名 `YYYY-MM-DD-<主题>.md`（同日同主题多次迭代加 `-2`、`-3` 后缀）。内容按以下结构，讲清楚"改了什么、为什么、怎么验证的"即可，不必长篇：

```markdown
# <主题>

- 日期：YYYY-MM-DD HH:MM（精确到分钟，24 时制；用东八区本地时间——注意本机系统时钟为 UTC，需 +8 小时。写记录前先执行 `date -u` 取实时时间换算，不要凭感觉估）
- 需求：一两句话说明背景/用户诉求

## 改动内容
- 后端：…（表结构/接口/机制，无则写"无"）
- 前端：…（页面/组件/交互，无则写"无"）

## 涉及文件
- 新增：`path/to/file`（一句话用途）
- 修改：`path/to/file`（一句话改了什么）

## 验证
- 怎么测的、结果如何（接口实测/构建通过/页面自查等）

## 遗留
- 未尽事项或后续建议（无则写"无"）
```

写总结是收尾动作的一部分：总结 → 同步 CLAUDE.md 与 `docs/技术文档.md`（若涉及表结构/接口/机制）→ 才算完成。总结文档是流水账式的历史记录，**只增不改**（修正错误除外）；沉淀性的知识仍以 CLAUDE.md 和技术文档为准。

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
- `users` 表字段：`id, dao_name(道号,唯一), email(唯一), password(bcrypt哈希), role(0玩家/1管理员), status(0禁用/1正常), realm_id(当前境界, 默认1=凡人), is_online(0离线/1在线), death_count(死亡次数), ling_shi(灵石), cultivation(修为), dao_yun(道韵), dao_law(道法领悟), comprehension(悟性%), avatar(头像访问路径, NULL=默认), gender(性别: 1=男/2=女, 默认1), sect_id(宗门), register_time, login_time, last_active_time(心跳), ping_ms, last_sign_time, last_cultivate_time(修炼冷却), access_token`。旧 `email_code` 预留列已淘汰（dropColumn）。
- **邮箱验证码与重置密码（已实装）**：独立表 `email_codes`（`email, code(6位), purpose(register|reset), expires_at(+10分钟), used`，索引 `(email,purpose,id)`）——一次一码，校验只认最新一条未用未过期（`verifyAndConsume` 原子核销防重放）。SMTP 配置在 `.env`（`SMTP_HOST/PORT/SECURE/USER/PASS/MAIL_FROM`，见 `.env.example`）；**`SMTP_HOST` 留空=未配置：开发环境验证码打印到后端控制台，生产发送接口 503**。发信与模板在 `utils/mailer.js`（`buildCodeMail()` 水墨风 HTML+纯文本降级）。发码限频：同邮箱同用途 60 秒（409）。**注册接码**受系统配置 `register_email_code_enabled`（默认开）控制，可临时关闭放行未配 SMTP 的环境；重置密码不受开关影响。开关状态经公开接口 `GET /api/auth/register-config` 暴露，注册页据此隐藏验证码输入并跳过本地校验（关闭时提交不带 `emailCode`）。**重置密码成功即清空 `access_token`**（吊销所有现有登录），写日志 type=`reset_password`。逻辑集中在 `controllers/authController.js` + `models/emailCodeModel.js`。
- **性别 `gender`（已实装）**：1=男、2=女，注册可选传（缺省 1），后台建号/编辑可改（均校验只收 1/2），在 `USER_SELECT` 视图与 `USER_UPDATABLE` 白名单内。前台注册页有「男修/女修」单选；首页角色卡展示性别行，并按性别绑定**角色卡背景立绘**——男=`web/image/boy.webp`、女=`web/image/girl.webp`（由同目录原图 PNG 用 sharp 压制：720 宽、质量 82，4.8/5.9MB→84/108KB；原 PNG 留作素材源，改图后需重新压制）。立绘为浅色水墨调，`charBgStyle` 计算属性只覆轻纱渐变（0.5→0.1）不重蒙版，文字可读性靠 `.char` 的宣纸色 text-shadow 光晕兜底；竖版 cover 顶部裁切。
- **头像 `avatar`（上传/URL/展示全链路已实装）**：存对外访问路径 `/api/uploads/avatars/<文件名>` 或外链 http(s) URL，NULL 表示无头像（前端 `components/UserAvatar.vue` 以道号首字圆形占位，图片加载失败也回退占位）。上传走 `POST /api/user/avatar`（multipart，字段名 `avatar`），multer 落盘 `node/uploads/avatars/`（已 gitignore），文件名 `u<用户ID>_<时间戳>.<ext>`——仅接受 JPG/PNG/WebP/GIF、≤2MB，扩展名按 mimetype 取（不信任原始文件名）；落盘后再做**魔数复核**（`sniffImageMime()` 读文件头，与声明 mimetype 不符即删文件返 400，防伪造 MIME）。外链走 `POST /api/user/avatar/url`（仅校验并存 URL，不代理拉取；限 http/https、≤255 字符；传空清除恢复默认）。`app.js` 用 `express.static` 托管 `/api/uploads`（长缓存，文件名不复用）。换头像/改外链/后台删号会清理旧本地文件（`avatarController.removeAvatarFile`，仅处理头像目录内路径，静默失败）。成功写日志 type=`avatar`。`USER_SELECT` 视图与三个排行榜查询均带出 `avatar` 字段。**前台入口**：首页角色卡头像可点击（悬停浮现「换」角标）打开 `components/AvatarModal.vue`（上传本地图片 / 粘贴图片 URL 即时预览 / 恢复默认），成功后 `updated` 事件回抛最新用户视图直接落 `auth.user` 并刷新日志。
- **悟性 `comprehension`**：整数百分比，上限 100。规则集中在 `node/src/utils/comprehension.js`——注册与后台建号时 `rollComprehension()` 随机生成（99.5% 均匀取 1~10，0.5% 直接得 15）；后台编辑经 `clampComprehension()` 收敛到 0~100。前台 HUD 资源栏、后台用户列表/编辑弹窗均已展示。
- **修炼速度（暂定机制）**：仅作用于功法/心法，**修为获取不走此机制**（签到/打坐等不受影响）。公式：最终修炼速度% = 基础10% + 基础10%×悟性%（悟性满值 100 时封顶 20%）。计算函数 `cultivationSpeedPercent()` 在 `utils/comprehension.js`，功法/心法系统实装时在后端结算调用。设计文档：`docs/设计文档/悟性与修炼速度机制.md`。
- **修为修炼（已实装）**：每次修炼获得当前境界（含小境界）总经验 `advance_exp` 的 5%；修为丹生效时段内数值再乘 (1+加成%/100)，最后一步四舍五入、保底 1 点（丹药服用玩法未实装，加成暂按 0 计）。与悟性无关，签到奖励也不受丹药加成影响。计算函数 `cultivationGainPerSession()` 在 `utils/cultivationGain.js`，结算在 `controllers/cultivateController.js`（原子 UPDATE 防连点，同签到模式）；冷却秒数为系统配置 `cultivate_cooldown_seconds`（默认 60）。仙王及以上 `advance_exp=0`（靠道法晋级），修炼接口返回不可打坐的提示。设计文档：`docs/设计文档/修为修炼机制.md`。
- **修行日志表 `player_logs`**：`id, user_id, type(register/login/logout/sign_in/cultivate...), content(叙事文本), created_time`，索引 `(user_id, created_time)`。写入用 `playerLogModel.addLog()`——**旁路功能，内部 try/catch 只告警不抛错**，各控制器在操作成功后调用；管理员的登录/登出不写。删除玩家时手动级联清理其日志（无外键）。新增玩家操作时记得补一条 addLog。
- **每日修炼统计表 `user_daily_stats`（前台「今日修炼」面板数据源）**：`(user_id, stat_date)` 主键按天一行，字段 `cultivate_count`(修炼次数)/`meditation_seconds`(打坐秒数, 按结算日整段入账)/`cultivation_gained`(获得修为=修炼+打坐+签到修为型奖励, 道韵/道法不计)。写入用 `userDailyStatModel.bumpDailyStat()`（UPSERT 累计，**旁路，失败只告警**，同 addLog），挂点：`doCultivate`、`settleDueMeditation`、`doSignIn`(仅 `tier.type==='cultivation'`)。归日一律用数据库 `CURDATE()`。删除玩家时手动级联清理。新增修为来源时记得补 bumpDailyStat。
- **世界频道表 `world_messages`（已实装）**：`id(即时间序,增量游标), user_id, content(VARCHAR255 纯文本), created_time`，索引 `(user_id, id)`。全服单频道、无 WebSocket——前端 5 秒轮询 `afterId` 增量拉取。发言在 `controllers/worldChatController.js`：清洗控制字符、最多 200 字、发言间隔走系统配置 `world_chat_cooldown_seconds`（默认 5 秒，0 不限，DB 时钟计），冷却未到 409。消息视图带发送者道号/头像/性别/境界/宗门名（`models/worldMessageModel.js` 的 MESSAGE_SELECT，LEFT JOIN realms+sects）。发言不写修行日志（防刷屏噪音）。**前台点击频道内某位道友的头像或道号**，弹出用户名片 `components/ChatUserModal.vue`（左右分栏：左侧性别立绘 boy/girl.webp，右侧玩家信息——头像 + 道号 + 境界 + 性别/所属宗门），数据取自消息项本身不额外请求。删除玩家时手动级联清理其消息。**发言先过敏感词拦截**（长度校验后、冷却校验前，命中 400「言辞含违禁之语」，改词重发不吃冷却）。
- **社交：好友/私信/拉黑（已实装）**：三张表——
  - `friendships`（好友关系/请求）：`id, requester_id, addressee_id, status(0待通过/1已结交), created_time, updated_time`，唯一键 `(requester_id,addressee_id)`。方向记发起/接收，是否好友需查两个方向；`friendshipModel.findBetween` 兜底反向重复请求。
  - `user_blocks`（单向拉黑）：`id, user_id(拉黑者), blocked_id, created_time`，唯一键 `(user_id,blocked_id)`。
  - `private_messages`（点对点私信）：`id, sender_id, receiver_id, content(VARCHAR255), receiver_read(0未读/1已读), created_time`，索引 `(receiver_id,sender_id,id)`/`(sender_id,receiver_id,id)`；会话由收发双方 id 聚合，无独立会话表。
  - 规则集中在 `controllers/relationController.js`（好友+拉黑+关系状态）与 `controllers/privateMessageController.js`（私信）：**结交/私信前双向拉黑校验**（任一方拉黑对方即 403）；**拉黑即断交**（`deleteBetween` 清除既有好友/待通过请求）；私信复用敏感词拦截+控制字符清洗+≤200 字。数据访问 `models/friendshipModel.js`/`userBlockModel.js`/`privateMessageModel.js`。
  - 结交请求/应允写系统通知（`player_logs` type=`friend_request`/`friend_accepted`，已并入 `announcementController.NOTICE_TYPES`，前台「通知」弹窗「通知请求」页可见）。私信不写日志，未读靠 `private_messages.receiver_read` 聚合。
  - 删除玩家时手动级联清理三表（`deleteUser`）。**前台入口**：世界频道名片 `ChatUserModal` 四按钮（结交/切磋/私信/拉黑）+ 独立 `/friends` 伙伴页，详见前端章节。
- **修仙公告表 `announcements`（已实装）**：`id, title(≤60字), content(VARCHAR2000纯文本), pinned(置顶0/1), status(1发布/0下架), created_time, updated_time`，索引 `(status,pinned,id)`。后台发布/编辑/删除，前台「通知」弹窗展示。数据访问 `models/announcementModel.js`（`listPublished` 前台只取 status=1、置顶优先再 id 降序；`listAll` 后台分页含下架），前后台控制器同在 `controllers/announcementController.js`。**前台「通知」弹窗**（首页顶栏 ✉ 按钮打开 `components/NotificationModal.vue`）分两页签：「修仙公告」= 已发布公告；「通知请求」= 玩家收到的系统通知（复用 `player_logs`，当前纳入 `pill_receive` 收到丹药赠礼、`friend_request` 收到结交请求、`friend_accepted` 结交获应允；纳入类型定义在 `announcementController.js` 的 `NOTICE_TYPES`，新增被动通知类型在此追加）。玩家端 `GET /api/user/announcements` 一次返回 `{ announcements, notices }`。未读红点：前端以「最大公告id:最大通知id」签名与 localStorage `noticeSeen` 比对，打开弹窗即标记已读。`playerLogModel.listLogsByTypes()` 按类型 IN 筛选日志供通知用。
- **敏感词检测（已实装）**：词库 `node/src/data/sensitive-words.txt`（约 5 万条，合并自根目录 `Vocabulary/` 17 个源文件——该目录为本地素材源已 gitignore；合并规则：归一化去重、剔单字、跳过 A=B/A,B 组合行）+ 白名单 `sensitive-words-allow.txt`（剔除误伤游戏词的**独立词条**：修炼/弟子/师父/功法/大法/测试/联系/网络——不影响「法轮大法好」等完整词条命中；两份 txt 井号行为注释，直接编辑重启生效）。匹配器 `utils/sensitiveWords.js`：字典树，`server.js` 启动时 `initSensitiveWords()` 建树（76ms/堆 64MB/单条消息扫描 0.03ms）；归一化「小写+全角转半角」，匹配途中跳过填充符识别「习*近*平」「法 轮 功」式变体（先查树边无边才跳，词条含符号不受影响）。导出 `scanSensitive(text)`→`{hit,words,sanitized打码}`、`containsSensitive(text)`。已接：世界频道发言；**待接**：注册道号、宗门名称/简介等文本入口（直接调 `containsSensitive`）。
- **修为圆满**：修炼接口在 `cultivation >= advance_exp` 时停止收益（409「修为已圆满」），状态接口带 `isFull`；前台按钮切换为「突破」打开突破弹窗。签到修为不截断，可能略超圆满值。
- **境界突破（已实装）**：条件按当前境界行的 `requirement_type` 判定——经验型需修为≥`advance_exp`（成功后扣除，溢出保留）、道韵型需道韵≥`dao_yun_required`（成功后扣除）、道法型需道法≥`dao_law_required`（**不消耗**）、终点（圣人）不可突破。含「雷劫」的类型先按 `tribulation_death_rate` 掷死亡：陨落则 `death_count+1`、对应资源折半、境界不跌。成功/陨落均原子 UPDATE（带境界+资源守卫防并发），写日志 type=`breakthrough`/`death`。逻辑在 `controllers/breakthroughController.js`；免死药/突破丹待丹药服用系统接入。设计文档：`docs/设计文档/境界突破机制.md`。
- **打坐（定时挂机修炼，已实装）**：玩家选定时长（一炷香30/半个时辰60/一个时辰120/两个时辰240 分钟，白名单）入定，**期间不可中断**——修炼/突破/再次打坐接口均拦截，无取消接口（除控制器前置校验外，`applyCultivate`/`applyBreakthroughSuccess`/`applyBreakthroughDeath` 的 `WHERE` 亦加打坐守卫 `meditation_end_time IS NULL OR <= NOW()`，SQL 层兜底并发下入定与修炼/突破同时成功）。期满按时长一次性结算修为：每小时得当前境界圆满修为(`advance_exp`)的 30%（系统配置 `meditation_gain_percent_per_hour`，收敛 [0,1000]），最后四舍五入、保底 1，结算封顶到圆满；`advance_exp=0` 的境界不可打坐。`users` 表 `meditation_start_time/meditation_end_time`（NULL=未打坐，到期结算后清空）；`applyMeditationStart/Settle` 原子读写并以 DB 时钟守卫防并发重复开场/结算。**惰性结算**：`meditationController.settleDueMeditation()` 被打坐/修炼/突破各接口在处理前调用，补结算离线到期的场次（无定时任务）。日志 type=`meditate_start`（入定）/`meditate`（出定）。计算函数 `cultivationGain` 类比的 `utils/meditation.js`，逻辑在 `controllers/meditationController.js`。设计文档：`docs/设计文档/打坐机制.md`。
- **丹药表 `pills` / `pill_grades`**：`pills` 一行一种丹药（id 为数据文件字符串主键，如 `pill_fanren_cultivation`，含 realm/realm_rank/category/effect_mode 等）；`pill_grades` 每丹药 凡(fan)/灵(ling)/道(dao) 三档，`effects` 为 JSON 列（元素字段 `target/targetName/type(percent|flat)/value/duration/hours/polarity`，mysql2 读出时已自动解析为对象）。种子数据 `node/src/data/pills.json`（由 `资源文件/丹药相关/pills.json` 复制，顶层含元信息，取 `.pills`），`seedPills()` 表空时导入（475 种 / 1425 件）。数据访问在 `models/pillModel.js`，后台编辑校验（效果白名单等）在 `controllers/pillController.js`。
- **丹药背包表 `user_pills`（已实装）**：`id, user_id, pill_id, grade, quantity, obtained_time, updated_time`，唯一键 `(user_id, pill_id, grade)`——同种同品质合并计数。数据访问在 `models/userPillModel.js`：列表/元数据连表 pills+pill_grades；`addUserPills` upsert 累加（预留获得途径）、`removeUserPills` 带 `quantity >= ?` 守卫防超扣（扣到 0 删行）、`transferUserPills` 事务转赠（扣减+累加+回滚）。接口在 `controllers/userPillController.js`（列表筛选/赠送/丢弃），赠送校验目标为 role=0 且 status=1 的玩家、不可赠自己；赠送/丢弃写日志 type=`pill_gift`/`pill_receive`/`pill_discard`。**服用未实装**（药力/buff 系统未接入，前端按钮为占位 toast）；玩家暂无获得丹药的正式途径（炼丹/奖励待做）。删除玩家时连带清理其 `user_pills`（`deleteUser` 手动级联）。
- **宗门表 `sects`（列表/创建/详情/加入退出/成员职位管理已实装）**：`id, name(唯一), avatar/background(外链URL, NULL=首字占位/默认洞府图), intro, realm_req(入门大境界名, 空=无要求), realm_req_rank(该大境界最小realms.id, 加入校验用), leader_id(宗主), activity(活跃度, 机制未接入暂由后台调整), created_time`。成员**归属**记在 `users.sect_id`（NULL=散修，人数实时聚合），创建走 `createSect()` 事务：原子扣 `SECT_CREATE_COST`(5000 灵石, 硬编码于 `controllers/sectController.js`) → 建宗（重名 ER_DUP_ENTRY 译 409）→ 创建者入驻任宗主，写日志 type=`sect_create`；`disbandSect()` 事务解散（清全体成员归属+成员表）。删除玩家时其执掌宗门自动解散（`deleteUser` 先调 `disbandSectsLedBy`）。境界要求选项 `sectRealmOptions()` 按大境界 GROUP BY（**别名用 realm_rank，rank 是 MySQL 8 保留字**）。数据访问 `models/sectModel.js`，前后台接口同在 `controllers/sectController.js`。**二期待做**：山峰/执法堂/文书/宗主审判/大牢/设施分层、活跃度来源、图片文件上传（暂外链）、宗门名接敏感词。设计文档：`docs/设计文档/宗门机制.md`、`docs/设计文档/宗门职位与权限机制.md`。
- **宗门成员表 `sect_members`（职位体系一期已实装）**：`id, sect_id, user_id(唯一), position(职位key), peak_id(山峰预留NULL), joined_time`，索引 `(sect_id, position)`。**归属以 `users.sect_id` 为准、本表记职位，两处同事务写**；启动时对存量入宗用户幂等回填（宗主→sect_master，余→outer_disciple）。职位枚举在 `node/src/utils/sectPositions.js`（14 职：太上长老rank1/宗主2/神子3/峰主4/六种长老级5/真传6/内门7/外门8/杂役9，含默认编制 quota——太上2、定额职各1、执事3；**峰主/真传依赖山峰系统一期不可任命**；建宗自定编制待 `sect_quota` 表）。规则：**人事权/信息权=rank≤3**（太上/宗主/神子）；**神子对长老级以上(rank≤5)任免/逐出 403**（罢免信二期）；加入=境界≥`realm_req_rank` 即入（外门弟子），宗主不可退宗（须传位/解散），传位后原宗主转太上长老（编制校验）；定额任命在事务内 `FOR UPDATE` 锁行校验编制。日志 type=`sect_join/sect_quit/sect_kick/sect_appoint/sect_transfer/sect_disband`，其中 `sect_appoint`/`sect_kick` 已纳入通知 NOTICE_TYPES。删除玩家级联清理本表。前端职位映射镜像在 `web/src/utils/sectPositions.js`（与后端对应，勿单方增删）。
- **功法表 `techniques` / 法宝表 `artifacts`（元数据+后台增删改查已实装；玩家侧装备/结算未实装）**：字符串主键（数据文件 id，后台新增时服务端生成 `tech_<type>_<tier>_a<时间戳>`/`artifact_<tier>_<type>_a<时间戳>`）。`techniques`：`type(main/heart), tier(阶_品 15档), category(流派), realm_min/realm_max(适用境界realms.id), max_level, level_multipliers(JSON), base_progress, threshold_base, threshold_ratio, base_effects(JSON), summary, intro`；`artifacts`：`type(natal/offense/defense/support), tier(faqi…xianqi 五阶), realm_req(大境界门槛)+realm_req_rank, refine_max, refine_multipliers(JSON), refine_base, threshold_base, threshold_ratio, base_effects(JSON可含负面), summary, intro`。种子数据 `node/src/data/techniques.json`（600 部）/`artifacts.json`（300 件），`seedTechniques()`/`seedArtifacts()` 表空导入；生成器 `资源文件/功法法宝相关/generate-pools.mjs`（确定性随机可重建）。数据访问 `models/techniqueModel.js`/`artifactModel.js`（品阶用 FIELD() 固定排序；功法列表 JOIN realms 带出范围名称），控制器 `controllers/techniqueController.js`/`artifactController.js`——校验要点：效果只收五维(hp/attack/defense/spirit/lingQi)且无 duration、倍率数组长度必须=满层数且逐层不降（跨字段合并现值校验）、法宝 `realmReq` 须为存在的大境界名（服务端查 realms 解析 rank）、品阶/类型白名单。**删除无级联**（user_techniques/user_artifacts 未建）。数值标定与机制详见 `docs/设计文档/功法机制.md`、`法宝机制.md`。
- **在线态**：登录/注册时置 `is_online=1`，`POST /api/auth/logout`(需鉴权) 置 0；服务启动时 `UPDATE users SET is_online=0` 清零，避免残留。`death_count` 目前无游戏机制写入（突破/死亡系统未做），排行榜查询已就绪，待机制接入后自然填充。
- **在线榜网络状态（心跳，已实装）**：`users` 补 `last_active_time`(最近心跳)/`ping_ms`(上报延迟, 收敛 0~60000)。前端玩家登录期间全局心跳——`composables/heartbeat.js`（`App.vue` 挂载一次，15 秒/跳，管理员与登出不跳），每跳实测往返延迟随下一跳经 `POST /api/user/heartbeat` 上报（`touchHeartbeat` 顺带兜底 `is_online=1`）；登录时 `updateLoginState` 同步刷新 `last_active_time` 并清 `ping_ms`（首跳前不误判掉线）。`rankOnlineByRealm` 带出 `ping_ms` + `idle_seconds`(TIMESTAMPDIFF)，**前台修仙榜在线 tab 与后台仪表盘在线榜**（同源查询）经共享的 `web/src/utils/network.js` `netStatus()` 显示色点+文字：<100ms 流畅绿 / <300ms 一般黄 / 其余迟缓红（≥1s 显示秒）、距心跳 >45s（两跳多）灰「掉线」、从未上报「—」。
- **境界表 `realms`**：`id`(境界序号, 1=凡人 … 83=圣人, 非自增, 直接用数据文件的 id 作主键) + 各项属性(hp/ling_qi/attack/defense/spirit)与晋级要求(requirement_type/advance_exp/dao_yun_required/dao_law_required/tribulation_type/tribulation_death_rate/next_realm/note)。种子数据在 `node/src/data/realms.json`（由 `资源文件/境界相关/cultivation_realm_table.json` 复制而来），`seedRealms()` 在表为空时批量导入(用 `pool.query` 的 `VALUES ?` 批插，execute 不支持)。
- `users.realm_id` 绑定境界，所有人初始化为 `1`(凡人)；`userModel` 的用户视图 `USER_SELECT` 用 `LEFT JOIN realms` 带出 `realm_name`、`LEFT JOIN sects` 带出 `sect_name`（NULL=散修）。
- **道韵/道法解锁标志**：`USER_SELECT` 以子查询计算 `dao_yun_unlocked`/`dao_law_unlocked`（`realm_id >= 首个 requirement_type 含「道韵」/「道法」的境界 id`，当前数据为 58 地仙初期 / 80 仙王，后台改境界表自动生效）。前台顶部资源栏与「详细属性」弹窗（`components/AttributeModal.vue`，角色卡「详细属性」按钮打开，展示头像/道号/性别/宗门/资源属性/悟性/上次登录）据此隐藏未解锁的道韵/道法。
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
- `POST /api/auth/register` — `{ daoName, email, password, gender?, emailCode }` → `{ token, user }`（新用户恒为玩家；gender 可选 1=男/2=女缺省 1；emailCode 为邮箱验证码，配置 `register_email_code_enabled` 关闭时可不传）
- `GET /api/auth/register-config` —（公开）注册页配置 → `{ emailCodeEnabled }`（注册是否需要邮箱验证码，前端据此隐藏验证码输入）
- `POST /api/auth/email-code` — `{ email, purpose: 'register'|'reset' }`（公开）发送邮箱验证码 → `{ ok, resendSeconds, ttlMinutes }`；注册用途邮箱已占用 409、重置用途邮箱未注册 404、60 秒限频 409、SMTP 未配置(生产) 503
- `POST /api/auth/reset-password` — `{ email, emailCode, newPassword }`（公开）重置密码并吊销现有登录 → `{ ok }`；验证码有误/过期 400，邮箱未注册 404，账号禁用 403
- `POST /api/auth/login` — `{ account, password }`（account 可为道号或邮箱；管理员也用此接口登录）→ `{ token, user }`，`user.role` 决定前端跳向后台还是游戏
- `GET /api/user/profile` — 需用户鉴权 → `{ user }`
- `GET /api/user/rankings` — 需用户鉴权 → `{ realmTop, onlineTop, deathTop }`（各前十，供前台首页展示；与后台 `/admin/rankings` 同源，仅鉴权层不同）
- `GET /api/user/cultivate` — 需用户鉴权 → 修炼状态 `{ canCultivate, isFull, gain, cooldownSeconds, lastCultivateTime, nextCultivateTime, cultivation, advanceExp, realmName }`
- `POST /api/user/cultivate` — 需用户鉴权，执行修炼 → 状态 + `gained`；冷却未到或修为已圆满返回 409
- `GET /api/user/breakthrough` — 需用户鉴权 → 突破状态 `{ atPeak, canBreakthrough, realmName, nextRealm, reqKind/reqLabel/required/current/met, hasTribulation, tribulationType, deathRatePercent, successRatePercent }`
- `POST /api/user/breakthrough` — 需用户鉴权，执行突破 → 成功 `{ success:true, newRealm, ... }` / 身陨 `{ died:true, deathCount, lossLabel, ... }`；条件不足 409，圣人 400
- `GET /api/user/meditation` — 需用户鉴权 → 打坐状态 `{ meditating, remainSeconds, durationLabel, canMeditate, reason, options:[{minutes,label,gain}], gainPerHourPercent, cultivation, advanceExp, settled }`（到期场次先行惰性结算，其结果放 `settled`）
- `POST /api/user/meditation` — `{ minutes }` 需用户鉴权，开始打坐（期满自动结算，不可中断）→ 打坐状态；时长非白名单 400，已在打坐/修为圆满/此境不可打坐 409/400
- `GET /api/user/pills?page&pageSize&keyword&category&realm&grade` — 需用户鉴权 → `{ list, total, page, pageSize }` 丹药背包（每项为「丹药×品质」条目，带品质档效果与数量；grade 取 fan/ling/dao）
- `GET /api/user/pills/meta` — 需用户鉴权 → `{ categories, realms }`（筛选下拉，仅含玩家实际持有的类型/境界）
- `POST /api/user/pills/gift` — `{ pillId, grade, quantity, targetDaoName }` 需用户鉴权，赠送给指定道号玩家（事务转移）→ `{ ok, targetDaoName, remaining }`；数量不足 409，目标不存在/非玩家 404，赠自己 400
- `POST /api/user/pills/discard` — `{ pillId, grade, quantity }` 需用户鉴权，丢弃（不可寻回）→ `{ ok, remaining }`
- `GET /api/user/logs?limit` — 需用户鉴权 → `{ list }` 修行日志（最近 N 条，默认 20，上限 50）
- `GET /api/user/today` — 需用户鉴权 → 今日修炼统计 `{ cultivateCount, meditationSeconds, cultivationGained, breakthroughSuccessPercent }`（到期打坐先行惰性结算再取数；`breakthroughSuccessPercent` 为当前境界突破成功率=100-雷劫死亡率、无雷劫 100、圣人 null）
- `GET /api/user/world-chat?afterId&limit` — 需用户鉴权 → `{ list, lastId }` 世界频道消息（afterId=0 取最新 N 条正序，>0 只回更新的消息，limit 默认 30 上限 50）
- `POST /api/user/world-chat` — `{ content }` 需用户鉴权，发言（≤200 字，间隔见配置 `world_chat_cooldown_seconds`）→ `{ message }`；空内容/超长/含敏感词 400，冷却未到 409
- `POST /api/user/sensitive/check` — `{ text }`（≤5000 字）需用户鉴权，通用敏感词检测 → `{ hit, words(命中词≤10), sanitized(打码文本) }`；空文本/超长 400。供前端预检与后续玩法复用
- `GET /api/user/sects?page&pageSize&keyword&realmReq` — 需用户鉴权 → `{ list, total, page, pageSize, mySectId }` 宗门列表（keyword 搜名称；realmReq 传大境界名精确筛选，`none`=只看无要求；每项带宗主道号/境界与实时人数）
- `GET /api/user/sects/meta` — 需用户鉴权 → `{ realms:[{realm, realm_rank}], createCost }`（立派境界要求选项与费用）
- `GET /api/user/sects/:id` — 需用户鉴权 → `{ sect, my }` 宗门详情（my=我在此宗的职位视图 `{position, position_name, rank, joined_time}`，非本宗成员 null）；不存在 404（meta 路由需先于 :id 声明）
- `POST /api/user/sects` — `{ name, intro?, realmReq?, avatarUrl?, backgroundUrl? }` 需用户鉴权，创建宗门（事务扣 5000 灵石，自任宗主）→ `{ sect, user }`；重名/已有宗门/灵石不足 409，名称/境界/链接不合法 400
- `GET /api/user/sects/:id/members?page&pageSize` — 需用户鉴权 → `{ list, total, page, pageSize, my, leaderId, appointable }` 门人名录（任何玩家可看，按职级排序；本宗有人事权者 appointable 非空=可任命职位表[key/name/rank/quota]）
- `POST /api/user/sects/:id/join` — 需用户鉴权，拜入宗门（境界≥`realm_req_rank`，入宗即外门弟子）→ `{ ok, user }`；已有宗门/境界不足 409，宗门不存在 404
- `POST /api/user/sects/quit` — 需用户鉴权，退出宗门 → `{ ok, user }`；宗主不可退（须传位或解散）409，散修 409
- `POST /api/user/sects/:id/appoint` — `{ targetId, position }` 需用户鉴权，任免职位（人事权 rank≤3；神子对长老级以上 403；宗主/峰主/真传不可任命 400）→ `{ ok }`；编制满/已不在本宗 409，写目标通知 `sect_appoint`
- `POST /api/user/sects/:id/kick` — `{ targetId }` 需用户鉴权，逐出宗门（同任免权限与神子限制）→ `{ ok }`；写目标通知 `sect_kick`
- `POST /api/user/sects/:id/transfer` — `{ targetId }` 需用户鉴权，传位宗主（仅宗主；原宗主退居太上长老，编制满 409）→ `{ ok }`
- `PUT /api/user/sects/:id` — `{ name?, intro?, realmReq?, avatarUrl?, backgroundUrl? }` 需用户鉴权，修订宗门资料（信息权 rank≤3）→ `{ sect }`；重名 409
- `POST /api/user/sects/:id/disband` — 需用户鉴权，解散宗门（仅宗主本人）→ `{ ok, user }`
- `POST /api/user/avatar` — 需用户鉴权，上传头像（multipart/form-data，文件字段 `avatar`，JPG/PNG/WebP/GIF ≤2MB，落盘后魔数复核）→ `{ user }`（含新 `avatar` 路径）；类型/大小/内容不符 400
- `POST /api/user/avatar/url` — `{ url }` 需用户鉴权，以外链设置头像（限 http/https、≤255 字符；传空字符串清除恢复默认）→ `{ user }`；格式/协议/长度不符 400
- `GET /api/user/announcements` — 需用户鉴权 → `{ announcements, notices }`（通知弹窗数据：已发布修仙公告[置顶优先]各30条 + 本人系统通知[复用 player_logs，当前含 pill_receive/friend_request/friend_accepted/sect_appoint/sect_kick]各30条）
- `POST /api/user/heartbeat` — `{ pingMs? }` 需用户鉴权，心跳上报（前端 15 秒/跳，pingMs 为上一跳实测往返延迟，收敛 0~60000；**空值判空存 NULL**——`Number(null)===0`，不判空首跳会误存 0ms）→ `{ ok }`；在线榜网络状态数据源
- `GET /api/user/relations/:userId` — 需用户鉴权 → 与某道友的关系 `{ isSelf }` 或 `{ isSelf:false, isFriend, outgoingPending, incomingRequestId, isBlockedByMe, hasBlockedMe }`（频道名片按钮态判定）
- `GET /api/user/friends` — 需用户鉴权 → `{ friends, requests }`（我的好友[含在线态/境界/宗门] + 收到的待通过结交请求）
- `POST /api/user/friends/request` — `{ targetId }` 需用户鉴权，发起结交（写对方通知）→ `{ ok }`；已是好友/已发出/对方已请求 409，拉黑关系 403，目标非玩家 404，对自己 400
- `POST /api/user/friends/accept` — `{ requestId }` 需用户鉴权，应允结交（写发起方通知）→ `{ ok }`；请求失效 404
- `POST /api/user/friends/reject` — `{ requestId }` 需用户鉴权，婉拒结交（删待通过行）→ `{ ok }`；请求失效 404
- `POST /api/user/friends/remove` — `{ targetId }` 需用户鉴权，断交 → `{ ok }`
- `GET /api/user/blocks` — 需用户鉴权 → `{ blocks }` 我的黑名单
- `POST /api/user/blocks` — `{ targetId }` 需用户鉴权，拉黑（并解除既有好友/请求）→ `{ ok }`
- `POST /api/user/blocks/remove` — `{ targetId }` 需用户鉴权，解除拉黑 → `{ ok }`
- `GET /api/user/messages` — 需用户鉴权 → `{ conversations, unread }`（会话列表：每往来对象取最新一条+我方未读数；unread 为未读总数）
- `GET /api/user/messages/unread` — 需用户鉴权 → `{ unread }`（未读私信总数，伙伴角标轻量轮询；须先于 `:userId` 声明）
- `GET /api/user/messages/:userId` — 需用户鉴权 → `{ list, peer }`（与某道友往来消息[正序，并标记其发来的为已读] + 对方公开信息）；目标非玩家 404
- `POST /api/user/messages` — `{ targetId, content }` 需用户鉴权，发私信（≤200 字，敏感词/控制字符清洗）→ `{ message }`；拉黑关系 403，空/超长/含敏感词 400，目标非玩家 404，给自己 400
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
- `GET /api/admin/techniques?page&pageSize&keyword&type&tier&category` → `{ list, total, page, pageSize }`（功法列表，每项带 realm_min_name/realm_max_name）
- `GET /api/admin/techniques/meta` → `{ tiers, categories }`（筛选下拉；需先于 `:id` 声明）
- `POST /api/admin/techniques` — 新增功法（id 服务端生成）→ `{ technique }`；校验不过 400
- `PUT /api/admin/techniques/:id` — 编辑功法（部分字段，倍率长度与满层数跨字段校验）→ `{ technique }`；不存在 404
- `DELETE /api/admin/techniques/:id` — 删除功法 → `{ ok }`；不存在 404
- `GET /api/admin/artifacts?page&pageSize&keyword&type&tier` → `{ list, total, page, pageSize }`（法宝列表）
- `GET /api/admin/artifacts/meta` → `{ tiers, types }`（筛选下拉；需先于 `:id` 声明）
- `POST /api/admin/artifacts` — 新增法宝（id 服务端生成，realmReq 解析为 rank）→ `{ artifact }`；校验不过 400
- `PUT /api/admin/artifacts/:id` — 编辑法宝（部分字段）→ `{ artifact }`；不存在 404
- `DELETE /api/admin/artifacts/:id` — 删除法宝 → `{ ok }`；不存在 404
- `GET /api/admin/sects?page&pageSize&keyword` → `{ list, total, page, pageSize }`（宗门列表管理）
- `PUT /api/admin/sects/:id` — `{ name?, intro?, activity? }` → `{ sect }`；重名 409
- `DELETE /api/admin/sects/:id` — 解散宗门（清空全体成员 `sect_id`）→ `{ ok }`
- `GET /api/admin/announcements?page&pageSize&keyword` → `{ list, total, page, pageSize }`（公告列表，含下架，置顶优先）
- `POST /api/admin/announcements` — `{ title, content?, pinned?, status? }` 发布公告 → `{ announcement }`；标题为空/超 60 字 400
- `PUT /api/admin/announcements/:id` — `{ title?, content?, pinned?, status? }` 编辑（部分字段）→ `{ announcement }`；不存在 404
- `DELETE /api/admin/announcements/:id` — 删除公告 → `{ ok }`；不存在 404

## 前端结构

- **单一登录态**：整个前端只有一套 `token`/`user`（`stores/auth.js` + `api/http.js`，baseURL `/api`）。后台 API（`api/admin.js`）复用同一个 `http` 实例，不再有独立的 admin store/axios。`http` 响应拦截在 401 时清理登录态并跳 `/login`。
- 路由 `src/router/index.js`：`/login`、`/register`、`/reset`（重置密码，guestOnly）、`/home`（游戏）、`/sect`（宗门列表页）、`/my-sect`（我的宗门主页）、`/friends`（伙伴页）、`/pills`（丹药纳戒页），`/admin`（`AdminLayout` + 子路由 `dashboard`/`users`/`realms`/`pills`/`techniques`/`artifacts`/`sects`/`announcements`/`configs`）。**没有 `/admin/login`**——登录后 `LoginView` 按 `auth.user.role` 分流（管理员→`admin-dashboard`，玩家→`home`）。
- **注册接码与重置密码页**：注册表单含「邮箱验证码」字段 + 获取按钮（60 秒倒计时，取服务端 `resendSeconds`）——进页拉 `GET /api/auth/register-config`，配置关闭时整行 `v-if` 隐藏、本地不校验、提交不带 `emailCode`（拉取失败保守按需要验证码处理，最终判定在后端）；`ResetPasswordView.vue`（`/reset`，AuthShell 单栏）走 邮箱→验证码→新密码 流程，成功 toast 回登录页；登录页底部有「忘了密令？重置密码」入口。验证码输入行的 input 非 `.field` 直接子元素，AuthShell 的 `:deep(.field > input)` 不命中，两页各自补了同款样式。
- **路由页过渡动画**：`App.vue` 用 `<RouterView v-slot>` + `<Transition mode="out-in">`，按 `router.afterEach` 动态选名——游戏内页面（home ↔ sect，名单在 `GAME_PAGES`）前进左滑/返回右滑（`page-forward`/`page-back`），其余路由轻淡入（`page-fade`），首次进入/刷新无动画；过渡类挂在路由组件根元素上故用**全局样式**，`prefers-reduced-motion` 降级为纯淡入。路由 `scrollBehavior` 切页回顶，防滚动残留露馅。**防宽高跳动三件套**：`html { overflow-x: clip }`（style.css，整页 translateX 平移的视觉溢出不再触发横向滚动条）；游戏内页面一律与 HUD 同规**锁一屏 + 列表内滚**（body 永无纵向滚动条，页面间视口宽度一致，窄屏媒体查询再放开整页滚动）；页面背景**勿用 `background-attachment: fixed`**（过渡的 transform 会使 fixed 失效致背景闪跳）。新增游戏内页面时把路由名加进 `GAME_PAGES` 即得方向滑动，并遵守上述三条。
- **宗门列表页 `views/SectView.vue`（独立路由页非弹窗）**：首页左侧导航「宗门」进入，水墨风 + `web/image/dongfu.webp` 背景（由原 PNG sharp 压制 1600w/q80，原件已删；sharp 为 web devDependency）。含名称搜索、境界要求筛选（全部/无要求/各大境界，选项走 `/api/user/sects/meta`）、分页；「开宗立派」按钮开 `components/SectCreateModal.vue`（名称/境界要求/头像链接/背景链接/简介，标注耗灵石 5000，成功回抛 `{sect,user}` 落登录态并刷新；**支持 `mode='edit'` 编辑模式**——预填 sect 并提交 PUT，被详情弹窗复用为「修订资料」）；点击宗门行开 `components/SectDetailModal.vue`（背景横幅+宗徽、宗主道号境界、人数、活跃度、创建时间、简介；无背景图用 dongfu 默认；**按身份呈现操作**——散修「拜入此宗」[境界不足禁用+提示]、成员「退出宗门」、rank≤3「修订资料」、宗主「解散宗门」，所有人可开「门人名录」，操作均二次确认，成功后落 `auth.user` 并 `changed` 事件让列表页刷新）。**门人名录 `components/SectMembersModal.vue`**：成员分页列表（职位标签[长老级金色]/在线点/境界/入宗时间），有人事权者行内「任免」（下拉选职位含编制注记）「逐出」，宗主另有「传位」；神子对长老级以上的行不显示操作（后端亦 403）。本宗行标「本宗」（`mySectId`），顶栏有宗门时显「回本宗 ›」。首页角色卡有「宗门」行（`sect_name`，无则「散修」）。后台 `views/admin/SectsView.vue`：列表/搜索/分页 + 编辑弹窗（名称/活跃度/简介）+ 解散二次确认。
- **我的宗门主页 `views/MySectView.vue`（独立路由页 `/my-sect`）**：**首页导航「宗门」按归属分流**——`auth.user.sect_id` 有值 → `/my-sect`，散修 → `/sect`；**拜入成功**（`SectDetailModal` 的 `joined` 事件）与**立派成功**均直接 push 到此页。背景 `web/image/zongmenbeijing.webp`（用户素材 2560×1440/527KB 直接引用，未再压制），水墨轻纱 + 锁一屏内滚（窄屏单列放开），已入 `GAME_PAGES`。布局：顶栏（返回洞府/宗门名/我的职位徽章/灵石）+ 左栏信息卡（宗徽、宗主、门人数、活跃度、立派/入宗时间、简介 + 操作按钮：门人名录[复用 SectMembersModal]、修订资料[rank≤3，复用 SectCreateModal 编辑模式]、天下宗门、退出宗门/解散宗门[宗主]）+ 右栏**设施宫格 8 卡占位**（藏经阁/宗门商店/闭关室/宗门仓库/宗门任务/执法堂/宗门大牢/山峰，带「待启」印，点击 toast——二期逐个实装时替换点击行为）。**归属兜底**：进页无 sect_id 或详情 `my` 为空（被逐/解散）→ 同步 profile 后 `router.replace('/sect')`；人事变动（名录 `changed`）后刷新 profile+详情（宗主可能易位、我可能被改任）。
- **伙伴页 `views/FriendsView.vue`（独立路由页 `/friends`，非弹窗）**：首页左侧导航「伙伴」进入，同宗门页水墨壳（dongfu 背景、锁一屏内滚、已入 `App.vue` 的 `GAME_PAGES` 获滑动过渡）。**经典 IM 双栏布局**——左栏列表（四页签：好友[在线态+未读角标]、群聊[占位「敬请期待」]、结交请求[应允/婉拒]、黑名单[解除]，请求/黑名单页签带数量角标），右栏为**内嵌私聊区**：点左栏好友即 `selectPeer` 载入会话（消息滚动区 + 顶部对方信息与断交/拉黑操作 + 底部发送区），发送/5 秒轮询/进会话标记已读均在页内完成，未选会话时右栏显示引导空态。进页 `apiFriends/apiBlocks/apiConversations` 并发拉取，好友行未读数取自会话列表 `unreadMap`。**私信会话弹窗 `components/PrivateChatModal.vue`**（同款一对一传音逻辑）仅由**世界频道名片**的「私信」按钮使用（伙伴页用内嵌聊天，不走弹窗）。**频道名片 `ChatUserModal.vue` 右侧信息栏加四按钮**：结交（按关系态切换 结交/接受结交/待通过/已是道友）、切磋（占位 toast）、私信（拉黑关系下禁用，`@private` 抛给父级开 PrivateChatModal）、拉黑（拉黑/解除拉黑，`window.confirm` 二次确认）——打开时按 `user_id` 拉 `apiRelation` 判定按钮态。**首页「伙伴」导航红点角标**：未读私信数 + 待处理结交请求数（`HomeView` 进页拉取、每 30 秒背景刷新；`socialBadge`）。
- **丹药纳戒页 `views/PillsView.vue`（独立路由页 `/pills`，非弹窗，取代旧 `PillBagModal.vue`）**：首页左侧导航「丹药」进入，同宗门/伙伴页水墨壳（dongfu 背景、锁一屏内滚、已入 `GAME_PAGES` 获滑动过渡）。列表列：品质标签/丹药名/品阶(境界)/类型/功效(摘要，无摘要时由 effects 数组拼简述)/数量 + 行内三操作按钮**服用**（占位 toast）/**赠送**/**丢弃**；筛选：品质(凡/灵/道)/品阶(境界)/类型 下拉 + 名称关键字，下拉走 `/api/user/pills/meta` 仅含实际持有；分页，变动后本页清空自动回退一页。行点击打开 `components/PillDetailModal.vue` 详情（药力逐条+摘要/备注），行内「赠送/丢弃」经其新增 `initialMode` 属性直达对应面板（`main|gift|discard`），`changed` 回抛剩余数量，扣到 0 关详情窗并刷新列表。
- 全局守卫按单一 `token` + `user.role` 管控：`requiresAuth` 无 token 跳 `login`；`requiresAdmin` 无 token 跳 `login`、非管理员跳 `home`；`guestOnly` 已登录按角色跳对应首页。
- **登录/注册壳 `components/AuthShell.vue`**（水墨山水背景 + 金印卡片）：支持可选具名插槽 `aside`——提供则卡片变宽（max-width 900px）为「左展示 / 右表单」二分栏，窄屏（≤860px）改上下堆叠（展示栏收成 240px 横幅）；不提供则保持单栏（登录页不变）。**注册页 `RegisterView.vue` 为二分栏**：右侧信息表单（道号/邮箱/密码/确认密码/性别单选），左侧修仙角色展示随性别即时切换——男修/女修各播放一段视频立绘（`web/video/boy.mp4`、`girl.mp4`，Vite 资源导入，autoplay/loop/muted，`:key` 绑性别强制换源重播）；性别 `gender`(1男/2女) 随注册入库，首页角色卡按性别绑定 `web/image/boy.webp`/`girl.webp` 立绘背景（压制细节见「数据库」章节性别条目）。
- 后台页面在 `src/views/admin/`（`DashboardView` 含统计卡 + 三张排行榜、`UsersView`、`RealmsView`、`PillsView` 丹药管理、`SectsView` 宗门管理、`AnnouncementsView` 公告管理[列表/搜索/分页 + 发布/编辑弹窗(标题/正文/置顶/状态) + 删除确认]、`ConfigView` 系统配置），布局 `src/layouts/AdminLayout.vue`（侧边栏 + 顶栏，用 `useAuthStore` 取管理员信息与登出）。用户管理列表与游戏首页均展示玩家当前境界(`realm_name`)。**头像预览**：通用组件 `components/UserAvatar.vue`（有 `avatar` 显示图片、无/加载失败以道号首字圆形占位；`size` 定尺寸，配色可用 CSS 变量 `--ava-bg/--ava-fg/--ava-line` 覆盖，默认取全局主题变量），已接入后台仪表盘三张排行榜与用户管理列表道号列、前台首页修仙榜。`PillsView` 支持境界/类型/关键字筛选与分页，编辑弹窗 `components/PillFormModal.vue` 可改丹药名/备注及各品质档的成品名/效果数值/持续小时/摘要（摘要为手填文本，改效果后需同步手改）。**功法管理 `TechniquesView` / 法宝管理 `ArtifactsView`（全套增删改查）**：列表/筛选（类型/品阶/流派 或 类型/品阶 + 关键字）/分页 + 新增与编辑共用弹窗（品阶/类型下拉白名单、适用境界经 `apiRealms` 全境界下拉、法宝装备门槛为大境界去重下拉、倍率填逗号分隔文本、五维效果动态行编辑器）+ 删除二次确认；删空当页自动回退一页。`ConfigView` 对 `value_type=number` 的配置提供输入框+保存（如修炼间隔秒数），bool 用开关。
- **游戏首页 `HomeView.vue`** 按参考图（`资源文件/参考图/`）做成水墨仙侠 HUD：顶部资源栏 + 左侧模块导航(修行等) + 角色卡 + 中间境界/修炼/常用功能 + 右侧「修仙榜(境界/在线/死亡三 tab, 各前十, 走 `/api/user/rankings` 真实数据)/今日修炼/修行日志」。自带一套固定水墨浅色配色（组件内 CSS 变量，不随系统深浅变化）。真实数据用道号/境界/时间；**修炼已接后端**：境界卡显示「修为 当前/圆满」真实进度条与单次收益预览，「开始修炼」调 `POST /api/user/cultivate`，冷却期间按钮变「调息中 Ns」倒计时（前端每秒 tick，以服务端 `nextCultivateTime` 为准）；**修为圆满后按钮自动切换为赤金色「突破」**（`cultFull` 计算属性），点击打开 `components/BreakthroughModal.vue`：展示下一境界、条件达成度、雷劫类型与死亡率，确认后调 `POST /api/user/breakthrough`，成功/身陨各有结果页；`done` 事件触发首页全量刷新（profile/修炼状态/日志/榜单）。**修行日志为真实数据**（`/api/user/logs`，修炼/签到成功后即时刷新）。**今日修炼为真实数据**（`/api/user/today`，展示 修炼次数/打坐时长/获得修为/突破几率；修炼、签到、打坐结算、突破完成后调 `loadToday()` 即时刷新，突破几率为当前境界成功率、圣人显示 —）。**打坐（定时挂机修炼）已接后端**：「常用功能」的「打坐」按钮打开 `components/MeditationModal.vue`（择时辰 → 「是否打坐」二次确认强调不可中断 → 入定倒计时无取消 → 出定「功成」结算页）；入定期间境界卡的修炼/突破按钮替换为禁用「入定中 时:分:秒」，「打坐」快捷键也显示剩余倒计时，倒计时归零自动结算（以 `remainSeconds` 客户端锚定，弹窗开则由弹窗结算、闭则由首页兜底）并全量刷新（profile/修炼/日志/榜单）+toast。**丹药为独立页面**（左侧导航「丹药」跳 `/pills`，详见下方丹药纳戒页条目，旧弹窗 `PillBagModal.vue` 已删除）。**世界频道已接后端**（中列常用功能下方的聊天卡片，占中列余高、消息区内滚）：进页拉最新 30 条，此后每 5 秒 `afterId` 增量轮询（页签隐藏时跳过；停在底部才跟随滚动，翻历史不打断），客户端最多留 100 条；输入框 200 字上限，「传音」按钮发言（冷却/校验由服务端把关，报错走 toast），自己的消息道号金色高亮，消息带头像/境界标签/时间。宗门等其余系统仍为占位展示（点击提示"敬请期待"）。退出按钮会调 `apiLogout` 置离线。
- **项目 logo**：源图 `web/image/logo.png`（2048² 透明底，素材源不进包），sharp 压制两份产物——`web/public/favicon.png`（128px，浏览器标签图标，`index.html` 引用）与 `web/image/logo.webp`（256px，界面用：登录/注册壳金环内替代金印字、首页顶栏标题左侧 44px、后台侧边栏 32px）。改源图后需重压两份。
- **时间展示统一按东八区**：服务器/MySQL 时钟为 UTC，接口返回带 Z 的 ISO 串（时刻正确）；前端展示一律走 `src/utils/datetime.js` 的 `fmtDateTime()`（Intl 固定 Asia/Shanghai，输出 `YYYY-MM-DD HH:MM:SS`，可再 slice 派生短格式）。**勿对 ISO 串直接 `replace('T')/slice` 截取**——那会把 UTC 钟面原样显示（慢 8 小时，即世界频道时间不对的历史根因）。倒计时类逻辑用时刻差值，与时区无关。
- 主题：`src/style.css` 用 CSS 变量定义配色，通过 `@media (prefers-color-scheme: dark)` 适配系统深/浅色；表单基元类（`.field/.btn/.form-error`）为全局样式，页面级样式用 SFC `scoped`。
- **全局通知（右上角 toast）**：`composables/toast.js`（模块级单例队列）+ `components/ToastHost.vue`（挂在 `App.vue`，fixed 右上角，info/success/error 三类，自动消失、点击关闭）。**页面级提醒一律走 toast**（首页修炼结果/占位提示、后台各页加载与操作报错、配置保存反馈），不再用页内横幅；表单内的字段校验错误仍留在表单旁（登录/注册/各编辑弹窗）。新页面报错请用 `useToast().error(...)`。

## 架构要点

- 前后端通过 HTTP API 通信。`web/vite.config.js` 已配置 proxy：开发时 `/api` 请求自动转发到 `http://localhost:3000`，前端代码直接请求相对路径 `/api/...` 即可，无跨域问题。
- 新增后端游戏模块时：在 `node/src/routes/` 下建子路由文件，并在 `node/src/routes/index.js` 中挂载（如 `router.use('/player', playerRouter)`）；对应控制器放 `controllers/`、数据访问放 `models/`。
- 游戏核心数值与状态判定（修炼进度、境界突破、战斗结算等）应由后端负责，前端只做展示与交互，防止客户端篡改。
