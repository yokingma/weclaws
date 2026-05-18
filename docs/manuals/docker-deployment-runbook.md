# WeClaws Docker Build And Compose Runbook

## 1. Scope

本文档面向当前仓库内的 Docker 构建与单机 Compose 部署路径，覆盖：

- 三个镜像如何构建
- 默认 Compose 路径的实际行为
- 首次启动时数据库、卷和环境变量的实际行为
- 常用运维命令与排障入口

当前部署骨架位于：

- `infra/docker/sandbox-runtime.Dockerfile`
- `infra/docker/web.Dockerfile`
- `infra/docker/supervisor.Dockerfile`
- `infra/compose/docker-compose.yml`
- `infra/compose/docker-compose.prod.yml`
- `infra/compose/.env.example`

## 2. Build Overview

### 2.1 Image Matrix

| 镜像 | Dockerfile | 作用 | 关键特征 |
| --- | --- | --- | --- |
| `sandbox-runtime` | `infra/docker/sandbox-runtime.Dockerfile` | FastAgent remote sandbox 服务 | 从 `@fastagent/sandbox-runtime` npm 包安装，并通过 repo-local wrapper 对齐真实 bot workspace；额外预装 `agent-browser`、`lark-cli`、`bun`、`pnpm`、`uv`、`gh`、`ffmpeg`、`jq`、压缩包工具以及 PDF / `.docx` 文本提取 CLI；默认浏览器路径通过 Browserless sidecar 执行 |
| `browserless` | Compose image `ghcr.io/browserless/chromium` | 远程浏览器 sidecar | 为 `sandbox-runtime` 内的 `agent-browser -p browserless` 提供受支持的浏览器会话后端 |
| `supervisor` | `infra/docker/supervisor.Dockerfile` | 管理 bot 生命周期、收敛状态、自动迁移 DB | 构建阶段 bundle 出 `dist/index.js`，运行层复用 repo-local `@fastagent/cli@0.8.0`，并预装 `curl`、`gh`、`ffmpeg`、`procps` |
| `web` | `infra/docker/web.Dockerfile` | Next.js UI/API | 使用 Next `standalone` 运行层，并额外保留 `pnpm-workspace.yaml`、`apps/supervisor/package.json`、`resources/skills/managed` 与 `procps`，保证页头 FastAgent CLI 版本 badge 和 owner-scoped `Sync Skills` 接口都能在生产镜像中正常工作 |

### 2.2 Build Context

- 三个镜像的 build context 都是仓库根目录 `.`。
- `.dockerignore` 已排除 `node_modules`、`.next`、`docs`、测试产物和运行态数据，避免把无关内容打进镜像上下文。
- `web` 镜像是多阶段构建。
- `supervisor` 镜像是多阶段构建：build 阶段用 `esbuild` 产出 `apps/supervisor/dist/index.js`，并复制 `dist/migrations`；运行层通过 `node apps/supervisor/dist/index.js` 启动。

### 2.3 Published Image Targets

公开仓的生产镜像目标地址为：

- `ghcr.io/baseclaw/weclaws/web:latest`
- `ghcr.io/baseclaw/weclaws/supervisor:latest`
- `ghcr.io/baseclaw/weclaws/sandbox-runtime:latest`

发布新版本时，推送 `v*` tag 会触发 `.github/workflows/docker-images.yml`，自动构建并推送三张镜像。每张镜像都会写入当前 tag（例如 `v0.1.0`）和 `latest` 两个标签，供生产 Compose override 拉取。

### 2.4 Production Compose Override

- `infra/compose/docker-compose.yml` 作为本地联调基线。
- `infra/compose/docker-compose.prod.yml` 会用 `build: !reset null` 清掉基础文件里的本地构建定义，默认改成拉取 `ghcr.io/baseclaw/weclaws/*:latest`，并通过 `WECLAWS_DATA_ROOT` 把 SQLite、instances、sandbox user workspaces 和 sandbox-runtime private config/status 绑定到宿主机目录。
- 生产 override 还会拉起 `ghcr.io/browserless/chromium:latest`，保持和本地基线一致的远程浏览器拓扑。
- 生产部署时应叠加两个 Compose 文件，保持同一份服务拓扑、卷、健康检查和环境变量 contract。

## 3. Prerequisites

在执行 Compose 前先确认：

- Docker Engine 可用。
- `docker compose` 可用。
- 已复制 `infra/compose/.env.example` 为 `infra/compose/.env`。
- 如果使用生产 override，宿主机上的 `${WECLAWS_DATA_ROOT}` 已提前创建并允许 Docker 读写。
- `BETTER_AUTH_SECRET` 已按实际环境填写。
- Bot runtime 需要绑定至少一个用户 LLM profile。
- `APP_BASE_URL` 已和最终对外访问地址对齐；如果修改了 `WEB_PORT`，也要同步调整它。
- 如果需要首个管理员自举注册，`WEB_ADMIN_EMAILS` 已填写管理员邮箱白名单；不需要时可以留空。
- 如果走默认本仓库 sandbox 打包路径，允许构建 `infra/docker/sandbox-runtime.Dockerfile`。
- 如果要启用默认远程浏览器路径，`BROWSERLESS_TOKEN` 应替换成真实 token；不需要宿主机侧直连时，不必覆盖 `BROWSERLESS_API_URL`
- 默认 Compose 不会把 `browserless` 暴露到宿主机端口；只有在本地调试或外部客户端接入时，才应通过额外 override 单独加 `ports`
- 已确认根 `.env.example` 和 `infra/compose/.env.example` 的默认 provider/model 并不相同。

### 3.1 Environment File Ownership

- 宿主机本地开发的 `pnpm dev:web` / `pnpm dev:supervisor` 主要读取仓库根 `.env`。
- Docker Compose 默认读取的是 `infra/compose/.env`。
- 不要把两者混为一谈。

### 3.2 Variable Precedence

Compose 解析变量时，当前 shell 已导出的同名环境变量优先级高于 `--env-file` / `infra/compose/.env`。

排查配置漂移时，先看最终渲染结果：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml config
```

如果输出值和 `infra/compose/.env` 不一致，优先检查当前 shell 是否已经导出了 `APP_*`、`FASTAGENT_*`、`SANDBOX_*`、`SRT_*`。

## 4. Environment Contract

### 4.0 Compose Shell-Level Variables

这些变量主要影响 Compose 渲染和宿主机端口映射，不直接进入业务容器的应用配置：

- `COMPOSE_PROJECT_NAME`
- `WECLAWS_DATA_ROOT`
- `WEB_PORT`

说明：

- `COMPOSE_PROJECT_NAME` 会影响容器、网络和卷名称前缀。
- `WECLAWS_DATA_ROOT` 只用于 `docker-compose.prod.yml`，控制宿主机 bind mount 根目录。
- `WEB_PORT` 控制宿主机暴露出来的 web 端口；`APP_BASE_URL` 应与它对应的真实访问 URL 保持一致。

生产环境推荐直接固定为下面这组值：

```dotenv
WECLAWS_DATA_ROOT=/srv/weclaws/data
APP_BASE_URL=https://weclaws.example.com
WEB_PORT=3000
```

### 4.1 `web`

`web` 容器运行时至少依赖这些变量：

- `DATABASE_URL=file:/app/storage/sqlite/db.sqlite`
- `APP_BASE_URL`
- `BETTER_AUTH_SECRET`
- `WEB_ADMIN_EMAILS`（可选）
- `WEB_USER_BOT_LIMIT`（可选）
- `SRT_POOL_STATUS_FILE`
- `SRT_DEFAULT_*` / `SRT_PORT_BASE` / `SRT_PROXY_PORT_BASE` / `SRT_WORKSPACE_BASE_ROOT`

说明：

- `web` 镜像是 Next `standalone` 运行层，不能假设容器内还能读取宿主机根 `.env`。
- `web` 运行镜像还必须保留 `/app/apps/supervisor/package.json`。
- `web` 运行镜像除了 Next 产物外，还必须保留 `/app/resources` 与 `procps`。
- `WEB_ADMIN_EMAILS` 允许为空；非空时决定首个管理员白名单自举注册和管理员入口权限。
- 当前 web runtime 不再用 `FASTAGENT_DEFAULT_*` 或网关 env 去补齐 bot 运行配置；create bot 只读取 owner 的 LLM profiles。
- `web` 共享 `claws_instances` 卷的主要原因是 create bot 时要先创建实例目录；它本身不负责拉起 FastAgent 进程。
- `web` 在用户注册时用 `SRT_DEFAULT_*` 创建默认 SRT pool；管理员 sandbox-runtime 页面通过 `SRT_POOL_STATUS_FILE` 读取 manager 状态。

### 4.2 `supervisor`

`supervisor` 容器依赖：

- `DATABASE_URL=file:/app/storage/sqlite/db.sqlite`
- `FASTAGENT_SANDBOX_MODE`
- `INSTANCES_ROOT=/app/storage/instances`
- `RECONCILE_INTERVAL_MS`
- `SRT_SERVICE_HOST`
- `SRT_POOL_CONFIG_FILE`
- `SRT_POOL_STATUS_FILE`
- `SRT_WORKSPACE_MAP_DIR`
- `SRT_DEFAULT_*` / `SRT_PORT_BASE` / `SRT_PROXY_PORT_BASE` / `SRT_WORKSPACE_BASE_ROOT`

说明：

- Compose 默认复用 `apps/supervisor/node_modules/.bin/fastagent`。
- 运行镜像会预装 `curl`、`gh`、`ffmpeg`、`procps`，其中 `procps` 用于单实例锁和 child process identity 读取容器内 `ps` 信息，避免启动阶段直接报 `Unable to determine process start time for pid 1`。
- `FASTAGENT_BINARY_PATH` 只在显式 override 时才需要。
- 当前 Compose 里的 child `SANDBOX_URL` 不是在 `.env` 里单独填写，而是由 `SRT_SERVICE_HOST` 和 bot owner pool 端口推导。
- `SANDBOX_URL` / `SANDBOX_API_KEY` 不再是 supervisor 启动配置；remote mode 会在 spawn 前从 owner-specific SRT pool 注入给 FastAgent child。
- bot runtime 不再从任何 repo-wide `FASTAGENT_*` env 补齐配置；这些变量如果保留，只服务于 contract smoke 或手工 CLI tooling，不属于默认 Compose 栈的运行面。
- 即使把 `FASTAGENT_SANDBOX_MODE` 设为 `disabled`，当前默认 Compose 仍会启动 `sandbox-runtime` manager；它不需要全局 `SANDBOX_API_KEY`。
- `supervisor` 启动时会自动执行数据库迁移。
- 镜像不会内置用户 API key、OAuth token、设备配对态等个性化 secrets；这类配置仍应在部署时通过环境变量或外部状态注入。

### 4.3 `sandbox-runtime`

当前 Compose 路径会传入：

- `SRT_POOL_CONFIG_FILE`
- `SRT_POOL_STATUS_FILE`
- `SRT_MANAGER_PORT`
- `SANDBOX_COMMAND_EXTRA_PATHS`
- `LOG_LEVEL`

说明：

- 默认路径会从 `infra/docker/sandbox-runtime.versions.env` 里声明的 `@fastagent/sandbox-runtime` 版本构建镜像。
- 默认路径还会通过 `AGENT_BROWSER_NPM_VERSION` 固定安装 `agent-browser`，并通过 `LARK_CLI_NPM_VERSION` 固定安装官方 `lark-cli`；当前公开 Compose 基线只保留 Browserless 远程浏览器路径，不再在 `sandbox-runtime` 镜像内预装本地 Chromium 或执行 `agent-browser install --with-deps`。
- 默认路径还会通过 `BUN_VERSION`、`PNPM_VERSION`、`UV_VERSION` 固定安装 `bun`、`pnpm` 和 `uv`；当前基线分别是 `1.3.13`、`9.15.4`、`0.11.7`。
- 由于上游 `sandbox-runtime` 现在只给 session command 注入系统目录 PATH 基线，WeClaws 的 `sandbox-runtime` 镜像自身会默认设置 `SANDBOX_COMMAND_EXTRA_PATHS=/usr/local/bin`，Compose 还会显式透传同一个值，把镜像里安装到 `/usr/local/bin` 的 `node`、`lark-cli`、`bun`、`pnpm`、`uv` 等 CLI 重新暴露给 remote sandbox 命令执行。
- 运行入口是仓库内的 manager；manager 读取 `srt-pools.json`，为每个 enabled user pool 启动 `srt-child-entry.mjs`。
- `srt-child-entry.mjs` 会让 FastAgent host/tool 层继续看到真实 bot workspace root；`/workspace` 只作为 sandbox 内命令别名和 `cwd` 翻译入口存在。
- Compose 不再给 manager 传全局 `API_KEY`；per-user SRT child 的 API key 由 DB pool config 生成后写入 `srt-pools.json`。
- 当前仓库接受上游 sandbox-runtime 的网络公开 contract：默认允许外网访问，只通过 `SRT_DEFAULT_DENIED_DOMAINS` 写入新用户 pool 做 denylist 收口。
- `DATABASE_URL` 和 `INSTANCES_ROOT` 在当前 Compose 文件里固定写成容器内路径，不从 `infra/compose/.env.example` 读取。
- Compose 还会给 supervisor 注入 `SRT_WORKSPACE_MAP_DIR=/app/storage/sandbox-runtime-private/workspace-map`；workspace map 只允许 supervisor 与 sandbox-runtime 通过私有共享卷读写，不再混在 `/app/storage/instances` 根目录里。
- 当前 Compose 基线会把新用户 pool 默认设为 `SRT_DEFAULT_POOL_SIZE=3`、`SRT_DEFAULT_MIN_READY_PROCESSES=1`、`SRT_DEFAULT_SESSION_TIMEOUT_MS=600000`。
- sandbox 镜像里额外包含的常用 CLI 基线：
  - 浏览器自动化：`agent-browser`
  - Feishu/Lark 官方 CLI：`lark-cli`
  - JS 运行 / 包管理：`bun`
  - Node 包管理：`pnpm`
  - Python 项目 / 包管理：`uv`
  - Python 解释器：`python3`
  - GitHub CLI：`gh`
  - 媒体处理：`ffmpeg`
  - 数据/文件：`jq`、`zip`、`unzip`、`file`
  - 文本提取：`pdftotext` / `pdfinfo`（来自 `poppler-utils`）、`pandoc`
- 这批工具属于 remote sandbox 执行面。
- 默认 Compose 还会额外提供 `browserless` sidecar；受支持路径是 `sandbox-runtime` 内的 `agent-browser -p browserless`

## 5. Build Commands

### 5.1 Build Individual Images

```bash
docker build -f infra/docker/sandbox-runtime.Dockerfile \
  --build-arg AGENT_BROWSER_NPM_VERSION=0.27.0 \
  --build-arg BUN_VERSION=1.3.13 \
  --build-arg LARK_CLI_NPM_VERSION=1.0.32 \
  --build-arg PNPM_VERSION=9.15.4 \
  --build-arg UV_VERSION=0.11.7 \
  -t weclaws/sandbox-runtime:local .

docker build -f infra/docker/supervisor.Dockerfile \
  -t weclaws/supervisor:local .

docker build -f infra/docker/web.Dockerfile \
  -t weclaws/web:local .
```

适用场景：

- 只验证某一个 Dockerfile
- 需要本地提前缓存镜像
- 想把单个镜像推送到独立 registry

### 5.2 Build Full Compose Stack

默认路径：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml build
```

生产环境如果直接使用已发布的 GHCR 镜像，不需要再本地 build；改用：

```bash
docker compose \
  --env-file infra/compose/.env \
  -f infra/compose/docker-compose.yml \
  -f infra/compose/docker-compose.prod.yml \
  pull

docker compose \
  --env-file infra/compose/.env \
  -f infra/compose/docker-compose.yml \
  -f infra/compose/docker-compose.prod.yml \
  up -d
```

如果宿主机目录还不存在，先创建：

```bash
mkdir -p /srv/weclaws/data/sqlite /srv/weclaws/data/instances /srv/weclaws/data/sandbox-user-workspaces /srv/weclaws/data/sandbox-runtime-private
```

一个可直接照抄的生产 override 片段：

```bash
cat >> infra/compose/.env <<'EOF'
WECLAWS_DATA_ROOT=/srv/weclaws/data
APP_BASE_URL=https://weclaws.example.com
WEB_PORT=3000
EOF
```

如果只验证 sandbox 扩容后的 CLI 基线，优先跑：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml build sandbox-runtime
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'agent-browser --help'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'lark-cli --version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'bun --version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'pnpm --version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'uv --version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'gh --version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'ffmpeg -version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'pdftotext -v'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'pandoc --version'
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh -lc 'jq --version && file --version'
```

## 6. Compose Topology

当前 Compose 栈包含四个服务：

- `browserless`
- `sandbox-runtime`
- `supervisor`
- `web`

卷映射：

- `claws_sqlite` -> `web:/app/storage/sqlite`
- `claws_sqlite` -> `supervisor:/app/storage/sqlite`
- `claws_instances` -> `web:/app/storage/instances`
- `claws_instances` -> `supervisor:/app/storage/instances`
- `claws_instances` -> `sandbox-runtime:/app/storage/instances`
- `sandbox_user_workspaces` -> `sandbox-runtime:/app/apps/sandbox-runtime/user-workspaces`
- `sandbox_runtime_private` -> `supervisor:/app/storage/sandbox-runtime-private`
- `sandbox_runtime_private` -> `web:/app/storage/sandbox-runtime-private`
- `sandbox_runtime_private` -> `sandbox-runtime:/app/storage/sandbox-runtime-private`

说明：

- `web` 和 `supervisor` 必须共享同一份 `claws_instances`，因为 bot 创建目录和 runtime 启动都依赖同一根实例目录。
- `sandbox-runtime` 现在也必须挂载同一份 `claws_instances` 到相同绝对路径；否则 workspace map 就算命中，runtime 也无法访问 FastAgent child 实际传入的真实 `cwd`。
- `srt-pools.json`、`srt-pool-status.json` 和 workspace map 现在必须单独放在私有 `sandbox_runtime_private` 卷里，只给 `web`、`supervisor` 和 `sandbox-runtime` 共享；不要再把它写进 `instances` 根目录。
- `sandbox-runtime` 仍然是独立 HTTP / Socket.IO 服务边界。
- `browserless` 提供远程浏览器会话后端；默认由 `sandbox-runtime` 内的 `agent-browser -p browserless` 通过 Compose 内部服务名访问。
- base Compose 不会给 `browserless` 配置宿主机 `ports`；默认只允许内部 Compose 网络访问。
- 当前 Compose 已为 `sandbox-runtime` 固定配置：
  - `cap_drop: [ALL]`
  - `cap_add: [SYS_ADMIN, NET_ADMIN]`
  - `cgroup: private`
  - `security_opt: [seccomp=unconfined, apparmor=unconfined]`
- `sandbox-runtime` 镜像构建会删除 `/etc/passwd-`、`/etc/shadow-`、`/etc/group-` 和 `/etc/gshadow-`，运行期 wrapper 也会 deny 这些备份路径与敏感 `/proc` 入口；Linux 下不再直接 deny `/etc/mtab`，因为它是 `/proc/mounts` 的符号链接，硬绑 `/dev/null` 会让 bubblewrap 启动失败。
- Ubuntu 24 上如果 `docker inspect` 仍显示 `AppArmor=docker-default`，bubblewrap 可能在 mount namespace 阶段直接报 `Failed to make / slave: Permission denied`；更新 Compose 后记得 `up -d --force-recreate sandbox-runtime`
- 生产 override 改用 `${WECLAWS_DATA_ROOT}` bind mount 后，SQLite、instances、sandbox user workspaces、sandbox-runtime 私有 config/status 目录都会直接出现在宿主机目录中，便于备份、迁移和排障；如果必须使用 bind mount，建议固定为 `/srv/weclaws/data` 这类不含个人用户名或项目临时路径的标准路径。最终避免 sandbox 内看到宿主源路径仍依赖运行期 deny `/proc/*/mountinfo` / `/proc/mounts`。

## 7. 启动流程

### 7.1 Prepare Compose Env

```bash
cp infra/compose/.env.example infra/compose/.env
```

说明：

- `infra/compose/.env.example` 现在只把硬必填项保持为未注释。
- 其他参数都会以注释形式保留在文件里；需要覆盖默认行为时再取消注释，不要因为它们被注释就误判成“不支持”。

最少需要修改：

- `APP_BASE_URL`
- `BETTER_AUTH_SECRET`

按场景补充：

- `WECLAWS_DATA_ROOT`
  - 只有在叠加 `docker-compose.prod.yml` 做生产部署时才需要取消注释并设置；本地默认 Compose 不使用它
  - 推荐固定成 `/srv/weclaws/data` 这类标准路径，避免 sandbox 内可见的 mount 元信息暴露个人用户名或临时目录
- `WEB_ADMIN_EMAILS`
  - 需要首个管理员白名单自举注册或管理员入口时填写；否则可留空
- `WEB_USER_BOT_LIMIT`
  - 需要限制每个用户可创建 bot 数量时再取消注释

补充说明：

- 默认 Compose 栈不再接受 repo-wide LLM fallback env；部署后的 bot 必须在 web 里先创建并绑定用户级 LLM profile
- 如果只是要跑 `pnpm test:fastagent-contract` 之类的 smoke，请在临时 shell 里单独导出 `FASTAGENT_API_KEY` 与 `FASTAGENT_MODEL` / `FASTAGENT_PROVIDER`（或对应 `FASTAGENT_DEFAULT_*` 等价变量），不要把它们混回长期部署 env

### 7.2 Start Default Stack

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml up --build -d
```

### 7.3 数据库初始化行为

- `supervisor` 启动时会自动运行 `migrateDatabase()`。
- `web` 容器不会执行 `pnpm db:migrate`，也不应该被当成 migration 容器使用。
- 首次启动时，SQLite 文件会在共享卷中自动创建。

如果需要手工重跑 migration，请在 `supervisor` 容器里执行：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml \
  exec supervisor pnpm --filter @weclaws/db db:migrate
```

## 8. 运行确认与诊断入口

### 8.1 Check Service State

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml ps
```

正常情况下：

- `sandbox-runtime` 应显示为 `healthy`
- `web` 应显示为 `healthy`
- `supervisor` 应显示为 `Up`

### 8.2 Check HTTP Endpoints

```bash
curl -i http://localhost:3000/login
curl -i http://localhost:8788/health
```

正常情况下：

- `/login` 返回 `200`
- `/health` 返回 `200`

### 8.3 Check Logs

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml logs -f web
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml logs -f supervisor
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml logs -f sandbox-runtime
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml logs -f browserless
```

### 8.4 Real Turn Smoke

仅看 `/health` 和 `docker compose ps` 还不够。

真实 runtime 验证至少要满足其中之一：

- 完成一次 bot 登录并收到二维码
- 完成一次真实 turn，确认 sandbox session 能创建并执行命令
- 至少成功跑通一次 `POST /sessions` + `POST /commands`

如果要做真实 turn 验证，至少确认当前 Compose 基线仍保持 `SRT_DEFAULT_POOL_SIZE=3`、`SRT_DEFAULT_SESSION_TIMEOUT_MS=600000`；若被本机 shell 覆盖回较小值，session timeout + reconnect 更容易把 pool 顶满。

## 9. Daily Operations

### 9.1 Rebuild A Single Service

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml build web
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml build supervisor
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml build sandbox-runtime
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml build browserless
```

### 9.2 Restart A Single Service

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml restart web
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml restart supervisor
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml restart sandbox-runtime
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml restart browserless
```

### 9.3 Inspect Resolved Compose Values

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml config
```

### 9.4 Enter A Running Container

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec supervisor sh
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec sandbox-runtime sh
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml exec browserless sh
```

`web` 容器是精简运行层，不建议把它当调试入口或工具容器使用。

### 9.5 Stop The Stack

保留卷：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml down
```

删除卷：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml down -v
```

警告：

- `down -v` 会删除 SQLite 和实例目录卷。
- 这会清空当前 Compose 路径下的持久化数据。

## 10. Troubleshooting

### 10.1 `docker compose config` 里出现了意外值

优先检查当前 shell 是否已经导出了：

- `APP_BASE_URL`
- `BETTER_AUTH_SECRET`
- `WEB_ADMIN_EMAILS`
- `WEB_USER_BOT_LIMIT`
- `SRT_DEFAULT_*`
- `SRT_PORT_BASE`
- `SRT_PROXY_PORT_BASE`

这是最常见的“明明改了 `infra/compose/.env` 但容器里还是旧值”的原因。

### 10.2 `web` 无法 healthy 或 `/login` 非 200

优先检查：

- `APP_BASE_URL`
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `WEB_ADMIN_EMAILS`

如果 create bot 页面无法提交，优先确认当前账号是否已经在 `/settings` 创建至少一个可用的 LLM profile，并且该 bot 绑定了正确的 profile。

### 10.3 `supervisor` 启动了，但 bot 在真实 turn 才报 `runtime_error`

这通常不是异常现象。

原因：

- remote sandbox session 是懒建立的
- owner-specific `SANDBOX_URL` / `SANDBOX_API_KEY` 不会在 child process 启动瞬间就被验证

因此：

- `process_started`
- `qr_code`
- `running(restored)`

都不能证明 sandbox 已经成功连通。

### 10.4 `sandbox-runtime` 健康正常，但命令执行持续失败

重点检查：

- 当前 runtime 是否真的支持 sandbox worker 所需的 Linux 隔离原语
- `cap_drop` / `cap_add` / `cgroup` / `security_opt` 是否被宿主机平台吞掉
- 用 `docker inspect <sandbox-container> --format 'AppArmor={{.AppArmorProfile}} CapDrop={{json .HostConfig.CapDrop}} CapAdd={{json .HostConfig.CapAdd}} Cgroupns={{.HostConfig.CgroupnsMode}} SecurityOpt={{json .HostConfig.SecurityOpt}} Privileged={{.HostConfig.Privileged}}'` 确认当前容器不是 `AppArmor=docker-default`，并且保留 `CapDrop=["ALL"]`、`CapAdd=["SYS_ADMIN","NET_ADMIN"]` 与 `Cgroupns=private`；Ubuntu 24 上 AppArmor 未放开是 bubblewrap 命令执行失败的高频根因
- 当前 `sandbox-runtime` 容器日志里是否已经打印安装了 workspace override 的信息

记住：

- `/health` 正常不代表 worker 一定可执行命令
- `journalctl -k` 没抓到 `apparmor` / `DENIED` 日志，也不能单独证明 AppArmor 没介入；以容器实际 `AppArmorProfile` 为准
- 常见现场症状是 `/health` 正常、bot 能启动，但 `ls` 这类命令返回 `bwrap: Failed to make / slave: Permission denied`
- 如果刚更新过 Compose 安全参数，务必执行 `docker compose ... up -d --force-recreate sandbox-runtime`，不要只 `restart`
- 至少要补一轮实际命令执行验证

### 10.5 `POOL_EXHAUSTED`

这是当前真实 turn smoke 的常见瓶颈。

处理方式：

- 不要在真实 turn 验证环境把 `SRT_DEFAULT_POOL_SIZE` 固定为 `1`
- 当前 Compose 基线建议值是 `SRT_DEFAULT_POOL_SIZE=3`
- 同时建议保持 `SRT_DEFAULT_SESSION_TIMEOUT_MS=600000`，避免短 session timeout 放大 reconnect 抖动
- 需要定位单个用户 pool 时，优先看管理员 `/admin/sandbox-runtime` 页面里的 pool 状态、端口和资源采样

## 11. Backup And Upgrade

### 11.1 What To Back Up

最关键的是两份持久化数据：

- SQLite 数据卷
- `claws_instances` 卷

只保留其一会导致状态不一致或恢复不完整。

### 11.2 Recommended Upgrade Order

1. 停止 `web`
2. 停止 `supervisor`
3. 按需决定是否保留 `sandbox-runtime`
4. 备份 SQLite 与实例目录卷
5. 更新镜像或代码
6. 先起 `sandbox-runtime`
7. 再起 `supervisor`
8. 最后起 `web`

## 12. Current Conclusions

- 默认 Compose 路径已经是自包含的 repo-local 构建，不依赖 FastAgent 上游仓库的 Dockerfile。
- `web` 的运行时环境现在必须由 Compose 显式注入，不能再把宿主机根 `.env` 当成容器内隐式依赖。
- `supervisor` 是当前默认的 migration owner。
- 判断 Docker 路径“真的可用”的最低标准，不只是三服务起来，而是至少完成一次真实 sandbox 命令执行或真实 turn。
