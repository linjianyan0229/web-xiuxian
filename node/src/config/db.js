import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mysql from 'mysql2/promise'
import { config, allowSeedDefaultAdmin } from './env.js'
import { hashPassword } from '../utils/password.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool

// 建表语句：用户表（role 区分身份：0=玩家, 1=管理员）
const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  dao_name      VARCHAR(32)     NOT NULL                 COMMENT '道号',
  email         VARCHAR(128)    NOT NULL                 COMMENT '邮箱',
  password      VARCHAR(255)    NOT NULL                 COMMENT '密码(bcrypt哈希)',
  role          TINYINT         NOT NULL DEFAULT 0       COMMENT '角色: 0=玩家, 1=管理员',
  status        TINYINT         NOT NULL DEFAULT 1       COMMENT '状态: 0=禁用, 1=正常',
  realm_id      INT UNSIGNED    NOT NULL DEFAULT 1       COMMENT '当前境界(realms.id), 1=凡人',
  is_online     TINYINT         NOT NULL DEFAULT 0       COMMENT '是否在线: 0=离线, 1=在线',
  death_count   INT UNSIGNED    NOT NULL DEFAULT 0       COMMENT '死亡次数(突破失败等)',
  ling_shi      BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '灵石',
  cultivation   BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '修为',
  dao_yun       BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '道韵',
  dao_law       BIGINT UNSIGNED NOT NULL DEFAULT 0       COMMENT '道法领悟',
  comprehension TINYINT UNSIGNED NOT NULL DEFAULT 1      COMMENT '悟性(%), 上限100, 注册时随机生成',
  avatar        VARCHAR(255)    DEFAULT NULL             COMMENT '头像访问路径(/api/uploads/avatars/..., NULL=默认头像)',
  gender        TINYINT         NOT NULL DEFAULT 1       COMMENT '性别: 1=男, 2=女',
  sect_id       BIGINT UNSIGNED DEFAULT NULL             COMMENT '所属宗门(sects.id, NULL=散修)',
  register_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  login_time    DATETIME        DEFAULT NULL             COMMENT '最近登录时间',
  last_active_time DATETIME     DEFAULT NULL             COMMENT '最近心跳时间(在线榜网络状态判定)',
  ping_ms       SMALLINT UNSIGNED DEFAULT NULL           COMMENT '最近上报网络延迟(毫秒, NULL=未上报)',
  last_sign_time DATETIME       DEFAULT NULL             COMMENT '上次每日签到时间',
  last_cultivate_time DATETIME  DEFAULT NULL             COMMENT '上次修炼时间(冷却用)',
  meditation_start_time DATETIME DEFAULT NULL            COMMENT '打坐开始时间(NULL=未打坐)',
  meditation_end_time DATETIME  DEFAULT NULL             COMMENT '打坐结束时间(到期后惰性结算并清空)',
  access_token  VARCHAR(512)    DEFAULT NULL             COMMENT '登录令牌',
  PRIMARY KEY (id),
  UNIQUE KEY uk_dao_name (dao_name),
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
`

// 建表语句：境界表（id 即境界序号, 1=凡人 ... 83=圣人, 数值来自数据文件, 非自增）
const CREATE_REALMS_TABLE = `
CREATE TABLE IF NOT EXISTS realms (
  id                     INT UNSIGNED    NOT NULL              COMMENT '境界ID(序号, 越大越高)',
  realm                  VARCHAR(32)     NOT NULL              COMMENT '大境界',
  stage                  VARCHAR(16)     NOT NULL DEFAULT ''   COMMENT '阶段(初期/中期/后期/圆满)',
  name                   VARCHAR(48)     NOT NULL              COMMENT '完整境界名',
  next_realm             VARCHAR(48)     NOT NULL DEFAULT ''   COMMENT '下一境界名',
  requirement_type       VARCHAR(32)     NOT NULL DEFAULT ''   COMMENT '晋级要求类型',
  advance_exp            BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '晋级所需经验(即该境界圆满修为)',
  sign_in_min_percent    DECIMAL(4,2)    NOT NULL DEFAULT 1.00 COMMENT '每日签到奖励百分比区间下限(占圆满修为/道韵, 0.1~3)',
  sign_in_max_percent    DECIMAL(4,2)    NOT NULL DEFAULT 2.00 COMMENT '每日签到奖励百分比区间上限(占圆满修为/道韵, 0.1~3)',
  dao_yun_required       INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '晋级所需道韵',
  dao_law_required       INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '晋级所需道法领悟',
  tribulation_type       VARCHAR(32)     NOT NULL DEFAULT ''   COMMENT '雷劫类型',
  tribulation_death_rate DECIMAL(5,1)    NOT NULL DEFAULT 0.0  COMMENT '突破失败死亡率(%)',
  hp                     BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '气血',
  ling_qi                BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '灵气',
  attack                 BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '攻击',
  defense                BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '防御',
  spirit                 BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '神识',
  note                   VARCHAR(255)    NOT NULL DEFAULT ''   COMMENT '备注',
  PRIMARY KEY (id),
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='境界表';
`

// 建表语句：丹药表（一行一种丹药，id 来自数据文件 pills.json，如 pill_fanren_cultivation）
const CREATE_PILLS_TABLE = `
CREATE TABLE IF NOT EXISTS pills (
  id             VARCHAR(64)  NOT NULL              COMMENT '丹药ID(数据文件)',
  name           VARCHAR(64)  NOT NULL              COMMENT '丹药名',
  realm          VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '所属大境界',
  realm_rank     INT UNSIGNED NOT NULL DEFAULT 0    COMMENT '大境界序号',
  category       VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '类型标识(如 cultivation_gain)',
  category_name  VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '类型名称(如 修为丹)',
  effect_mode    VARCHAR(64)  NOT NULL DEFAULT ''   COMMENT '效果组合类型',
  default_target VARCHAR(16)  NOT NULL DEFAULT 'self' COMMENT '默认作用目标: self/enemy',
  note           VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '备注',
  PRIMARY KEY (id),
  KEY idx_realm_rank (realm_rank),
  KEY idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹药表';
`

// 建表语句：丹药品质表（每种丹药 凡/灵/道 三档，效果列表存 JSON）
const CREATE_PILL_GRADES_TABLE = `
CREATE TABLE IF NOT EXISTS pill_grades (
  pill_id    VARCHAR(64)  NOT NULL              COMMENT '丹药ID(pills.id)',
  grade      VARCHAR(8)   NOT NULL              COMMENT '品质: fan/ling/dao',
  grade_name VARCHAR(8)   NOT NULL DEFAULT ''   COMMENT '品质名: 凡/灵/道',
  item_name  VARCHAR(64)  NOT NULL DEFAULT ''   COMMENT '成品名(如 凡品凡人修为丹)',
  effects    JSON         NOT NULL              COMMENT '效果列表(target/type/value/duration/hours/polarity)',
  summary    VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '效果摘要',
  PRIMARY KEY (pill_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹药品质表';
`

// 建表语句：玩家丹药背包表（同一玩家同种丹药同品质合并为一行计数量）
const CREATE_USER_PILLS_TABLE = `
CREATE TABLE IF NOT EXISTS user_pills (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  user_id       BIGINT UNSIGNED NOT NULL              COMMENT '玩家ID(users.id)',
  pill_id       VARCHAR(64)     NOT NULL              COMMENT '丹药ID(pills.id)',
  grade         VARCHAR(8)      NOT NULL              COMMENT '品质: fan/ling/dao',
  quantity      INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '持有数量',
  obtained_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '首次获得时间',
  updated_time  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近变动时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_pill_grade (user_id, pill_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家丹药背包表';
`

// 建表语句：功法表（主功法+辅功法/心法共用，type 区分；id 来自数据文件 techniques.json）
// 实际加成 = base_effects × level_multipliers[层-1]；层阈值 = threshold_base × threshold_ratio^(层-1)
const CREATE_TECHNIQUES_TABLE = `
CREATE TABLE IF NOT EXISTS techniques (
  id                VARCHAR(64)  NOT NULL              COMMENT '功法ID(数据文件)',
  name              VARCHAR(64)  NOT NULL              COMMENT '功法名',
  type              VARCHAR(8)   NOT NULL              COMMENT '类型: main=主功法, heart=辅功法(心法)',
  type_name         VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '类型名称',
  tier              VARCHAR(16)  NOT NULL              COMMENT '品阶键(阶_品, 如 huang_low)',
  tier_name         VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '品阶名(如 黄阶下品)',
  category          VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '流派标识(如 sword)',
  category_name     VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '流派名称(如 剑修)',
  realm_min         INT UNSIGNED NOT NULL DEFAULT 1    COMMENT '适用境界下限(realms.id)',
  realm_max         INT UNSIGNED NOT NULL DEFAULT 83   COMMENT '适用境界上限(realms.id)',
  max_level         TINYINT UNSIGNED NOT NULL DEFAULT 4 COMMENT '满层数',
  level_multipliers JSON         NOT NULL              COMMENT '各层倍率数组(长度=满层数)',
  base_progress     INT UNSIGNED NOT NULL DEFAULT 10   COMMENT '每次结算熟练度基数',
  threshold_base    INT UNSIGNED NOT NULL DEFAULT 100  COMMENT '层阈值基数',
  threshold_ratio   DECIMAL(4,2) NOT NULL DEFAULT 2    COMMENT '层阈值公比',
  base_effects      JSON         NOT NULL              COMMENT '基础五维加成(target/type/value/polarity)',
  summary           VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '效果摘要',
  intro             VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '简介',
  PRIMARY KEY (id),
  KEY idx_type_tier (type, tier),
  KEY idx_realm_min (realm_min)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='功法表';
`

// 建表语句：法宝表（id 来自数据文件 artifacts.json）
// 实际加成 = base_effects(正面) × refine_multipliers[层-1]，负面词条恒定；炼化层阈值 = threshold_base × threshold_ratio^(层-1)
const CREATE_ARTIFACTS_TABLE = `
CREATE TABLE IF NOT EXISTS artifacts (
  id                 VARCHAR(64)  NOT NULL              COMMENT '法宝ID(数据文件)',
  name               VARCHAR(64)  NOT NULL              COMMENT '法宝名',
  type               VARCHAR(8)   NOT NULL              COMMENT '类型: natal/offense/defense/support',
  type_name          VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '类型名称',
  tier               VARCHAR(16)  NOT NULL              COMMENT '品阶键(faqi/lingqi/baoqi/daoqi/xianqi)',
  tier_name          VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '品阶名(如 宝器)',
  category           VARCHAR(16)  NOT NULL DEFAULT ''   COMMENT '分类/定位(如 攻击槽)',
  realm_req          VARCHAR(32)  NOT NULL DEFAULT ''   COMMENT '装备大境界要求(空=无要求)',
  realm_req_rank     INT UNSIGNED NOT NULL DEFAULT 1    COMMENT '该大境界最小realms.id(装备校验)',
  refine_max         TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '满炼化层数',
  refine_multipliers JSON         NOT NULL              COMMENT '各炼化层倍率数组(长度=满层数)',
  refine_base        INT UNSIGNED NOT NULL DEFAULT 10   COMMENT '温养每小时炼化基数',
  threshold_base     INT UNSIGNED NOT NULL DEFAULT 100  COMMENT '炼化层阈值基数',
  threshold_ratio    DECIMAL(4,2) NOT NULL DEFAULT 2    COMMENT '炼化层阈值公比',
  base_effects       JSON         NOT NULL              COMMENT '基础五维加成(target/type/value/polarity, 可含负面)',
  summary            VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '效果摘要',
  intro              VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '简介',
  PRIMARY KEY (id),
  KEY idx_type_tier (type, tier),
  KEY idx_realm_req_rank (realm_req_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='法宝表';
`

// 建表语句：邮箱验证码表（注册/重置密码共用；一次一码、10 分钟有效、验证即作废）
const CREATE_EMAIL_CODES_TABLE = `
CREATE TABLE IF NOT EXISTS email_codes (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  email        VARCHAR(128)    NOT NULL              COMMENT '目标邮箱',
  code         VARCHAR(8)      NOT NULL              COMMENT '验证码(6位数字)',
  purpose      VARCHAR(16)     NOT NULL              COMMENT '用途: register=注册, reset=重置密码',
  expires_at   DATETIME        NOT NULL              COMMENT '过期时间(签发+10分钟)',
  used         TINYINT         NOT NULL DEFAULT 0    COMMENT '是否已使用: 0=未用, 1=已用',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '签发时间',
  PRIMARY KEY (id),
  KEY idx_email_purpose (email, purpose, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码表';
`

// 建表语句：宗门表（成员关系记在 users.sect_id 上，宗门人数由其聚合得出，无独立成员表）
const CREATE_SECTS_TABLE = `
CREATE TABLE IF NOT EXISTS sects (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '宗门ID',
  name           VARCHAR(32)     NOT NULL              COMMENT '宗门名称',
  avatar         VARCHAR(255)    DEFAULT NULL          COMMENT '宗门头像(外链URL, NULL=名称首字占位)',
  background     VARCHAR(255)    DEFAULT NULL          COMMENT '宗门背景图(外链URL, NULL=默认洞府图)',
  intro          VARCHAR(500)    NOT NULL DEFAULT ''   COMMENT '宗门简介',
  realm_req      VARCHAR(32)     NOT NULL DEFAULT ''   COMMENT '加入所需大境界(空=无要求)',
  realm_req_rank INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '境界要求序号(该大境界最小realms.id, 0=无要求)',
  leader_id      BIGINT UNSIGNED NOT NULL              COMMENT '宗主(users.id)',
  activity       INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '活跃度(机制未接入, 暂由后台调整)',
  created_time   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_name (name),
  KEY idx_leader (leader_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宗门表';
`

// 建表语句：宗门成员表（职位体系）——归属仍以 users.sect_id 为准（人数聚合/连表不变），
// 本表记成员职位，两处须同事务写。position 取值见 utils/sectPositions.js；peak_id 为山峰系统预留。
const CREATE_SECT_MEMBERS_TABLE = `
CREATE TABLE IF NOT EXISTS sect_members (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '成员记录ID',
  sect_id     BIGINT UNSIGNED NOT NULL              COMMENT '宗门(sects.id)',
  user_id     BIGINT UNSIGNED NOT NULL              COMMENT '成员(users.id), 一人一宗一职',
  position    VARCHAR(32)     NOT NULL DEFAULT 'outer_disciple' COMMENT '职位key(utils/sectPositions.js)',
  peak_id     BIGINT UNSIGNED DEFAULT NULL          COMMENT '所属山峰(山峰系统未实装, 预留)',
  joined_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入宗时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user (user_id),
  KEY idx_sect (sect_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宗门成员表(职位体系)';
`

// 建表语句：修行日志表（记录玩家每次操作：注册/登录/签到/修炼等，前台首页「修行日志」展示）
const CREATE_PLAYER_LOGS_TABLE = `
CREATE TABLE IF NOT EXISTS player_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  user_id      BIGINT UNSIGNED NOT NULL              COMMENT '玩家ID(users.id)',
  type         VARCHAR(24)     NOT NULL DEFAULT ''   COMMENT '操作类型: register/login/logout/sign_in/cultivate...',
  content      VARCHAR(255)    NOT NULL              COMMENT '日志内容(叙事文本)',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  PRIMARY KEY (id),
  KEY idx_user_time (user_id, created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修行日志表';
`

// 建表语句：玩家每日修炼统计表（前台首页「今日修炼」面板用；按天一行，UPSERT 累计）
const CREATE_USER_DAILY_STATS_TABLE = `
CREATE TABLE IF NOT EXISTS user_daily_stats (
  user_id            BIGINT UNSIGNED NOT NULL              COMMENT '玩家ID(users.id)',
  stat_date          DATE            NOT NULL              COMMENT '统计日期(按数据库时区归日)',
  cultivate_count    INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '当日修炼次数',
  meditation_seconds INT UNSIGNED    NOT NULL DEFAULT 0    COMMENT '当日打坐时长(秒, 按结算日入账)',
  cultivation_gained BIGINT UNSIGNED NOT NULL DEFAULT 0    COMMENT '当日获得修为(修炼+打坐+签到)',
  PRIMARY KEY (user_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='玩家每日修炼统计表';
`

// 建表语句：世界频道消息表（前台首页「世界频道」聊天区块；全服一个频道，轮询增量拉取）
const CREATE_WORLD_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS world_messages (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID(即时间序,增量拉取游标)',
  user_id      BIGINT UNSIGNED NOT NULL              COMMENT '发送者(users.id)',
  content      VARCHAR(255)    NOT NULL              COMMENT '消息内容(纯文本,前端转义展示)',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (id),
  KEY idx_user (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='世界频道消息表';
`

// 建表语句：修仙公告表（后台发布，前台「通知」弹窗「修仙公告」页展示；status 控制上/下架，pinned 置顶）
const CREATE_ANNOUNCEMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS announcements (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '公告ID',
  title        VARCHAR(64)     NOT NULL              COMMENT '公告标题',
  content      VARCHAR(2000)   NOT NULL DEFAULT ''   COMMENT '公告正文(纯文本)',
  pinned       TINYINT         NOT NULL DEFAULT 0    COMMENT '是否置顶: 0=否, 1=是',
  status       TINYINT         NOT NULL DEFAULT 1    COMMENT '状态: 1=已发布, 0=下架',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  updated_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近更新时间',
  PRIMARY KEY (id),
  KEY idx_status_pinned (status, pinned, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='修仙公告表';
`

// 建表语句：好友关系表（结交/请求；一行代表一对用户的关系，方向由 requester/addressee 记录）
// status: 0=待通过(请求已发出), 1=已结交。判断二人是否好友需查两个方向。
const CREATE_FRIENDSHIPS_TABLE = `
CREATE TABLE IF NOT EXISTS friendships (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关系ID',
  requester_id BIGINT UNSIGNED NOT NULL              COMMENT '发起方(users.id)',
  addressee_id BIGINT UNSIGNED NOT NULL              COMMENT '接收方(users.id)',
  status       TINYINT         NOT NULL DEFAULT 0    COMMENT '状态: 0=待通过, 1=已结交',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发起时间',
  updated_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最近变动时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_pair (requester_id, addressee_id),
  UNIQUE KEY uk_pair_nodir ((LEAST(requester_id, addressee_id)), (GREATEST(requester_id, addressee_id))),
  KEY idx_addressee (addressee_id, status),
  KEY idx_requester (requester_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='好友关系表';
`

// 建表语句：拉黑表（单向：user_id 拉黑了 blocked_id）
const CREATE_USER_BLOCKS_TABLE = `
CREATE TABLE IF NOT EXISTS user_blocks (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  user_id      BIGINT UNSIGNED NOT NULL              COMMENT '拉黑者(users.id)',
  blocked_id   BIGINT UNSIGNED NOT NULL              COMMENT '被拉黑者(users.id)',
  created_time DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '拉黑时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_block (user_id, blocked_id),
  KEY idx_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='拉黑表';
`

// 建表语句：私信表（点对点，一行一条消息；会话由收发双方 id 聚合，无独立会话表）
const CREATE_PRIVATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS private_messages (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID(即时间序)',
  sender_id     BIGINT UNSIGNED NOT NULL              COMMENT '发送者(users.id)',
  receiver_id   BIGINT UNSIGNED NOT NULL              COMMENT '接收者(users.id)',
  content       VARCHAR(255)    NOT NULL              COMMENT '消息内容(纯文本)',
  receiver_read TINYINT         NOT NULL DEFAULT 0    COMMENT '接收方是否已读: 0=未读, 1=已读',
  created_time  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (id),
  KEY idx_receiver (receiver_id, sender_id, id),
  KEY idx_sender (sender_id, receiver_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='私信表';
`

// 建表语句：系统配置表（键值对，后台「系统配置列表」用；如签到功能开关等）
const CREATE_SYSTEM_CONFIGS_TABLE = `
CREATE TABLE IF NOT EXISTS system_configs (
  config_key   VARCHAR(64)  NOT NULL              COMMENT '配置键',
  config_value VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '配置值',
  label        VARCHAR(64)  NOT NULL DEFAULT ''   COMMENT '中文名称',
  description  VARCHAR(255) NOT NULL DEFAULT ''   COMMENT '说明',
  value_type   VARCHAR(16)  NOT NULL DEFAULT 'text' COMMENT '值类型: bool/text/number',
  updated_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';
`

// 内置系统配置项（幂等：仅在键不存在时插入，不覆盖管理员已改的值）
const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: 'sign_in_enabled',
    value: '1',
    label: '每日签到',
    description: '开启后玩家进入首页满24小时可签到领取修为；关闭则不再弹出签到。',
    valueType: 'bool',
  },
  {
    key: 'cultivate_cooldown_seconds',
    value: '60',
    label: '修炼间隔(秒)',
    description: '每次修炼后的调息冷却时长，单位秒。单次修炼收益为当前境界圆满修为(advance_exp)的5%。',
    valueType: 'number',
  },
  {
    key: 'meditation_gain_percent_per_hour',
    value: '30',
    label: '打坐每小时收益(%)',
    description: '打坐每小时获得的修为占当前境界圆满修为(advance_exp)的百分比；期满一次性结算并封顶到圆满。',
    valueType: 'number',
  },
  {
    key: 'world_chat_cooldown_seconds',
    value: '5',
    label: '世界频道发言间隔(秒)',
    description: '同一玩家两次发言之间的最小间隔秒数，防刷屏；0 为不限制。',
    valueType: 'number',
  },
  {
    key: 'register_email_code_enabled',
    value: '1',
    label: '注册邮箱验证码',
    description: '开启后注册必须先获取并填写邮箱验证码；未配置 SMTP 的环境可临时关闭。重置密码不受此开关影响。',
    valueType: 'bool',
  },
]

async function seedSystemConfigs() {
  for (const c of DEFAULT_SYSTEM_CONFIGS) {
    await pool.query(
      `INSERT IGNORE INTO system_configs (config_key, config_value, label, description, value_type)
       VALUES (?, ?, ?, ?, ?)`,
      [c.key, c.value, c.label, c.description, c.valueType]
    )
  }
}

// 首次启动从数据文件导入境界（幂等：表非空则跳过）
async function seedRealms() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM realms')
  if (rows[0].c > 0) return

  const raw = await readFile(join(__dirname, '../data/realms.json'), 'utf8')
  const data = JSON.parse(raw)
  const values = data.map((r) => [
    r.id,
    r.realm,
    r.stage || '',
    r.name,
    r.next_realm || '',
    r.requirement_type || '',
    r.advance_exp || 0,
    r.dao_yun_required || 0,
    r.dao_law_required || 0,
    r.tribulation_type || '',
    r.tribulation_death_rate_percent || 0,
    r.hp || 0,
    r.ling_qi || 0,
    r.attack || 0,
    r.defense || 0,
    r.spirit || 0,
    r.note || '',
  ])
  // 批量插入需用 query（execute 不支持嵌套数组批量插入）
  await pool.query(
    `INSERT INTO realms
      (id, realm, stage, name, next_realm, requirement_type, advance_exp,
       dao_yun_required, dao_law_required, tribulation_type, tribulation_death_rate,
       hp, ling_qi, attack, defense, spirit, note)
     VALUES ?`,
    [values]
  )
  console.log(`已导入境界数据 ${data.length} 条`)
}

// 首次启动从数据文件导入丹药（幂等：表非空则跳过；数据文件顶层含 version/rules 等元信息，取 .pills）
async function seedPills() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM pills')
  if (rows[0].c > 0) return

  const raw = await readFile(join(__dirname, '../data/pills.json'), 'utf8')
  const pills = JSON.parse(raw).pills
  const pillValues = pills.map((p) => [
    p.id,
    p.name,
    p.realm || '',
    p.realmRank || 0,
    p.category || '',
    p.categoryName || '',
    p.effectMode || '',
    p.defaultTarget || 'self',
    p.notes || '',
  ])
  const gradeValues = pills.flatMap((p) =>
    (p.grades || []).map((g) => [
      p.id,
      g.grade,
      g.gradeName || '',
      g.itemName || '',
      JSON.stringify(g.effects || []),
      g.summary || '',
    ])
  )
  await pool.query(
    `INSERT INTO pills
      (id, name, realm, realm_rank, category, category_name, effect_mode, default_target, note)
     VALUES ?`,
    [pillValues]
  )
  await pool.query(
    `INSERT INTO pill_grades (pill_id, grade, grade_name, item_name, effects, summary) VALUES ?`,
    [gradeValues]
  )
  console.log(`已导入丹药数据 ${pills.length} 种（品质物品 ${gradeValues.length} 件）`)
}

// 首次启动从数据文件导入功法（幂等：表非空则跳过；数据文件顶层含元信息，取 .techniques）
async function seedTechniques() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM techniques')
  if (rows[0].c > 0) return

  const raw = await readFile(join(__dirname, '../data/techniques.json'), 'utf8')
  const list = JSON.parse(raw).techniques
  const values = list.map((t) => [
    t.id,
    t.name,
    t.type,
    t.typeName || '',
    t.tier,
    t.tierName || '',
    t.category || '',
    t.categoryName || '',
    t.realmMin || 1,
    t.realmMax || 83,
    t.maxLevel || 4,
    JSON.stringify(t.levelMultipliers || [1]),
    t.baseProgress || 10,
    t.thresholdBase || 100,
    t.thresholdRatio || 2,
    JSON.stringify(t.baseEffects || []),
    t.summary || '',
    t.intro || '',
  ])
  await pool.query(
    `INSERT INTO techniques
      (id, name, type, type_name, tier, tier_name, category, category_name,
       realm_min, realm_max, max_level, level_multipliers, base_progress,
       threshold_base, threshold_ratio, base_effects, summary, intro)
     VALUES ?`,
    [values]
  )
  console.log(`已导入功法数据 ${list.length} 部`)
}

// 首次启动从数据文件导入法宝（幂等：表非空则跳过；数据文件顶层含元信息，取 .artifacts）
async function seedArtifacts() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM artifacts')
  if (rows[0].c > 0) return

  const raw = await readFile(join(__dirname, '../data/artifacts.json'), 'utf8')
  const list = JSON.parse(raw).artifacts
  const values = list.map((a) => [
    a.id,
    a.name,
    a.type,
    a.typeName || '',
    a.tier,
    a.tierName || '',
    a.category || '',
    a.realmReq || '',
    a.realmReqRank || 1,
    a.refineMax || 3,
    JSON.stringify(a.refineMultipliers || [1]),
    a.refineBase || 10,
    a.thresholdBase || 100,
    a.thresholdRatio || 2,
    JSON.stringify(a.baseEffects || []),
    a.summary || '',
    a.intro || '',
  ])
  await pool.query(
    `INSERT INTO artifacts
      (id, name, type, type_name, tier, tier_name, category, realm_req, realm_req_rank,
       refine_max, refine_multipliers, refine_base, threshold_base, threshold_ratio,
       base_effects, summary, intro)
     VALUES ?`,
    [values]
  )
  console.log(`已导入法宝数据 ${list.length} 件`)
}

// 幂等补列：老库已有 users 表但缺某列时补上（MySQL 不支持 ADD COLUMN IF NOT EXISTS）
async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.name, table, column]
  )
  if (rows[0].c === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
  }
}

// 幂等补无向唯一键：老 friendships 表只有「同向」唯一键 uk_pair，双方同时发起结交时
// 「查询后插入」非原子，可能落两条反向行。补一条 LEAST/GREATEST 函数唯一键在 DB 层兜底；
// 加键前先清既有反向重复——保留优先级 status 高者（已结交 > 待通过，防把已结交降级回待应允），
// 同 status 保留 id 较小的先到者。需 MySQL >= 8.0.13（函数索引）。
async function ensureFriendshipPairIndex() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'friendships' AND INDEX_NAME = 'uk_pair_nodir'`,
    [config.db.name]
  )
  if (rows[0].c > 0) return
  await pool.query(
    `DELETE f2 FROM friendships f1
     JOIN friendships f2
       ON f1.requester_id = f2.addressee_id AND f1.addressee_id = f2.requester_id
      AND (f1.status > f2.status OR (f1.status = f2.status AND f1.id < f2.id))`
  )
  await pool.query(
    `ALTER TABLE friendships
     ADD UNIQUE KEY uk_pair_nodir ((LEAST(requester_id, addressee_id)), (GREATEST(requester_id, addressee_id)))`
  )
  console.log('已为 friendships 补无向唯一键 uk_pair_nodir（并清理反向重复关系）')
}

// 幂等删列：列存在时删除（用于淘汰旧字段）
async function dropColumn(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.name, table, column]
  )
  if (rows[0].c > 0) {
    await pool.query(`ALTER TABLE ${table} DROP COLUMN ${column}`)
  }
}

// 首次启动生成默认管理员（作为 users 表中 role=1 的一行，幂等：已存在则跳过）
async function seedDefaultAdmin() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE role = 1')
  if (rows[0].c > 0) return

  // 生产环境未显式配置管理员口令时，不自动播种默认弱口令管理员
  if (!allowSeedDefaultAdmin) {
    console.warn(
      '⚠ 生产环境未配置 ADMIN_PASSWORD，已跳过默认管理员播种；请手动创建管理员账号。'
    )
    return
  }

  const { defaultUsername, defaultPassword, defaultEmail } = config.admin
  const hashed = await hashPassword(defaultPassword)
  await pool.query(
    'INSERT INTO users (dao_name, email, password, role, status) VALUES (?, ?, ?, 1, 1)',
    [defaultUsername, defaultEmail, hashed]
  )
  console.log(
    `已生成默认管理员账号 -> 账号(道号): ${defaultUsername}  密码: ${defaultPassword}（请尽快修改）`
  )
}

// 启动时：连接 MySQL -> 创建数据库(库不存在则建) -> 创建连接池 -> 建表/迁移 -> 播种管理员
export async function initDatabase() {
  const { host, port, user, password, name } = config.db

  // 先用不带库名的连接创建数据库
  const bootstrap = await mysql.createConnection({ host, port, user, password })
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await bootstrap.end()

  // 创建指向该库的连接池
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: name,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  })

  // 建表
  await pool.query(CREATE_USERS_TABLE)
  await pool.query(CREATE_REALMS_TABLE)
  await pool.query(CREATE_PILLS_TABLE)
  await pool.query(CREATE_PILL_GRADES_TABLE)
  await pool.query(CREATE_USER_PILLS_TABLE)
  await pool.query(CREATE_TECHNIQUES_TABLE)
  await pool.query(CREATE_ARTIFACTS_TABLE)
  await pool.query(CREATE_EMAIL_CODES_TABLE)
  await pool.query(CREATE_SECTS_TABLE)
  await pool.query(CREATE_SECT_MEMBERS_TABLE)
  await pool.query(CREATE_PLAYER_LOGS_TABLE)
  await pool.query(CREATE_USER_DAILY_STATS_TABLE)
  await pool.query(CREATE_WORLD_MESSAGES_TABLE)
  await pool.query(CREATE_ANNOUNCEMENTS_TABLE)
  await pool.query(CREATE_FRIENDSHIPS_TABLE)
  await pool.query(CREATE_USER_BLOCKS_TABLE)
  await pool.query(CREATE_PRIVATE_MESSAGES_TABLE)
  await pool.query(CREATE_SYSTEM_CONFIGS_TABLE)

  // 迁移（老库补列）
  await ensureColumn(
    'users',
    'role',
    "role TINYINT NOT NULL DEFAULT 0 COMMENT '角色: 0=玩家, 1=管理员' AFTER password"
  )
  await ensureColumn(
    'users',
    'realm_id',
    "realm_id INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '当前境界(realms.id), 1=凡人' AFTER status"
  )
  await ensureColumn(
    'users',
    'is_online',
    "is_online TINYINT NOT NULL DEFAULT 0 COMMENT '是否在线: 0=离线, 1=在线' AFTER realm_id"
  )
  await ensureColumn(
    'users',
    'death_count',
    "death_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '死亡次数(突破失败等)' AFTER is_online"
  )
  await ensureColumn(
    'users',
    'ling_shi',
    "ling_shi BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '灵石' AFTER death_count"
  )
  await ensureColumn(
    'users',
    'cultivation',
    "cultivation BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '修为' AFTER ling_shi"
  )
  await ensureColumn(
    'users',
    'dao_yun',
    "dao_yun BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '道韵' AFTER cultivation"
  )
  await ensureColumn(
    'users',
    'dao_law',
    "dao_law BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '道法领悟' AFTER dao_yun"
  )
  await ensureColumn(
    'users',
    'comprehension',
    "comprehension TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '悟性(%), 上限100, 注册时随机生成' AFTER dao_law"
  )
  await ensureColumn(
    'users',
    'avatar',
    "avatar VARCHAR(255) DEFAULT NULL COMMENT '头像访问路径(/api/uploads/avatars/..., NULL=默认头像)' AFTER comprehension"
  )
  await ensureColumn(
    'users',
    'gender',
    "gender TINYINT NOT NULL DEFAULT 1 COMMENT '性别: 1=男, 2=女' AFTER avatar"
  )
  await ensureColumn(
    'users',
    'sect_id',
    "sect_id BIGINT UNSIGNED DEFAULT NULL COMMENT '所属宗门(sects.id, NULL=散修)' AFTER gender"
  )
  await ensureColumn(
    'users',
    'last_active_time',
    "last_active_time DATETIME DEFAULT NULL COMMENT '最近心跳时间(在线榜网络状态判定)' AFTER login_time"
  )
  await ensureColumn(
    'users',
    'ping_ms',
    "ping_ms SMALLINT UNSIGNED DEFAULT NULL COMMENT '最近上报网络延迟(毫秒, NULL=未上报)' AFTER last_active_time"
  )
  await ensureColumn(
    'users',
    'last_sign_time',
    "last_sign_time DATETIME DEFAULT NULL COMMENT '上次每日签到时间' AFTER login_time"
  )
  await ensureColumn(
    'users',
    'last_cultivate_time',
    "last_cultivate_time DATETIME DEFAULT NULL COMMENT '上次修炼时间(冷却用)' AFTER last_sign_time"
  )
  await ensureColumn(
    'users',
    'meditation_start_time',
    "meditation_start_time DATETIME DEFAULT NULL COMMENT '打坐开始时间(NULL=未打坐)' AFTER last_cultivate_time"
  )
  await ensureColumn(
    'users',
    'meditation_end_time',
    "meditation_end_time DATETIME DEFAULT NULL COMMENT '打坐结束时间(到期后惰性结算并清空)' AFTER meditation_start_time"
  )
  await ensureColumn(
    'realms',
    'sign_in_min_percent',
    "sign_in_min_percent DECIMAL(4,2) NOT NULL DEFAULT 1.00 COMMENT '每日签到奖励百分比区间下限(占圆满修为/道韵, 0.1~3)' AFTER advance_exp"
  )
  await ensureColumn(
    'realms',
    'sign_in_max_percent',
    "sign_in_max_percent DECIMAL(4,2) NOT NULL DEFAULT 2.00 COMMENT '每日签到奖励百分比区间上限(占圆满修为/道韵, 0.1~3)' AFTER sign_in_min_percent"
  )
  // 淘汰旧的单一百分比字段（早期版本）
  await dropColumn('realms', 'sign_in_percent')
  // 淘汰 users.email_code 预留列：验证码改用独立 email_codes 表（注册时用户行尚不存在）
  await dropColumn('users', 'email_code')
  // 清理旧设计：管理员已并入 users 表
  await pool.query('DROP TABLE IF EXISTS admins')
  // 好友关系表补无向唯一键（老库迁移，防双方同时发起结交落两条反向行）
  await ensureFriendshipPairIndex()
  // 宗门成员表存量回填（幂等）：职位体系上线前已入宗的用户补成员行——宗主记宗主，其余记外门弟子
  await pool.query(
    `INSERT INTO sect_members (sect_id, user_id, position)
     SELECT u.sect_id, u.id, IF(s.leader_id = u.id, 'sect_master', 'outer_disciple')
     FROM users u
     JOIN sects s ON s.id = u.sect_id
     LEFT JOIN sect_members m ON m.user_id = u.id
     WHERE m.id IS NULL`
  )
  // 重启后在线态清零，避免残留（真实在线由登录/登出维护）
  await pool.query('UPDATE users SET is_online = 0')

  // 播种境界数据 + 丹药数据 + 功法/法宝数据 + 默认管理员 + 系统配置
  await seedRealms()
  await seedPills()
  await seedTechniques()
  await seedArtifacts()
  await seedDefaultAdmin()
  await seedSystemConfigs()

  console.log(`数据库已就绪: ${name} (${host}:${port})`)
  return pool
}

// 获取连接池（initDatabase 之后可用）
export function getPool() {
  if (!pool) throw new Error('数据库尚未初始化，请先调用 initDatabase()')
  return pool
}

// 便捷查询封装
export async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params)
  return rows
}
