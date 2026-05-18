# WeClaws Environment And Secrets Matrix

## 1. 文档定位

本文档统一说明 WeClaws 仓库使用的环境变量、密钥边界和配置分层。

当前事实来源以代码和配置为准：

- `.env.example`
- `infra/compose/.env.example`
- `apps/web/src/lib/env.ts`
- `apps/web/src/lib/admin.ts`
- `apps/supervisor/src/config.ts`
- `apps/supervisor/src/runtime/spawn-fastagent.ts`
- `infra/compose/docker-compose.yml`

## 2. 配置分层

仓库有两套主要配置入口：

### 2.1 宿主机本地开发

宿主机本地开发默认围绕仓库根 `.env` 组织。

主要服务：

- `pnpm dev:web`
- `pnpm dev:supervisor`
- `pnpm db:generate`
- `pnpm db:migrate`

需要注意：

- `pnpm dev:web` / `pnpm dev:supervisor` 会在当前进程缺少必填值时尝试补读根 `.env`
- `pnpm db:generate` / `pnpm db:migrate` 不会自动补读根 `.env`；它们读取当前 shell 环境，未显式设置 `DATABASE_URL` 时回退到默认 SQLite 路径

默认模板见：

- `.env.example`

### 2.2 Docker Compose

默认读取：

- `infra/compose/.env`

默认模板见：

- `infra/compose/.env.example`

### 2.3 两份 env 文件不能互换

根 `.env` 和 `infra/compose/.env` 不是同一份配置的两个副本，而是服务于两个运行形态：

| 场景 | 配置文件 | 谁读取 | 路径语义 | SRT host |
| --- | --- | --- | --- | --- |
| 宿主机本地 dev | 根 `.env` | `pnpm dev:web`、`pnpm dev:supervisor` | 宿主机路径或仓库相对路径，例如 `./storage/...` | 通常是 `localhost` |
| Docker Compose | `infra/compose/.env` | `docker compose` 插值；最终 env 由 `docker-compose.yml` 注入容器 | 容器内路径，例如 `/app/storage/...` | Compose service name：`sandbox-runtime` |

不要把根 `.env` 直接复制成 `infra/compose/.env`，也不要反过来覆盖。常见错误是：

- 在根 `.env` 里写 `SRT_SERVICE_HOST=sandbox-runtime`，导致宿主机直跑 supervisor 访问不到 sandbox-runtime
- 在 Compose `.env` 里写 `SRT_SERVICE_HOST=localhost`，导致容器内 supervisor 访问自己而不是 `sandbox-runtime` 服务
- 把根 `.env` 的 `./storage/...` 路径放进 Compose 容器，导致容器内找不到文件
- 把 Compose 的 `/app/storage/...` 路径放进根 `.env`，导致宿主机 dev 直接写到不存在的目录

### 2.4 本地控制面测试

如果只测试注册、SRT pool 自动配置、管理员 `/admin/sandbox-runtime` 页面和管理 API，可以只跑：

- `pnpm dev:web`
- `pnpm dev:supervisor`

根 `.env` 至少应保持：

- `FASTAGENT_SANDBOX_MODE=remote`
- `SRT_SERVICE_HOST=localhost`
- `SRT_POOL_CONFIG_FILE=./storage/sandbox-runtime-private/srt-pools.json`
- `SRT_POOL_STATUS_FILE=./storage/sandbox-runtime-private/srt-pool-status.json`
- `SRT_WORKSPACE_MAP_DIR=./storage/sandbox-runtime-private/workspace-map`
- `SRT_WORKSPACE_BASE_ROOT=./storage/sandbox-runtime-user-workspaces`

注意：

- `/admin/sandbox-runtime` 列表显示的是已经存在的 `user_sandbox_runtime_pools`，不是所有用户。
- 新注册用户会自动创建 SRT pool。
- 功能上线前已经存在的本地用户，如果还没有触发过 pool provisioning，管理员页面会看到空列表；需要让该用户重新走注册路径、启动一次其 bot 让 supervisor 补齐，或手工调用 repository 补一条默认 pool。
- 没有启动 sandbox-runtime manager 时，manager/status 资源信息会显示不可用，但数据库里的 pool 配置仍可查看和保存。

### 2.5 需要特别注意的差异

- 根 `.env.example` 和 Compose `.env.example` 都已经移除了 repo-wide LLM 默认值示例。
- bot runtime 现在必须绑定用户级 LLM profile；不要再把 `.env.example` 当作 bot provider/model/api key 的默认来源。

### 2.6 最小可运行组合

常见场景下，最少需要关注这些变量：

- 宿主机只跑 `web`
  - `DATABASE_URL`
  - `APP_BASE_URL`
  - `BETTER_AUTH_SECRET`
- 宿主机跑 `web + supervisor`，使用 remote sandbox
  - 上述 `web` 变量
  - `FASTAGENT_SANDBOX_MODE=remote`
  - `SRT_POOL_CONFIG_FILE`
  - `SRT_POOL_STATUS_FILE`
  - `SRT_WORKSPACE_MAP_DIR`
  - `SRT_SERVICE_HOST`
  - `SRT_DEFAULT_*` / `SRT_PORT_BASE` / `SRT_PROXY_PORT_BASE` 按需覆盖
  - 登录后至少创建一个用户级 LLM profile，再让 bot 绑定该 profile
- 宿主机跑 `web + supervisor`，禁用 sandbox
  - 上述 `web` 变量
  - `FASTAGENT_SANDBOX_MODE=disabled`
  - 登录后至少创建一个用户级 LLM profile，再让 bot 绑定该 profile
- Docker Compose 默认栈
  - `APP_BASE_URL`
  - `BETTER_AUTH_SECRET`
  - 登录后至少创建一个用户级 LLM profile，再让 bot 绑定该 profile
  - `WEB_PORT`、`COMPOSE_PROJECT_NAME` 按部署需要调整
  - `WEB_ADMIN_EMAILS`、`WEB_USER_BOT_LIMIT`、`RECONCILE_INTERVAL_MS` 按场景补充

### 2.7 已明确的枚举和值格式

以下是仓库内已经明确落地、适合直接写进配置注释的可选值或值格式：

| Name | Allowed Values / Format | Notes |
| --- | --- | --- |
| `WEB_ADMIN_EMAILS` | empty, `admin@example.com`, `admin@example.com,ops@example.com` | 空值表示不启用白名单自举/管理员邮箱入口；多值用逗号分隔 |
| `WEB_USER_BOT_LIMIT` | empty, `0`, positive integer | 空值或 `0` 表示不限；正整数表示每个用户最多可创建的 Bot 数量 |
| `FASTAGENT_SANDBOX_MODE` | `remote`, `disabled` | 这是代码层硬枚举 |
| `FASTAGENT_BASE_URL` | empty or absolute URL | 仓库不限定具体网关列表 |
| `FASTAGENT_API_TYPE` | empty or provider-specific string | 仓库内已出现示例值：`openai-responses` |
| `SRT_DEFAULT_DENIED_DOMAINS` | empty, single domain, comma-separated domains | 例如 `a.com,b.com,*.example.com`；空值表示不额外阻止任何域名 |
| `SRT_DEFAULT_ALLOW_READ` | empty, single path, comma-separated paths | per-user SRT 默认路径列表 |
| `SRT_DEFAULT_ALLOW_WRITE` | empty, single path, comma-separated paths | per-user SRT 默认路径列表 |
| `SRT_DEFAULT_DENY_READ` | empty, single path, comma-separated paths | per-user SRT 默认路径列表 |
| `SRT_DEFAULT_DENY_WRITE` | empty, single path, comma-separated paths | per-user SRT 默认路径列表 |

说明：

- `FASTAGENT_DEFAULT_PROVIDER` / `FASTAGENT_DEFAULT_MODEL` 只用于 contract smoke / 手工 CLI tooling，不再属于示例 env 的常规运行配置
- per-user SRT child 的 API key 由 DB pool config 生成；不再通过全局 `SANDBOX_API_KEY` 管理

## 3. 核心变量矩阵

| Name | Used By | Secret | Typical Value | Notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | web, supervisor, db tooling | No | `file:./storage/sqlite/db.sqlite` | 本地开发默认指向工作区内 SQLite；Compose 内为 `file:/app/storage/sqlite/db.sqlite`；db tooling 不会自动补读根 `.env` |
| `APP_BASE_URL` | web | No | `http://localhost:3000` | Better Auth `baseURL` 与绝对链接来源；Compose 下通常应与 `WEB_PORT` 暴露出来的实际 URL 保持一致 |
| `BETTER_AUTH_SECRET` | web | Yes | `replace-me` | Better Auth session/cookie secret |
| `WEB_ADMIN_EMAILS` | web | No | `admin@example.com` or empty | 允许为空；非空时控制首个管理员自举注册白名单和 `/admin/invites` 权限入口 |
| `WEB_USER_BOT_LIMIT` | web | No | `0`, `3`, `10` | 可选的每用户 Bot 创建上限；空值或 `0` 表示不限，正整数表示 owner-scoped hard limit |
| `FASTAGENT_BINARY_PATH` | supervisor | No | `/absolute/path/to/fastagent` | 可选 override；未设置时优先使用 repo-local `apps/supervisor/node_modules/.bin/fastagent` |
| `FASTAGENT_SANDBOX_MODE` | supervisor | No | `remote` or `disabled` | `remote` 时从 owner-specific SRT pool 注入 `SANDBOX_URL` / `SANDBOX_API_KEY`；`disabled` 时不注入 `SANDBOX_*` 给 child |
| `SRT_SERVICE_HOST` | supervisor | No | `localhost` / `sandbox-runtime` | supervisor 渲染 owner-specific `SANDBOX_URL` 的服务 host；Compose 内固定为 `sandbox-runtime` |
| `SRT_POOL_CONFIG_FILE` | supervisor, sandbox-runtime manager | No | `./storage/sandbox-runtime-private/srt-pools.json` | supervisor 写入，manager 读取；应放在 private shared path |
| `SRT_POOL_STATUS_FILE` | web, supervisor, sandbox-runtime manager | No | `./storage/sandbox-runtime-private/srt-pool-status.json` | manager 写入，web admin console 读取 |
| `SRT_WORKSPACE_MAP_DIR` | supervisor | No | `./storage/sandbox-runtime-private/workspace-map` | per-user workspace map 文件目录 |
| `SRT_DEFAULT_POOL_SIZE` | web, supervisor | No | `3` | 新用户 pool 默认进程池大小 |
| `SRT_DEFAULT_MIN_READY_PROCESSES` | web, supervisor | No | `1` | 新用户 pool 默认预热进程数 |
| `SRT_DEFAULT_SESSION_TIMEOUT_MS` | web, supervisor | No | `600000` | 新用户 pool 默认 session timeout |
| `SRT_DEFAULT_MAX_CONCURRENT_INIT` | web, supervisor | No | `1` | 新用户 pool 默认并发初始化限制 |
| `SRT_DEFAULT_HEALTH_CHECK_INTERVAL_MS` | web, supervisor | No | `60000` | 新用户 pool 默认健康检查周期 |
| `SRT_DEFAULT_PORT_RANGE_WIDTH` | web, supervisor | No | `100` | 每个用户 pool 占用的 SRT / proxy 端口段宽度 |
| `SRT_PORT_BASE` | web, supervisor | No | `31000` | 第一个用户 pool 的 SRT child 端口基线 |
| `SRT_PROXY_PORT_BASE` | web, supervisor | No | `9100` | 第一个用户 pool 的 proxy 端口基线 |
| `SRT_WORKSPACE_BASE_ROOT` | web, supervisor | No | `./storage/sandbox-runtime-user-workspaces` | per-user sandbox-runtime 工作区根 |
| `SRT_DEFAULT_DENIED_DOMAINS` | web, supervisor | No | `` | 新用户 pool 默认 denylist；空值表示 allow-by-default |
| `SRT_DEFAULT_ALLOW_READ` | web, supervisor | No | `` | 新用户 pool 默认允许读路径 |
| `SRT_DEFAULT_ALLOW_WRITE` | web, supervisor | No | `/tmp` | 新用户 pool 默认允许写路径 |
| `SRT_DEFAULT_DENY_READ` | web, supervisor | No | `/etc/passwd,/etc/passwd-,...,/proc/*/mountinfo,...` | 新用户 pool 默认拒绝读路径；默认包含 `/etc` 账号数据库备份文件和敏感 `/proc` 入口，不再直接包含 `/etc/mtab` |
| `SRT_DEFAULT_DENY_WRITE` | web, supervisor | No | `.env,~/.ssh,...` | 新用户 pool 默认拒绝写路径 |
| `FASTAGENT_DEFAULT_PROVIDER` | supervisor tooling | No | `anthropic` / `openai` | 不再参与 bot runtime spawn；当前主要用于 `pnpm test:fastagent-contract` 这类外部 contract smoke |
| `FASTAGENT_DEFAULT_MODEL` | supervisor tooling | No | `claude-opus-4-6` / `gpt-5.4` | 不再参与 bot runtime spawn；当前主要用于 `pnpm test:fastagent-contract` |
| `FASTAGENT_API_KEY` | supervisor tooling | Yes | `sk-...` | bot 运行时 key 来自绑定 profile；这个 env 当前主要用于 contract smoke 或直接跑 bare CLI |
| `FASTAGENT_BASE_URL` | supervisor tooling | Usually No | `https://gateway.example.com/v1` | bot 运行时 base URL 来自绑定 profile；这个 env 只在工具链或手工 smoke 中有意义 |
| `FASTAGENT_API_TYPE` | supervisor tooling | No | `openai-responses` | bot 运行时 API type 来自绑定 profile；这个 env 只在工具链或手工 smoke 中有意义 |
| `INSTANCES_ROOT` | web, supervisor | No | `./storage/instances` | 两侧都复用 shared resolver，必须保持一致；未设置时回退 shared 默认值 |
| `RECONCILE_INTERVAL_MS` | supervisor | No | `2000` | reconcile 周期，必须为正整数；未设置时回退 `2000` |

## 4. FastAgent Child 注入变量

以下变量不是手工直接配置到 FastAgent child，而是由 supervisor 在 spawn 前注入：

| Name | Source | Secret | Example | Notes |
| --- | --- | --- | --- | --- |
| `FASTAGENT_PROVIDER` | bot 绑定的 `user_llm_profiles` | No | `openai` | 实际运行时 provider |
| `FASTAGENT_MODEL` | bot 绑定的 `user_llm_profiles` | No | `gpt-5.4` | 实际运行时 model |
| `FASTAGENT_API_KEY` | bot 绑定的 `user_llm_profiles` | Yes | `sk-...` | 实际运行时 API key |
| `FASTAGENT_BASE_URL` | bot 绑定的 `user_llm_profiles` | Usually No | `https://gateway.example.com/v1` | 仅 profile 有值时显式注入 child |
| `FASTAGENT_API_TYPE` | bot 绑定的 `user_llm_profiles` | No | `openai-responses` | 仅 profile 有值时显式注入 child |
| `IM_GATEWAY_AGENT_ID` | bot instance id | No | `bot_123` | 当前事件里的 `agentId` 回填来源 |
| `IM_GATEWAY_ALLOW_ALL_PERMISSIONS` | supervisor | No | `true` | 当前基线实现固定注入 |
| `IM_GATEWAY_DATA_DIR` | `INSTANCES_ROOT + botId` | No | `/app/storage/instances/bot_123/data` | 实例级数据目录 |
| `IM_GATEWAY_WORKSPACE_DIR` | `INSTANCES_ROOT + botId` | No | `/app/storage/instances/bot_123/workspace` | 实例级工作区目录 |
| `SANDBOX_URL` | owner-specific SRT pool | No | `http://sandbox-runtime:31000` | 仅 remote sandbox 模式注入；端口来自 bot owner pool |
| `SANDBOX_API_KEY` | owner-specific SRT pool | Yes | generated pool secret | 仅 remote sandbox 模式注入；不是全局 Compose secret |

## 5. Compose 专用变量

这些变量主要用于 `infra/compose/docker-compose.yml` 和 `sandbox-runtime` 服务，不属于 web/supervisor 本地开发必填项。

`infra/compose/.env.example` 当前只把真正的硬必填项保持为未注释；其他可选 override 会以注释形式保留，按需取消注释即可，不代表这些变量被移除或不再支持。

| Name | Used By | Secret | Typical Value | Notes |
| --- | --- | --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | compose | No | `weclaws` | 控制 Compose 生成的容器、网络和卷名前缀 |
| `WECLAWS_DATA_ROOT` | production compose override | No | `/srv/weclaws/data` | `docker-compose.prod.yml` 用它把 SQLite、instances、sandbox user workspaces 和 sandbox-runtime private config/status 显式落到宿主机目录 |
| `WEB_PORT` | compose, web host port mapping | No | `3000` | 控制宿主机暴露端口；应与 `APP_BASE_URL` 的对外 URL 保持一致 |
| `SANDBOX_RUNTIME_NPM_VERSION` | compose build arg | No | unset; default comes from `infra/docker/sandbox-runtime.versions.env` | 临时覆盖 repo-local sandbox image 安装的 `@fastagent/sandbox-runtime` 版本 |
| `AGENT_BROWSER_NPM_VERSION` | compose build arg | No | `0.27.0` | 控制 repo-local sandbox image 安装的 `agent-browser` 版本 |
| `BROWSERLESS_TOKEN` | browserless, sandbox-runtime | Yes | `replace-me` | 默认 Compose 用它保护 `browserless` sidecar，并映射成 `sandbox-runtime` 里的 `BROWSERLESS_API_KEY` |
| `BROWSERLESS_API_URL` | sandbox-runtime | No | `http://browserless:3000` | `agent-browser -p browserless` 在 Compose 内连接 sidecar 的默认地址 |
| `BROWSERLESS_CONCURRENT` | browserless | No | `2` | Browserless 并发会话上限 |
| `BROWSERLESS_QUEUED` | browserless | No | `2` | Browserless 排队上限 |
| `BROWSERLESS_TIMEOUT` | browserless | No | `120000` | Browserless 默认请求/会话超时 |
| `BUN_VERSION` | compose build arg | No | `1.3.13` | 控制 repo-local sandbox image 安装的 `bun` 版本 |
| `PNPM_VERSION` | compose build arg | No | `9.15.4` | 控制 repo-local sandbox image 安装的 `pnpm` 版本 |
| `UV_VERSION` | compose build arg | No | `0.11.7` | 控制 repo-local sandbox image 安装的 `uv` 版本 |
| `SANDBOX_RUNTIME_PORT` | sandbox-runtime manager, host port mapping | No | `8788` | Compose 默认同时影响对外 health 端口和 manager 容器内端口 |
| `SANDBOX_RUNTIME_LOG_LEVEL` | sandbox-runtime manager | No | `info` | Compose 映射到 manager `LOG_LEVEL` |
| `SANDBOX_COMMAND_EXTRA_PATHS` | sandbox-runtime manager + per-user child | No | `/usr/local/bin` | 上游 session command PATH 基线只含系统目录；WeClaws 用它把镜像里安装到 `/usr/local/bin` 的 CLI 追加回 sandbox 命令执行 PATH |
| `SRT_DEFAULT_POOL_SIZE` | web, supervisor | No | `3` | Compose 里的新用户 pool 默认进程池大小 |
| `SRT_DEFAULT_MIN_READY_PROCESSES` | web, supervisor | No | `1` | Compose 里的新用户 pool 默认预热进程数 |
| `SRT_DEFAULT_SESSION_TIMEOUT_MS` | web, supervisor | No | `600000` | Compose 里的新用户 pool 默认 session timeout |
| `SRT_DEFAULT_MAX_CONCURRENT_INIT` | web, supervisor | No | `1` | Compose 里的新用户 pool 默认并发初始化限制 |
| `SRT_DEFAULT_HEALTH_CHECK_INTERVAL_MS` | web, supervisor | No | `60000` | Compose 里的新用户 pool 默认健康检查周期 |
| `SRT_DEFAULT_PORT_RANGE_WIDTH` | web, supervisor | No | `100` | 每个用户 pool 占用的 SRT / proxy 端口段宽度 |
| `SRT_PORT_BASE` | web, supervisor | No | `31000` | Compose 里的第一个用户 SRT child 端口基线 |
| `SRT_PROXY_PORT_BASE` | web, supervisor | No | `9100` | Compose 里的第一个用户 proxy 端口基线 |
| `SRT_WORKSPACE_BASE_ROOT` | web, supervisor | No | `/app/apps/sandbox-runtime/user-workspaces` | Compose 里的 per-user sandbox-runtime 工作区根 |
| `SRT_DEFAULT_DENIED_DOMAINS` | web, supervisor | No | `` | 新用户 pool 默认 denylist；空值表示沿用上游 allow-by-default 语义 |
| `SRT_DEFAULT_ALLOW_READ` | web, supervisor | No | `` | 新用户 pool 默认允许读路径 |
| `SRT_DEFAULT_ALLOW_WRITE` | web, supervisor | No | `/tmp` | 新用户 pool 默认允许写路径 |
| `SRT_DEFAULT_DENY_READ` | web, supervisor | No | `/etc/passwd,/etc/passwd-,...,/proc/*/mountinfo,...` | 新用户 pool 默认拒绝读路径；默认包含 `/etc` 账号数据库备份文件和敏感 `/proc` 入口，不再直接包含 `/etc/mtab` |
| `SRT_DEFAULT_DENY_WRITE` | web, supervisor | No | `.env,~/.ssh,...` | 新用户 pool 默认拒绝写路径 |

补充：

- Compose 文件里 `sandbox-runtime` 服务入口是 manager；manager 不再接收全局 `API_KEY`
- per-user SRT child 的 `API_KEY` 由 `srt-pools.json` 逐用户写入，并只注入对应 child
- `AGENT_BROWSER_NPM_VERSION`、`BUN_VERSION`、`PNPM_VERSION`、`UV_VERSION` 只影响 sandbox 镜像构建内容，不会作为运行时 env 进入容器
- `SANDBOX_COMMAND_EXTRA_PATHS` 是运行时 env，不是 build arg；它负责把上游 `sandbox-runtime` session command 默认 PATH 之外的镜像内 CLI 路径显式追加回来
- `BROWSERLESS_TOKEN` 会同时进入 `browserless` sidecar 和 `sandbox-runtime`，后者再通过 child env allowlist 透传成 `BROWSERLESS_API_KEY`
- `BROWSERLESS_API_URL` 默认指向 Compose 内部服务名 `http://browserless:3000`；如果切到外部 Browserless，再显式覆盖这个地址
- base Compose 默认不会把 `browserless` 暴露到宿主机；如果需要宿主机调试端口，应通过额外 Compose override 单独添加 `ports`
- Compose 里的 FastAgent child `SANDBOX_URL` 由 `SRT_SERVICE_HOST` 和 owner pool 端口推导，不在 `infra/compose/.env.example` 中单独配置
- `DATABASE_URL` 和 `INSTANCES_ROOT` 在当前 Compose 文件里固定写成容器内路径，不从 `infra/compose/.env.example` 读取
- `WECLAWS_DATA_ROOT` 只用于 `docker-compose.prod.yml`；基础 `docker-compose.yml` 继续使用 Docker named volume，不会读取这个变量
- Compose 还会固定给 sandbox-runtime manager 注入 `SRT_POOL_CONFIG_FILE`、`SRT_POOL_STATUS_FILE`，并要求 `web` / `supervisor` / `sandbox-runtime` 共享私有 `sandbox_runtime_private`
- 仓库接受上游 sandbox-runtime 的公开网络 contract：默认允许外网访问，仅通过 `SRT_DEFAULT_DENIED_DOMAINS` 写入新用户 pool 做 denylist 收口

## 6. 服务边界

### 6.1 `apps/web`

读取：

- `DATABASE_URL`
- `APP_BASE_URL`
- `BETTER_AUTH_SECRET`
- `WEB_ADMIN_EMAILS`
- `WEB_USER_BOT_LIMIT`
- `INSTANCES_ROOT`
- `SRT_POOL_STATUS_FILE`
- `SRT_DEFAULT_*`
- `SRT_PORT_BASE`
- `SRT_PROXY_PORT_BASE`
- `SRT_WORKSPACE_BASE_ROOT`

说明：

- 核心登录/API 路径强依赖的是 `DATABASE_URL`、`APP_BASE_URL`、`BETTER_AUTH_SECRET`
- `WEB_ADMIN_EMAILS` 允许为空，不会单独阻止 `/login` 启动
- `WEB_USER_BOT_LIMIT` 只影响 create-bot owner 的数量上限判断；`0` 或空值表示不限
- `web` 会把用户级 LLM profiles 保存在 SQLite `user_llm_profiles`，create-bot 页面展示的是当前选中 profile 的摘要，而不是 env fallback
- `INSTANCES_ROOT` 是 create-bot 建目录时的可选 override；未设置时会回退 shared 默认路径
- `SRT_DEFAULT_*` 只用于注册时给新用户创建默认 SRT pool；已有 pool 不会因为 env 变化被隐式重写
- `SRT_POOL_STATUS_FILE` 只服务管理员 sandbox-runtime 页面读取 manager 状态

### 6.2 `apps/supervisor`

读取：

- `DATABASE_URL`
- `FASTAGENT_BINARY_PATH` 或 repo-local binary
- `FASTAGENT_SANDBOX_MODE`
- `INSTANCES_ROOT`
- `RECONCILE_INTERVAL_MS`
- `SRT_SERVICE_HOST`
- `SRT_POOL_CONFIG_FILE`
- `SRT_POOL_STATUS_FILE`
- `SRT_WORKSPACE_MAP_DIR`
- `SRT_DEFAULT_*`
- `SRT_PORT_BASE`
- `SRT_PROXY_PORT_BASE`
- `SRT_WORKSPACE_BASE_ROOT`

说明：

- `FASTAGENT_BINARY_PATH` 是可选 override；默认使用 repo-local binary
- `DATABASE_URL`、`INSTANCES_ROOT`、`RECONCILE_INTERVAL_MS` 都存在默认值
- `SANDBOX_URL` / `SANDBOX_API_KEY` 不再是 supervisor 启动配置；remote mode 会在 spawn 前从 bot owner 的 SRT pool 读取并注入 child
- `SRT_DEFAULT_*` 是自动补齐/创建用户 pool 的默认值；已有 pool 的手工调整以数据库为准
- `FASTAGENT_DEFAULT_*` / `FASTAGENT_API_KEY` / `FASTAGENT_BASE_URL` / `FASTAGENT_API_TYPE` 不再属于 supervisor app config surface；当前只在 `pnpm test:fastagent-contract` 这类独立 tooling / smoke 场景下按需读取

### 6.3 FastAgent child

当前不会继承这些控制面变量：

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `WEB_ADMIN_EMAILS`

当前也不会再从 supervisor 父进程隐式继承额外的全局 `FASTAGENT_*` 默认值；运行时 provider/model/api key/baseUrl/apiType 只认 bot 绑定 profile 和 supervisor 显式注入。

当前只允许：

- 系统运行必需环境变量
- 代理相关变量
- `FASTAGENT_*`
- supervisor 显式注入的 `IM_GATEWAY_*` / `SANDBOX_*`

## 7. 约定

- 本地开发默认继续使用仓库根 `.env`
- Docker Compose 默认继续使用 `infra/compose/.env`
- `pnpm dev:web` / `pnpm dev:supervisor` 与 db tooling 的 `.env` 加载行为不同，排障时不要混淆
- 不再把 `.env.web` / `.env.supervisor` 作为当前仓库的默认配置组织方式
- 如果由外部部署平台注入配置，变量名应尽量保持与本仓库一致
