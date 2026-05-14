# CHANGELOG

## 2026-05-14

### Changed

- 数据库依赖基线已提升到安全版本：`drizzle-orm` 升级到 `^0.45.2`，`better-sqlite3` 升级到 `^12.10.0`，用于压掉当前 Drizzle / SQLite 相关安全告警并对齐上层 auth/runtime 依赖树。

## 2026-05-10

### Changed

- `bot_instances` 新增 `qr_reissue_requested_at` 字段与 `BotInstanceRepository.requestQrReissue()/consumeQrReissueRequest()`，用于持久化“重新扫码/重新出码” intent，并在 runtime 完成清理后清空最近二维码和微信账号事实；failed bot 收到 reissue intent 时会先转回可 reconcile 状态。
- 新增 `bot_qr_shares` 表与 migration `0006_mighty_tyrannus`，用于保存每个 bot 当前唯一的二维码公开分享记录。
- 新增 `BotQrShareRepository`：
  - `upsertActiveByBotInstanceId()`
  - `findByBotInstanceId()`
  - `findActiveByBotInstanceId()`
  - `findActiveByTokenHash()`
  - `revokeByBotInstanceId()`

### Notes

- 当前 `bot_qr_shares` 同时保存 `token` 和 `token_hash`：owner 侧需要直接恢复当前公开链接，public lookup 继续只按 hash 命中。
- `BotQrShareRepository.upsertActiveByBotInstanceId()` 使用 SQLite upsert 收敛同一 bot 的并发分享开启请求，避免唯一索引冲突冒泡成 500。
- `BotQrShareRepository.revokeByBotInstanceId()` 只返回本次真正 revoke 的 active share；没有 active share 时返回 `null`，避免 revoked 旧链接被当成有效状态继续向上冒泡。

## 2026-05-07

### Changed

- `BotInstanceRepository` 新增 owner-scoped `updateNameForOwner()` 窄接口，用于 web 修改 Bot 展示名称；该接口只更新 `bot_instances.name / updated_at`，不引入通用 update bag。

## 2026-05-02

### Added

- 新增 `user_sandbox_runtime_pools` 表与 migration `0005_optimal_mikhail_rasputin`，用于保存每个用户的 sandbox-runtime pool 配置：
  - 主端口与 proxy port range
  - per-user API key
  - pool size、min ready、session timeout、health interval 等容量参数
  - 默认 allow/deny policy JSON
  - restart marker
- 新增 `UserSandboxRuntimePoolRepository`：
  - `ensureForUser()`
  - `findByOwnerUserId()`
  - `listAll()`
  - `updateByOwnerUserId()`
  - `requestRestart()`

### Notes

- SRT pool provisioning 在 SQLite `immediate` 事务内完成主端口与 proxy port range 分配；repository 保持窄接口，不 join 用户邮箱、不读取 manager status、不启动 runtime 进程。
- `updateByOwnerUserId()` 会在写入前显式拒绝 child `port` 冲突，避免把 SQLite unique constraint 泄漏给上层 API。

## 2026-04-19

### Changed

- 新增 follow-up migration `0004_violet_johnny_blaze`，把 hard cut 后仍残留在 fresh schema 里的旧 `user_llm_configs` 表彻底移除
- `BotInstanceRepository` 不再保留只针对旧 `LLM_CONFIG_INCOMPLETE` 契约的专用 restart helper；failed bot 的重新接管统一继续走通用 `requestRestart()`

## 2026-04-17

### Changed

- 新增 `user_llm_profiles` 表与 `0003_llm_profiles_hard_cut` migration，用于保存 owner-scoped、可命名的完整 LLM profiles
- 新增 `UserLlmProfileRepository`：
  - `create()`
  - `listByUserId()`
  - `findByIdForUser()`
  - `updateByIdForUser()`
  - `deleteByIdForUser()`
- `bot_instances` 新增可空外键 `llm_config_id`，指向当前绑定的 `user_llm_profiles.id`
- `BotInstanceRepository` 新增 profile 相关窄接口：
  - `listByOwnerUserIdAndLlmConfigId()`
  - `updateLlmConfigBinding()`
- `RegistrationInviteRepository` 新增 `deleteUnusedById()`，用于只删除未使用且未预占的邀请码

### Notes

- 这次是 destructive hard cut：旧的 `user_llm_configs` / `UserLlmConfigRepository` 已移除，不保留兼容层或自动迁移逻辑

## 2026-04-14

### Changed

- `BotInstanceRepository` 新增 owner-scoped 窄聚合接口：`countByOwnerUserId()`
  - 供 web 层按用户统计当前 Bot 数量
  - 用于 `WEB_USER_BOT_LIMIT` 创建额度判断
  - 不引入通用条件计数接口

## 2026-04-13

### Changed

- `WorkspaceRepository` 新增 `deleteById()`，供 web 在 bot 删除成功路径里删除 workspace，并依赖现有外键级联清理 `bot_instances` / `bot_events`

## 2026-04-12

### Changed

- 新增 `user_llm_configs` 表与 `0002_sleepy_mentallo` migration，用于保存用户级 provider / model / API key / gateway 配置
- 新增 `UserLlmConfigRepository`：
  - `findByUserId()`
  - `upsert()`
  - `clearApiKey()`
- `BotInstanceRepository.requestRestart()` 现在会把 `failed` bot 重新转回可 reconcile 状态，供后续 restart intent 恢复
- `BotInstanceRepository` 新增窄接口：
  - `requestRestartFailedDueToLlmConfig()`
  - `recordRuntimeConfigSnapshot()`

### Notes

- 当前 `api_key` 按项目约定直接以明文存 SQLite；这轮不引入额外加密密钥或字段级加密层
## 2026-04-09

### Changed

- `migrateDatabase()` 的默认 migration 目录说明收敛为“当前运行文件同级的 `migrations`”；supervisor Docker bundle 现在会把 `packages/db/src/migrations` 复制到 `apps/supervisor/dist/migrations`，保证容器内自动迁移继续可用
- `BotEventRepository.append()` 现在返回稳定的 SQLite `rowId`
- `listByBotInstanceIdAfterCursor()` 的增量游标从 `(createdAt, id)` 改为 `rowId`，同毫秒事件也会严格按插入顺序流式返回

### Notes

- 详情页 SSE 和持续轮询现在都依赖 `rowId` 游标，避免 burst 输出时漏掉后插入事件

## 2026-04-08

### Changed

- workspace package 名称改为 `@weclaws/db`，跨包 shared 依赖统一使用 `@weclaws/shared`
- `UserRepository` 新增 `countAll()`，供 web 侧判断“是否还没有任何用户”并驱动首个管理员自举注册门槛
- `createDatabaseClient()` 现在会在打开 SQLite 前自动创建父目录，仓库不再需要提交默认 `storage/sqlite/db.sqlite` 基线文件
- 新增 `registration_bootstrap_claims` 表与 `RegistrationBootstrapClaimRepository`，用于首个管理员自举注册的原子 claim/release
- bot/workspace 持久化模型删除宿主机路径字段：
  - `bot_instances.fastagent_binary_path`
  - `bot_instances.data_dir`
  - `bot_instances.workspace_dir`
  - `bot_instances.log_dir`
  - `workspaces.filesystem_path`
- migration 历史重置为单一 `0000_baseline_reset` fresh baseline，并同步重建 `src/migrations/meta/*`

### Notes

- 当前项目未发布，直接做 destructive reset，不保留旧 schema 兼容迁移
- bot runtime 所需目录与 binary 路径都不再来自数据库；数据库只保存逻辑关系和运行状态

## 2026-04-02

### Added

- 新增 `registration_invites` 表与 `0002_sour_bedlam` migration，用于一次性单人注册邀请码
- 新增 `RegistrationInviteRepository`：
  - `create()`
  - `findByCode()`
  - `listRecent()`
  - `reserve()`
  - `findByReservationToken()`
  - `releaseReservation()`
  - `consumeReservation()`
- 新增 `0003_lovely_kang` migration，为邀请码增加 `reservation_token / reserved_at / reserved_by_email` 字段与索引

### Notes

- 邀请码消费通过 `usedByUserId / usedAt` 标记，不做硬删除，保留后台审计能力
- repository 只负责邀请码持久化、预占与完成注册的原子切换，不下沉 web 注册逻辑或 Better Auth 集成

## 2026-03-31

### Changed

- 新增 `0001_amusing_leo` migration，将 `bot_instances.fastagent_binary_path` 从必填改为可空；`null` 现在明确表示“交给 supervisor 的全局 `FASTAGENT_BINARY_PATH` 决定”
- `findStopCandidates()` 现在会包含 `status='provisioning'`，修复 bot 创建后在首轮 reconcile 前就被 stop 时无法收敛的问题
- `BotEventRepository.append()` 不再回查整条事件时间线，只返回新插入事件
- 新增 `listByBotInstanceIdAfterCursor()`，使用稳定 `(createdAt, id)` 游标按升序增量读取事件，避免同毫秒事件在持续轮询里丢失或重复

### Notes

- 事件全量倒序读取仍保留给详情页/一次性历史读取；持续流式轮询改走增量 cursor API

## 2026-03-30

### Changed

- 将 `src` 内部相对导入从 `.js` 后缀改为 extensionless 形式，保证 workspace 源码被 Next/Turbopack 直接消费时可以正确解析
- 将 migration 默认目录解析从 `new URL('./migrations', import.meta.url)` 改为基于当前文件目录的路径拼接，避免 bundler 把 migrations 目录当成模块解析
- 为 supervisor runtime 新增 bot instance 窄接口：
  - `markStarting`
  - `recordQrCode`
  - `recordLoginConfirmed`
  - `markRunning`
  - `markDegraded`
  - `recordRuntimeError`
  - `markStopping`
  - `markStopped`
  - `scheduleRestart`
  - `consumeRestartRequest`
  - `markFailed`
  - `findStopCandidates`
- `findReconcileCandidates()` 现在会排除 `failed` 实例，避免 supervisor 无限重启失败 bot
- `markRunning()` 现在允许在真实 restore 路径下顺带回填 `weixinAccountId`，避免 `running(accountId=...)` 被忽略

### Notes

- 这次改动不改变 schema、repository 或 migration 行为，只修复 monorepo 源码直连场景下的构建兼容性
- runtime 状态迁移仍然只通过 repository 暴露的窄方法完成，不引入通用 patch bag
