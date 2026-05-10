# WeClaws 数据表接口与字段说明

## 1. 文档定位

本文档说明当前 WeClaws 数据层的：

- 表接口入口
- 表用途
- 字段含义
- 主要索引与关系

当前事实来源以代码为准：

- `packages/db/src/schema/*.ts`
- `packages/db/src/index.ts`
- `packages/db/src/repositories/*.ts`

## 2. 访问入口

### 2.1 对外 schema 导出

当前 `packages/db` 从根出口导出的 Drizzle 表接口有：

- `users`
- `accounts`
- `sessions`
- `verifications`
- `workspaces`
- `botInstances`
- `botEvents`
- `registrationInvites`
- `userLlmProfiles`
- `userSandboxRuntimePools`

对应文件见：

- `packages/db/src/index.ts`
- `packages/db/src/schema/*.ts`

### 2.2 主要 repository 导出

当前对外 repository 接口有：

- `UserRepository`
- `WorkspaceRepository`
- `BotInstanceRepository`
- `BotEventRepository`
- `RegistrationInviteRepository`
- `RegistrationBootstrapClaimRepository`
- `UserLlmProfileRepository`
- `UserSandboxRuntimePoolRepository`

说明：

- `registration_bootstrap_claims` 这张表当前由 `RegistrationBootstrapClaimRepository` 使用
- 它的 schema 文件位于 `packages/db/src/schema/registration-bootstrap-claims.ts`
- 但目前没有从 `packages/db/src/index.ts` 直接导出表对象

## 3. 字段类型约定

为避免看文档时把 TypeScript 类型和 SQLite 落库类型混在一起，这里先约定：

- `text`：SQLite `TEXT`，在代码里对应字符串
- `integer(..., { mode: 'timestamp_ms' })`：SQLite `INTEGER`，按毫秒时间戳存；Drizzle 读写时按 `Date` 处理
- `integer(..., { mode: 'boolean' })`：SQLite `INTEGER`，按 `0/1` 存；Drizzle 读写时按布尔值处理
- `nullable` 字段：允许为空；业务上通常表示“尚未产生”或“尚未消费”

补充：

- `bot_events` 的增量游标当前依赖 SQLite 隐藏列 `rowid`
- `rowid` 不是显式 schema 字段，但 `BotEventRepository` 会把它作为 `rowId` 暴露给上层轮询和 SSE

## 4. 关系总览

```text
users
├── accounts
├── sessions
├── user_llm_profiles
│   └── bot_instances (llm_config_id -> user_llm_profiles.id)
├── user_sandbox_runtime_pools
├── workspaces
│   └── bot_instances
│       └── bot_events
├── registration_invites (created_by_user_id)
└── registration_invites (used_by_user_id)

registration_bootstrap_claims
verifications
```

说明：

- `users` 是认证和业务 owner 的根表
- `workspaces` 和 `bot_instances` 都归属于用户
- `user_llm_profiles` 保存用户级、可命名的完整 LLM profiles，供 `web` 与 `supervisor` 共同绑定和解析运行时配置
- `user_sandbox_runtime_pools` 保存用户级 sandbox-runtime pool 配置，供 supervisor 渲染 private config 文件
- `bot_events` 是 bot 实例的只追加时间线
- `registration_bootstrap_claims` 与 `verifications` 当前不依赖外键到业务表

## 5. 表说明

### 5.1 `users`

- 表接口：`users`
- 文件：`packages/db/src/schema/users.ts`
- 主要用途：用户基础信息，供认证和业务 owner 关系复用
- 主要访问接口：`UserRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 用户主键 |
| `email` | 否 | `text` | 用户邮箱，唯一 |
| `name` | 否 | `text` | 展示名称 |
| `email_verified` | 否 | `integer(boolean)` | 邮箱是否已验证 |
| `image` | 是 | `text` | 用户头像 URL |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`users_email_idx(email)`

### 5.2 `accounts`

- 表接口：`accounts`
- 文件：`packages/db/src/schema/accounts.ts`
- 主要用途：Better Auth 账号映射，一名用户可绑定多个 provider 账号
- 主要访问方：认证链路

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 账号记录主键 |
| `account_id` | 否 | `text` | provider 侧账号 id |
| `provider_id` | 否 | `text` | provider 名称 |
| `user_id` | 否 | `text` | 归属用户，外键到 `users.id` |
| `access_token` | 是 | `text` | access token |
| `refresh_token` | 是 | `text` | refresh token |
| `id_token` | 是 | `text` | id token |
| `access_token_expires_at` | 是 | `timestamp_ms` | access token 过期时间 |
| `refresh_token_expires_at` | 是 | `timestamp_ms` | refresh token 过期时间 |
| `scope` | 是 | `text` | 授权 scope |
| `password` | 是 | `text` | 本地密码或凭据字段 |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`accounts_provider_account_idx(provider_id, account_id)`
- 普通索引：`accounts_user_id_idx(user_id)`
- 外键：`user_id -> users.id`，`onDelete: cascade`

### 5.3 `sessions`

- 表接口：`sessions`
- 文件：`packages/db/src/schema/sessions.ts`
- 主要用途：Better Auth 会话表
- 主要访问方：认证链路

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 会话主键 |
| `expires_at` | 否 | `timestamp_ms` | 会话过期时间 |
| `token` | 否 | `text` | 会话 token，唯一 |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |
| `ip_address` | 是 | `text` | 登录来源 IP |
| `user_agent` | 是 | `text` | 登录来源 UA |
| `user_id` | 否 | `text` | 归属用户，外键到 `users.id` |

索引与约束：

- 主键：`id`
- 唯一索引：`sessions_token_idx(token)`
- 普通索引：`sessions_user_id_idx(user_id)`
- 外键：`user_id -> users.id`，`onDelete: cascade`

### 5.4 `verifications`

- 表接口：`verifications`
- 文件：`packages/db/src/schema/verifications.ts`
- 主要用途：认证校验记录，例如验证码、确认链接等
- 主要访问方：认证链路

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 校验记录主键 |
| `identifier` | 否 | `text` | 被校验主体，例如邮箱 |
| `value` | 否 | `text` | 校验值 |
| `expires_at` | 否 | `timestamp_ms` | 过期时间 |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 普通索引：`verifications_identifier_idx(identifier)`

### 5.5 `workspaces`

- 表接口：`workspaces`
- 文件：`packages/db/src/schema/workspaces.ts`
- 主要用途：bot 对应的逻辑工作区；当前只保存逻辑关系，不保存宿主机路径
- 主要访问接口：`WorkspaceRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 工作区主键 |
| `owner_user_id` | 否 | `text` | 工作区 owner，外键到 `users.id` |
| `name` | 否 | `text` | 工作区名称 |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 外键：`owner_user_id -> users.id`，`onDelete: cascade`

### 5.6 `bot_instances`

- 表接口：`botInstances`
- 文件：`packages/db/src/schema/bot-instances.ts`
- 主要用途：bot 的目标状态、观测状态和最近一次运行态事实
- 主要访问接口：`BotInstanceRepository`

#### 核心状态字段

- `desired_state`
  - 允许值：`running`、`stopped`
  - 含义：控制面希望 supervisor 收敛到的目标状态
- `status`
  - 允许值：`provisioning`、`starting`、`waiting_for_qr`、`running`、`degraded`、`stopping`、`stopped`、`failed`
  - 含义：supervisor 根据 runtime 事件写回的当前观测态

#### 字段说明

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | bot 实例主键 |
| `owner_user_id` | 否 | `text` | bot owner，外键到 `users.id` |
| `workspace_id` | 否 | `text` | 关联工作区，外键到 `workspaces.id` |
| `name` | 否 | `text` | bot 名称 |
| `provider` | 否 | `text` | 默认模型 provider |
| `model` | 否 | `text` | 默认模型名 |
| `llm_config_id` | 是 | `text` | 当前绑定的 LLM profile id，外键到 `user_llm_profiles.id` |
| `desired_state` | 否 | `text(enum)` | 目标状态 |
| `status` | 否 | `text(enum)` | 当前观测状态 |
| `process_pid` | 是 | `integer` | 当前 FastAgent 子进程 pid |
| `process_started_at` | 是 | `timestamp_ms` | 当前 pid 的真实启动时间，用于避免 pid 复用误杀 |
| `heartbeat_at` | 是 | `timestamp_ms` | 最近一次 runtime 心跳/事件时间 |
| `restart_count` | 否 | `integer` | 连续重启计数 |
| `restart_backoff_until` | 是 | `timestamp_ms` | 下次允许重启的最早时间 |
| `restart_requested_at` | 是 | `timestamp_ms` | 控制面请求重启的时间标记 |
| `qr_reissue_requested_at` | 是 | `timestamp_ms` | 控制面请求重新扫码/重新出码的时间标记 |
| `last_qr_code_id` | 是 | `text` | 最近一次二维码 id |
| `last_qr_code_url` | 是 | `text` | 最近一次二维码图片 URL |
| `weixin_account_id` | 是 | `text` | 当前登录或恢复出的微信账号 id |
| `last_error_code` | 是 | `text` | 最近一次运行错误码 |
| `last_error_message` | 是 | `text` | 最近一次运行错误信息 |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 普通索引：`bot_instances_owner_user_idx(owner_user_id)`
- 普通索引：`bot_instances_desired_state_status_idx(desired_state, status)`
- 普通索引：`bot_instances_restart_backoff_idx(restart_backoff_until)`
- 外键：`owner_user_id -> users.id`，`onDelete: cascade`
- 外键：`workspace_id -> workspaces.id`，`onDelete: cascade`
- 外键：`llm_config_id -> user_llm_profiles.id`

补充：

- 当前数据库不再保存 FastAgent binary、workspace/data/log 目录等宿主机绝对路径
- 这些运行目录统一由 `INSTANCES_ROOT + botId` 在运行时派生
- `provider / model` 是 bot 最近一次将应用/已应用的 runtime snapshot；当前绑定关系单独由 `llm_config_id` 表示
- `qr_reissue_requested_at` 是 durable runtime intent；真正停机、清 FastAgent 登录态文件和重新出码由 supervisor 收敛，完成后会清空这个字段并顺带清掉最近二维码与 `weixin_account_id`

### 5.6.1 `bot_qr_shares`

- 表接口：`botQrShares`
- 文件：`packages/db/src/schema/bot-qr-shares.ts`
- 主要用途：保存 bot 当前唯一的二维码公开分享链接
- 主要访问接口：`BotQrShareRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 分享记录主键 |
| `bot_instance_id` | 否 | `text` | 所属 bot，外键到 `bot_instances.id` |
| `token` | 否 | `text` | owner 侧恢复公开链接用的原始 token |
| `token_hash` | 否 | `text` | public lookup 使用的 token hash |
| `revoked_at` | 是 | `timestamp_ms` | 关闭分享的时间；`null` 表示当前 active |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 最近更新时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`bot_qr_shares_bot_instance_id_idx(bot_instance_id)`
- 唯一索引：`bot_qr_shares_token_idx(token)`
- 唯一索引：`bot_qr_shares_token_hash_idx(token_hash)`
- 普通索引：`bot_qr_shares_revoked_at_idx(revoked_at)`
- 外键：`bot_instance_id -> bot_instances.id`，`onDelete: cascade`

补充：

- 当前每个 bot 只允许一条 share 记录；rotate link 继续通过 update 同一行完成
- `token` 和 `token_hash` 当前都会持久化：owner 侧需要直接恢复当前公开链接，public 侧只用 `token_hash` 查询

### 5.7 `bot_events`

- 表接口：`botEvents`
- 文件：`packages/db/src/schema/bot-events.ts`
- 主要用途：记录 bot 运行时间线；当前设计为只追加
- 主要访问接口：`BotEventRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 事件主键 |
| `bot_instance_id` | 否 | `text` | 所属 bot，外键到 `bot_instances.id` |
| `type` | 否 | `text` | 事件类型 |
| `message` | 否 | `text` | 事件摘要消息 |
| `payload_json` | 否 | `text` | 结构化事件 payload，JSON 字符串 |
| `created_at` | 否 | `timestamp_ms` | 事件写入时间 |

索引与约束：

- 主键：`id`
- 普通索引：`bot_events_bot_instance_created_at_idx(bot_instance_id, created_at)`
- 外键：`bot_instance_id -> bot_instances.id`，`onDelete: cascade`

补充：

- `BotEventRepository.append()` 会额外返回 `rowId`
- `rowId` 来自 SQLite 隐藏列 `rowid`，不是显式表字段
- 当前 SSE 和增量轮询都使用 `rowId` 作为 cursor，避免同毫秒多事件时按 `(created_at, id)` 排序漏数据

### 5.8 `registration_invites`

- 表接口：`registrationInvites`
- 文件：`packages/db/src/schema/registration-invites.ts`
- 主要用途：邀请码创建、预占、消费与审计
- 主要访问接口：`RegistrationInviteRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 邀请记录主键 |
| `code` | 否 | `text` | 邀请码，唯一 |
| `created_by_user_id` | 否 | `text` | 创建人，外键到 `users.id` |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `reservation_token` | 是 | `text` | 当前预占 token |
| `reserved_at` | 是 | `timestamp_ms` | 预占时间 |
| `reserved_by_email` | 是 | `text` | 预占人邮箱 |
| `used_by_user_id` | 是 | `text` | 实际消费用户，外键到 `users.id` |
| `used_at` | 是 | `timestamp_ms` | 实际消费时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`registration_invites_code_idx(code)`
- 唯一索引：`registration_invites_reservation_token_idx(reservation_token)`
- 普通索引：`registration_invites_created_at_idx(created_at desc, id desc)`
- 普通索引：`registration_invites_created_by_user_idx(created_by_user_id)`
- 普通索引：`registration_invites_reserved_at_idx(reserved_at)`
- 普通索引：`registration_invites_used_by_user_idx(used_by_user_id)`
- 外键：`created_by_user_id -> users.id`，`onDelete: cascade`
- 外键：`used_by_user_id -> users.id`，`onDelete: set null`

### 5.9 `registration_bootstrap_claims`

- 表接口：`registrationBootstrapClaims`
- 文件：`packages/db/src/schema/registration-bootstrap-claims.ts`
- 主要用途：首个管理员注册的抢占记录，避免并发自举
- 主要访问接口：`RegistrationBootstrapClaimRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | 抢占记录主键 |
| `claim_token` | 是 | `text` | 当前抢占 token |
| `claimed_by_email` | 是 | `text` | 抢占者邮箱 |
| `claimed_at` | 是 | `timestamp_ms` | 抢占时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`registration_bootstrap_claims_token_idx(claim_token)`
- 普通索引：`registration_bootstrap_claims_claimed_at_idx(claimed_at)`

### 5.10 `user_llm_profiles`

- 表接口：`userLlmProfiles`
- 文件：`packages/db/src/schema/user-llm-profiles.ts`
- 主要用途：保存用户级、可命名的完整 LLM profiles，供 bot 通过 `llm_config_id` 绑定
- 主要访问接口：`UserLlmProfileRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | profile 主键 |
| `user_id` | 否 | `text` | profile owner，外键到 `users.id` |
| `name` | 否 | `text` | profile 展示名；在同一 user 下唯一 |
| `provider` | 否 | `text` | 运行时 provider |
| `model` | 否 | `text` | 运行时 model |
| `api_key` | 否 | `text` | 运行时 API key |
| `base_url` | 是 | `text` | 可选运行时 base URL |
| `api_type` | 是 | `text` | 可选运行时 API type |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`user_llm_profiles_user_name_idx(user_id, name)`
- 外键：`user_id -> users.id`，`onDelete: cascade`

### 5.11 `user_sandbox_runtime_pools`

- 表接口：`userSandboxRuntimePools`
- 文件：`packages/db/src/schema/user-sandbox-runtime-pools.ts`
- 主要用途：保存每个用户的 sandbox-runtime pool 配置，作为 supervisor 渲染 `srt-pools.json` 的 source of truth
- 主要访问接口：`UserSandboxRuntimePoolRepository`

| 字段 | 空值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `id` | 否 | `text` | pool 记录主键 |
| `owner_user_id` | 否 | `text` | pool owner，外键到 `users.id` |
| `enabled` | 否 | `integer(boolean)` | 是否启用该用户 SRT pool |
| `port` | 否 | `integer` | sandbox-runtime 子进程主 HTTP 端口 |
| `api_key` | 否 | `text` | 该用户 SRT pool 的 server-side API key |
| `workspace_base_path` | 否 | `text` | sandbox-runtime 容器内该用户 pool 的 workspace root |
| `pool_size` | 否 | `integer` | 该用户 SRT worker pool 容量 |
| `min_ready_processes` | 否 | `integer` | 该用户 SRT 预热 worker 数 |
| `session_timeout_ms` | 否 | `integer` | SRT session timeout，毫秒 |
| `max_concurrent_init` | 否 | `integer` | 同时初始化 worker 的上限 |
| `health_check_interval_ms` | 否 | `integer` | manager / child health check 间隔，毫秒 |
| `port_range_start` | 否 | `integer` | worker proxy port range 起点 |
| `port_range_end` | 否 | `integer` | worker proxy port range 终点 |
| `default_denied_domains_json` | 否 | `text(json)` | 默认网络 denylist |
| `default_allow_read_json` | 否 | `text(json)` | 默认允许读取路径 |
| `default_allow_write_json` | 否 | `text(json)` | 默认允许写入路径 |
| `default_deny_read_json` | 否 | `text(json)` | 默认禁止读取路径 |
| `default_deny_write_json` | 否 | `text(json)` | 默认禁止写入路径 |
| `restart_requested_at` | 是 | `timestamp_ms` | admin 请求重启该 pool 的 marker |
| `created_at` | 否 | `timestamp_ms` | 创建时间 |
| `updated_at` | 否 | `timestamp_ms` | 更新时间 |

索引与约束：

- 主键：`id`
- 唯一索引：`user_srt_pools_owner_user_idx(owner_user_id)`
- 唯一索引：`user_srt_pools_port_idx(port)`
- 唯一索引：`user_srt_pools_api_key_idx(api_key)`
- 外键：`owner_user_id -> users.id`，`onDelete: cascade`

说明：

- `api_key` 只供 server-side supervisor 与 sandbox-runtime private config 使用，不应进入浏览器 DTO
- `workspace_base_path` 是 sandbox-runtime 容器内路径，不是 bot/workspace 的宿主机路径持久化入口
- proxy port range overlap 由 `UserSandboxRuntimePoolRepository` 在 SQLite `immediate` 事务中检查

## 6. 业务层建议阅读方式

如果你要看“某个功能实际写了哪些表”，建议按下面顺序读：

1. 先看本文件，确定字段语义
2. 再看 `packages/db/src/repositories/*.ts`，确认允许的读写入口
3. 最后看 `apps/web` / `apps/supervisor`，确认谁在什么时机写这些字段

## 7. 当前最关键的业务事实

当前实现里最需要优先理解的是这三组数据：

- `bot_instances.desired_state`
  - 控制面目标状态真相源
- `bot_instances.status`
  - runtime 当前观测态
- `bot_events + rowId`
  - 详情页 SSE / 增量轮询的时间线基础

只要先吃透这三组字段，WeClaws 当前的数据流就已经能看懂大半。
