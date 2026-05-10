# WeClaws API And SSE Contract

## 1. 文档定位

本文档定义当前 `apps/web` 对外暴露的 HTTP API、SSE 事件和相关约束。

当前事实来源以代码为准：

- `apps/web/src/app/api/**/*`
- `apps/web/src/lib/bot-service.ts`
- `apps/web/src/lib/sse.ts`
- `apps/web/src/lib/api-error.ts`

## 2. 通用约定

### 2.1 路由风格

文档中的 `/api/bots/{id}` 对应 Next.js 路由目录 `apps/web/src/app/api/bots/[id]`。

### 2.2 认证与鉴权

- `GET /api/bots`
- `POST /api/bots`
- `GET /api/bots/{id}`
- `PATCH /api/bots/{id}`
- `DELETE /api/bots/{id}`
- `POST /api/bots/{id}/start`
- `POST /api/bots/{id}/stop`
- `POST /api/bots/{id}/restart`
- `POST /api/bots/{id}/reissue-qr`
- `GET /api/bots/{id}/qr-share`
- `POST /api/bots/{id}/qr-share`
- `DELETE /api/bots/{id}/qr-share`
- `PATCH /api/bots/{id}/llm-profile`
- `POST /api/bots/{id}/skills/sync`
- `GET /api/bots/{id}/events`
- `GET /api/bots/{id}/stream`
- `GET /api/settings/llm-profiles`
- `POST /api/settings/llm-profiles`
- `PATCH /api/settings/llm-profiles/{profileId}`
- `DELETE /api/settings/llm-profiles/{profileId}`

以上 bot 路由都要求已登录 session，且只能访问自己的 bot。

下面这个路由当前是公开路由，不要求 WeClaws 登录态：

- `GET /api/share/qr/{token}`

下面这些管理路由要求管理员身份：

- `GET /api/admin/invites`
- `POST /api/admin/invites`
- `DELETE /api/admin/invites/{id}`

### 2.3 响应格式

除下面两个例外外，当前业务 API 统一返回：

```json
{
  "data": {},
  "error": null
}
```

错误时：

```json
{
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource."
  }
}
```

例外：

- `GET /api/auth/[...all]`、`POST /api/auth/[...all]`
  - 完全委托给 Better Auth handler
- `GET /api/qrcode`
  - 返回 `image/svg+xml`

### 2.4 当前常见错误码

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `LLM_PROFILE_IN_USE`
- `LLM_PROFILE_NAME_CONFLICT`
- `BOT_LIMIT_REACHED`
- `BOT_DELETE_NOT_ALLOWED`
- `INVITE_DELETE_NOT_ALLOWED`
- `INVITE_REQUIRED`
- `INVALID_INVITE`
- `INVITE_SIGN_UP_FAILED`
- `INVITE_CONSUME_FAILED`
- `INTERNAL_SERVER_ERROR`

## 3. Auth And Admin API

### 3.1 `GET|POST /api/auth/[...all]`

Better Auth 原生入口。

当前仓库没有在这层额外包装统一 `{ data, error }` 响应。

### 3.2 `POST /api/auth/register-with-invite`

#### 描述

当前注册入口不是“开放注册”，而是邀请码注册。

例外：

- 当数据库里还没有任何用户
- 且注册邮箱命中 `WEB_ADMIN_EMAILS`
- 且请求没有填写邀请码

此时允许首个管理员自举注册一次。

#### 请求体

```json
{
  "email": "admin@example.com",
  "password": "password123",
  "inviteCode": "INV-ABC123DEF456"
}
```

说明：

- `inviteCode` 可为空字符串
- 只有“首个管理员自举注册”场景允许空邀请码成功

#### 成功响应

```json
{
  "data": {
    "user": {
      "id": "user_123",
      "email": "admin@example.com",
      "name": "admin"
    }
  },
  "error": null
}
```

#### 失败语义

- 没有邀请码且不满足自举条件：`INVITE_REQUIRED`
- 邀请码不可用：`INVALID_INVITE`
- Better Auth 建号失败：`INVITE_SIGN_UP_FAILED`
- 邀请码预占成功但最终消费失败：`INVITE_CONSUME_FAILED`

### 3.3 `GET /api/admin/invites`

#### 描述

返回最近的邀请码列表。

#### 成功响应

```json
{
  "data": [
    {
      "id": "invite_1",
      "code": "INV-ABC123DEF456",
      "canDelete": true,
      "createdAt": "2026-04-02T08:00:00.000Z",
      "createdByEmail": "admin@example.com",
      "reservedAt": null,
      "reservedByEmail": null,
      "usedAt": null,
      "usedByEmail": null
    }
  ],
  "error": null
}
```

### 3.4 `POST /api/admin/invites`

#### 描述

由服务端生成新的邀请码。

#### 请求体

无。

#### 成功响应

```json
{
  "data": {
    "id": "invite_1",
    "code": "INV-ABC123DEF456",
    "canDelete": true,
    "createdAt": "2026-04-02T08:00:00.000Z",
    "createdByEmail": "admin@example.com",
    "reservedAt": null,
    "reservedByEmail": null,
    "usedAt": null,
    "usedByEmail": null
  },
  "error": null
}
```

### 3.5 `DELETE /api/admin/invites/{id}`

#### 描述

删除单个邀请码。

#### 当前行为

- 只允许管理员调用
- 只有 `unused + unreserved` 的邀请码允许删除
- 如果邀请码已使用，或仍存在 reservation 信息，接口返回 `409 INVITE_DELETE_NOT_ALLOWED`

#### 成功响应

```json
{
  "data": {
    "id": "invite_1"
  },
  "error": null
}
```

## 4. Bot API

### 4.1 `GET /api/bots`

#### 描述

获取当前登录用户的 bot 列表。

#### 成功响应

```json
{
  "data": [
    {
      "id": "bot_123",
      "name": "my-weixin-bot",
      "provider": "openai",
      "model": "gpt-5.4",
      "workspaceId": "ws_123",
      "desiredState": "running",
      "status": "running",
      "createdAt": "2026-03-30T00:00:00.000Z",
      "updatedAt": "2026-03-30T00:00:03.000Z"
    }
  ],
  "error": null
}
```

### 4.2 `POST /api/bots`

#### 描述

创建 bot，同时自动：

- 创建 workspace
- 创建实例目录
- 用所选 LLM profile 的 snapshot 写入 `provider` / `model`
- 设置 `desiredState=running`
- 以 `status=provisioning` 落库

#### 请求体

```json
{
  "name": "my-weixin-bot",
  "llmProfileId": "profile_123"
}
```

说明：

- 当前请求体必须携带 `name + llmProfileId`
- `provider`、`model` 不从前端传入，而是从所选 profile snapshot 写入 `bot_instances`
- 如果 `llmProfileId` 不存在或不属于当前 owner，接口返回 `404 NOT_FOUND`
- 如果 `WEB_USER_BOT_LIMIT` 为正整数，且当前 owner 已达到上限，接口会返回 `409 BOT_LIMIT_REACHED`

#### 成功响应

返回完整 `BotDetailItem`：

```json
{
  "data": {
    "id": "bot_123",
    "name": "my-weixin-bot",
    "llmConfigId": "profile_123",
    "llmProfileName": "Primary",
    "provider": "openai",
    "model": "gpt-5.4",
    "workspaceId": "ws_123",
    "desiredState": "running",
    "status": "provisioning",
    "processPid": null,
    "processStartedAt": null,
    "heartbeatAt": null,
    "restartRequestedAt": null,
    "qrReissueRequestedAt": null,
    "lastQrCodeId": null,
    "lastQrCodeUrl": null,
    "weixinAccountId": null,
    "lastErrorCode": null,
    "lastErrorMessage": null,
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "error": null
}
```

#### 失败响应

- 当前账号已达到创建上限时返回：

```json
{
  "data": null,
  "error": {
    "code": "BOT_LIMIT_REACHED",
    "message": "You have reached the bot limit for this account."
  }
}
```

### 4.3 `GET /api/bots/{id}`

#### 描述

获取单个 bot 的当前详情。

说明：

- 返回里的 `provider` / `model` 展示 bot 当前的 runtime 快照；这份快照会在 create-bot、profile 换绑和每次 supervisor spawn 前刷新，不会随着 profile 后续编辑而立即漂移
- `llmConfigId` 表示 bot 当前绑定的 profile id；`llmProfileName` 是 owner-scoped hydration 后的展示名

### 4.3.1 `PATCH /api/bots/{id}`

#### 描述

修改单个 bot 的展示名称。

#### 请求体

```json
{
  "name": "Renamed Bot"
}
```

#### 当前行为

- 只允许 bot owner 调用
- `name` 会先 trim，空字符串返回 `400 VALIDATION_ERROR`
- 当前只更新 `bot_instances.name / updated_at`
- 不会触发 restart intent，也不会修改 LLM profile 绑定或 runtime 快照

#### 成功响应

返回完整 `BotDetailItem`。

### 4.3.2 `DELETE /api/bots/{id}`

#### 描述

删除单个 bot。

#### 当前行为

- 只允许 bot owner 调用
- 当前只允许删除完全停止的 bot：
  - `desiredState = stopped`
  - `status = stopped`
  - `processPid = null`
- 删除时会先删除 bot 所属 workspace，并依赖现有外键级联清理 bot / events
- 成功路径还会额外删除 `storage/instances/{botId}` 对应实例目录

#### 成功响应

```json
{
  "data": {
    "id": "bot_123"
  },
  "error": null
}
```

#### 失败响应

- 如果 bot 仍处于运行链路，返回：

```json
{
  "data": null,
  "error": {
    "code": "BOT_DELETE_NOT_ALLOWED",
    "message": "Stop the bot completely before deleting it."
  }
}
```

### 4.4 `POST /api/bots/{id}/start`

#### 描述

请求启动 bot。

#### 当前行为

- 正常情况下只把 `desiredState` 改为 `running`
- 如果 bot 当前是 `failed`，则改为写入 restart intent 并重新放回可 reconcile 状态
- 不直接在 API 请求里拉起进程
- 由 supervisor 后续 reconcile 收敛

### 4.5 `POST /api/bots/{id}/stop`

#### 描述

请求停止 bot。

#### 当前行为

- 只把 `desiredState` 改为 `stopped`
- 如果实例已在运行，由 supervisor 后续收敛并发出停止链路

### 4.6 `POST /api/bots/{id}/restart`

#### 描述

请求重启 bot。

#### 当前行为

- 把 `desiredState` 设为 `running`
- 写入 `restartRequestedAt`
- 如果 reconcile 时发现实例已在运行，supervisor 会先标记 stopping 并停掉当前进程
- 下一轮 reconcile 再重新拉起

#### 成功响应

返回完整 `BotDetailItem`，其中 `restartRequestedAt` 会被写入当前时间。

### 4.6.1 `POST /api/bots/{id}/reissue-qr`

#### 描述

请求当前 bot 重新出二维码。

#### 当前行为

- 只允许 bot owner 调用
- web 侧只写入 `qrReissueRequestedAt`
- 这不是微信通道内的真实 logout；实际停进程、清登录态、重新出码由 supervisor 后续 reconcile 收敛
- 成功响应里的 `qrReissueRequestedAt` 会是当前请求时间

#### 成功响应

返回完整 `BotDetailItem`。

### 4.6.2 `GET|POST|DELETE /api/bots/{id}/qr-share`

#### 描述

读取、创建或关闭当前 bot 的二维码公开分享链接。

#### 当前行为

- 只允许 bot owner 调用
- 每个 bot 当前最多只有一条 active share
- `POST` 会生成新的 token，并返回同一 bot 当前有效的公开链接
- `DELETE` 会 revoke 当前 active share；如果当前没有 active share，返回 `data: null`

#### owner 响应体

```json
{
  "data": {
    "shareId": "share_123",
    "publicUrl": "https://app.example.com/share/qr/token_123",
    "revokedAt": null
  },
  "error": null
}
```

### 4.6.3 `GET /api/share/qr/{token}`

#### 描述

公开读取当前二维码分享状态。

#### 当前行为

- 当前不要求 WeClaws 登录态
- 只暴露最小公开信息：分享 id、bot 当前状态、最后更新时间、以及“如果 bot 正在等待扫码时”的二维码 URL
- 当 bot 当前不是 `waiting_for_qr` 时，`qrCodeUrl` 返回 `null`
- 对应公开页面是 `/share/qr/{token}`；前端当前按 2 秒轮询这个 API，分享链接本身不需要因二维码刷新而变化
- 响应必须携带 `cache-control: no-store`，避免公开二维码状态和 revoked token 结果被缓存

#### 成功响应

```json
{
  "data": {
    "shareId": "share_123",
    "status": "waiting_for_qr",
    "qrCodeUrl": "https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3",
    "updatedAt": "2026-05-10T10:00:00.000Z"
  },
  "error": null
}
```

### 4.6.4 `PATCH /api/bots/{id}/llm-profile`

#### 描述

切换单个 bot 当前绑定的 LLM profile。

#### 请求体

```json
{
  "llmProfileId": "profile_456"
}
```

#### 当前行为

- 只允许 bot owner 调用
- `llmProfileId` 必须属于当前 owner
- 成功后会更新 `bot_instances.llm_config_id`
- 同时会把目标 profile 的 `provider / model` snapshot 写回 bot row
- 如果该 bot 当前 `desiredState=running`，服务端会自动写入 restart intent，由 supervisor 后续重启并应用新 profile

#### 成功响应

返回完整 `BotDetailItem`。

### 4.7 `POST /api/bots/{id}/skills/sync`

#### 描述

手动再次触发当前 bot 的托管 skills 对账。

#### 当前行为

- 只允许 bot owner 调用
- 当前固定触发 `sync-all-managed`
- 当前只同步 `storage/instances/{botId}/data/skills`
- 不会修改 `workspace/.fastagent/skills`
- 不附带 restart 语义
- 如果 bot 级同步锁已被占用，返回结构化 `SYNC_IN_PROGRESS`
- 即使同步结果是 `error`，也只代表这次目录对账失败，不表示当前运行中的 FastAgent 已被停止

#### 请求体

当前可为空。

未来预留了 `operation` / `skillNames` 形状，但当前版本除 `sync-all-managed` 外的其它模式仍不支持。

#### 成功响应

```json
{
  "data": {
    "result": {
      "bundleVersion": "2026-04-15-curated-v6",
      "error": null,
      "errors": [],
      "installedSkills": [],
      "metadataRepaired": false,
      "operation": "sync-all-managed",
      "removedSkills": [],
      "repairedMarkers": [],
      "skippedConflicts": [],
      "status": "success",
      "updatedSkills": []
    }
  },
  "error": null
}
```

#### Busy 响应

当前仍然保持统一 envelope，但 HTTP status 是 `409`：

```json
{
  "data": {
    "result": {
      "bundleVersion": null,
      "error": {
        "code": "SYNC_IN_PROGRESS",
        "message": "Managed skills sync is already running for this bot."
      },
      "errors": [
        {
          "code": "SYNC_IN_PROGRESS",
          "message": "Managed skills sync is already running for this bot."
        }
      ],
      "installedSkills": [],
      "metadataRepaired": false,
      "operation": "sync-all-managed",
      "removedSkills": [],
      "repairedMarkers": [],
      "skippedConflicts": [],
      "status": "busy",
      "updatedSkills": []
    }
  },
  "error": null
}
```

#### 失败语义

- 请求体声明了当前未实现的 operation：`UNSUPPORTED_OPERATION`
- 其他 route 级鉴权/解析失败仍走通用 envelope

### 4.8 `GET /api/bots/{id}/events`

#### 描述

获取 bot 历史事件列表。

#### 当前顺序

- 按最新事件优先返回

#### 成功响应

```json
{
  "data": [
    {
      "rowId": 42,
      "id": "evt_1",
      "botInstanceId": "bot_123",
      "type": "qr_code",
      "message": "qr ready",
      "payloadJson": {
        "agentId": "bot_123",
        "data": {
          "qrCodeUrl": "https://liteapp.weixin.qq.com/q/xxxx"
        },
        "pid": 120,
        "timestamp": "2026-03-30T00:00:05.000Z"
      },
      "createdAt": "2026-03-30T00:00:05.000Z"
    }
  ],
  "error": null
}
```

说明：

- 当前事件 payload 字段名是 `payloadJson`
- 当前增量 cursor 使用 `rowId`

### 4.9 `GET /api/bots/{id}/stream`

#### 描述

订阅单个 bot 的 SSE 实时流。

#### Header

返回：

```text
content-type: text/event-stream; charset=utf-8
cache-control: no-cache, no-transform
connection: keep-alive
```

#### 当前行为

- 初始帧只发送当前 bot 快照，不回放历史事件
- 历史事件列表需要额外调用 `GET /api/bots/{id}/events`
- 后续通过轮询 DB 差量推送
- 默认轮询间隔约 `2000ms`
- 每 `10s` 发送一次 keepalive comment

### 4.10 `GET /api/settings/llm-profiles`

#### 描述

读取当前登录用户的 LLM profile 列表。

#### 当前行为

- 返回 owner-scoped 的 profile 数组
- 每条 profile 只返回 `hasApiKey`，不回显明文 API key
- 当前按 `updatedAt desc, id asc` 排序

#### 成功响应

```json
{
  "data": [
    {
      "id": "profile_123",
      "name": "Primary",
      "provider": "openai",
      "model": "gpt-5.4",
      "baseUrl": "https://gateway.example.com/v1",
      "apiType": "openai-responses",
      "hasApiKey": true,
      "createdAt": "2026-04-17T02:00:00.000Z",
      "updatedAt": "2026-04-17T02:30:00.000Z"
    }
  ],
  "error": null
}
```

### 4.11 `POST /api/settings/llm-profiles`

#### 描述

创建当前登录用户的 LLM profile。

#### 请求体

```json
{
  "name": "Primary",
  "provider": "openai",
  "model": "gpt-5.4",
  "apiKey": "sk-...",
  "baseUrl": "https://gateway.example.com/v1",
  "apiType": "openai-responses"
}
```

说明：

- `name / provider / model / apiKey / apiType` 为必填非空字符串
- `baseUrl` 可省略或传 `null`
- `apiType` 当前只允许：
  - `anthropic-messages`
  - `openai-completions`
  - `openai-responses`
  - `google-generative-ai`
- 如果同一 owner 下已存在同名 profile，接口返回 `409 LLM_PROFILE_NAME_CONFLICT`
- 成功响应：

```json
{
  "data": {
    "profile": {
      "id": "profile_123",
      "name": "Primary",
      "provider": "openai",
      "model": "gpt-5.4",
      "baseUrl": "https://gateway.example.com/v1",
      "apiType": "openai-responses",
      "hasApiKey": true,
      "createdAt": "2026-04-17T02:00:00.000Z",
      "updatedAt": "2026-04-17T02:00:00.000Z"
    },
    "restartRequestedBotCount": 0
  },
  "error": null
}
```

### 4.12 `PATCH /api/settings/llm-profiles/{profileId}`

#### 描述

更新当前登录用户的单个 LLM profile。

#### 请求体

```json
{
  "model": "gpt-5.5",
  "apiType": "openai-responses"
}
```

说明：

- PATCH 采用稀疏更新语义：省略字段表示保持当前 profile 当前值不变
- `name / provider / model / apiKey` 只能省略或传非空字符串，不能传 `null`
- `baseUrl` 可以传 `null`，表示清空该字段
- `apiType` 只能省略或传允许列表里的非空字符串，不能传 `null`
- 只有字段实际发生变化时，服务端才会为所有绑定该 profile 且 `desiredState=running` 的 bot 写入 restart intent
- 如果 PATCH 是空请求体或 no-op，接口仍返回 200，但 `restartRequestedBotCount` 为 `0`
- 如果同一 owner 下已存在同名 profile，接口返回 `409 LLM_PROFILE_NAME_CONFLICT`

#### 成功响应

返回与 `POST /api/settings/llm-profiles` 相同的 `{ profile, restartRequestedBotCount }` 结构，其中 `restartRequestedBotCount` 是这次被写入 restart intent 的 bot 数量。

### 4.13 `DELETE /api/settings/llm-profiles/{profileId}`

#### 描述

删除当前登录用户的单个 LLM profile。

#### 当前行为

- 只允许删除当前 owner 自己的 profile
- 如果仍有 bot 绑定该 profile，接口返回 `409 LLM_PROFILE_IN_USE`
- 如果预检查之后又有 bot 并发绑定导致删除命中外键约束，接口仍返回 `409 LLM_PROFILE_IN_USE`

#### 成功响应

```json
{
  "data": {
    "id": "profile_123"
  },
  "error": null
}
```

### 4.14 `GET /api/qrcode?value=...`

#### 描述

把给定字符串编码为 SVG 二维码。

#### 当前输入约束

- query param: `value`
- 去空白后至少 1 个字符
- 最大长度 `4096`

#### 成功响应

- `status=200`
- `content-type: image/svg+xml; charset=utf-8`
- `cache-control: no-store`

说明：

- 当前路由本身不做 “必须是微信二维码 URL” 校验
- 但现有 UI 只会把 shared validator 认可的微信扫码页 URL 送进这个接口

## 5. SSE Event Contract

### 5.1 `bot.status.updated`

#### 触发条件

- 建连后的初始快照
- bot 状态签名变化

#### 数据

完整 `BotDetailItem`。

### 5.2 `bot.qrcode.updated`

#### 触发条件

- `lastQrCodeId` 或 `lastQrCodeUrl` 变化

#### 数据

```json
{
  "id": "bot_123",
  "lastQrCodeId": "2026-03-30T00:00:05.000Z",
  "lastQrCodeUrl": "https://liteapp.weixin.qq.com/q/xxxx"
}
```

### 5.3 `bot.event.created`

#### 触发条件

- `bot_events.rowId` 出现新事件

#### 数据

完整 `BotEventItem`。

### 5.4 `bot.error.updated`

#### 触发条件

有两类：

1. bot 自身最近错误字段变化
2. stream 轮询或初始化失败

#### 数据

bot 错误变化时：

```json
{
  "id": "bot_123",
  "lastErrorCode": "RUNTIME_ERROR",
  "lastErrorMessage": "runtime exploded"
}
```

stream 自身失败时：

```json
{
  "id": "bot_123",
  "message": "Bot stream polling failed."
}
```

### 5.5 Keepalive

当前实现会发送 SSE comment：

```text
: keepalive
```

客户端不需要把它当业务事件处理。
