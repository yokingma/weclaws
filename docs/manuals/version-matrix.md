# WeClaws Version Matrix

## 1. 文档定位

本文档记录仓库已经锁定或实际使用的关键版本基线。

当前事实来源以代码和构建配置为准：

- `VERSION`
- `package.json`
- `apps/web/package.json`
- `apps/supervisor/package.json`
- `packages/db/package.json`
- `packages/shared/package.json`
- `infra/docker/*.Dockerfile`
- `infra/docker/sandbox-runtime.versions.env`
- `infra/compose/.env.example`

## 2. Product Release Version

| Area | Current Baseline | Source |
| --- | --- | --- |
| WeClaws product version | `0.2.1` | repo root `VERSION` |

说明：

- `VERSION` 是产品版本的唯一真相源
- 根 `package.json` 与各 workspace `package.json#version` 必须通过 `pnpm run version:sync` 与 `VERSION` 保持一致
- 提交前可运行 `pnpm run version:check` 校验版本未漂移

## 3. Core Toolchain

| Area | Current Baseline | Source |
| --- | --- | --- |
| Workspace package manager | `pnpm@9.15.4` | root `package.json#packageManager` |
| Node.js engine floor | `>=20.0.0` | root `package.json#engines.node` |
| TypeScript | `^5.7.3` | root `package.json` |
| Vitest | `^4.1.6` | root `package.json` |

### Node.js 建议

- 本地开发推荐继续使用 `20.18.1`
- Docker 运行层当前都基于 Node 20
- `better-sqlite3` 在 Node `25.x` 上不建议作为当前仓库基线使用

## 4. Docker Runtime Baseline

| Image | Current Base |
| --- | --- |
| `web` | `node:20-bookworm-slim` |
| `supervisor` | `node:20-bookworm-slim` |
| `sandbox-runtime` | `node:20-bookworm` |

说明：

-  Dockerfile 固定的是 Node major `20`
- 还没有把 patch 版本钉死到镜像 tag

## 5. Web Stack

| Dependency | Current Version |
| --- | --- |
| `next` | `^16.2.6` |
| `react` | `^19.2.4` |
| `react-dom` | `^19.2.4` |
| `better-auth` | `^1.6.11` |
| `zod` | `^4.3.6` |
| `qrcode` | `^1.5.4` |
| `tailwindcss` | `^4.2.2` |

补充：

- `apps/web` 已基于 App Router
- UI 依赖 Next `standalone` 输出做生产镜像

## 6. Supervisor And Runtime Stack

| Dependency | Current Version |
| --- | --- |
| `@fastagent/cli` | `0.8.0` |
| `better-sqlite3` | `^12.10.0` |
| `esbuild` | `^0.28.0` |
| `tsx` | `^4.20.5` |

说明：

- supervisor 默认优先使用 repo-local `apps/supervisor/node_modules/.bin/fastagent`
- `FASTAGENT_BINARY_PATH` 只作为显式 override

## 7. Database Stack

| Dependency | Current Version |
| --- | --- |
| `drizzle-orm` | `^0.45.2` |
| `drizzle-kit` | `^0.30.6` |
| `better-sqlite3` | `^12.10.0` |
| `@types/better-sqlite3` | `^7.6.12` |

## 8. Sandbox Runtime Baseline

| Area | Current Baseline |
| --- | --- |
| default Compose npm package | `@fastagent/sandbox-runtime@0.5.7` |
| default Compose browser CLI | `agent-browser@0.27.0` |
| default Compose Feishu/Lark CLI | `@larksuite/cli@1.0.32` |
| default Compose remote browser backend | `ghcr.io/browserless/chromium:latest` |
| default Compose JS runtime / package manager | `bun@1.3.13` |
| default Compose Node package manager | `pnpm@9.15.4` |
| default Compose Python project / package manager | `uv@0.11.7` |
| default Compose GitHub CLI | distro `gh` package |
| manager health port | `8788` |
| default per-user pool size | `3` |
| default per-user session timeout | `600000ms` |

说明：

- 这个版本由 `infra/docker/sandbox-runtime.versions.env` 里的 `SANDBOX_RUNTIME_NPM_VERSION=0.5.7` 控制；Compose env 只保留临时 override 入口
- `agent-browser` 版本由 `infra/compose/.env.example` 里的 `AGENT_BROWSER_NPM_VERSION=0.27.0` 控制
- `lark-cli` 版本由 `infra/compose/.env.example` 里的 `LARK_CLI_NPM_VERSION=1.0.32` 控制
- `bun` 版本由 `infra/compose/.env.example` 里的 `BUN_VERSION=1.3.13` 控制
- `pnpm` 版本由 `infra/compose/.env.example` 里的 `PNPM_VERSION=9.15.4` 控制，并与根 `package.json#packageManager` 对齐
- `uv` 版本由 `infra/compose/.env.example` 里的 `UV_VERSION=0.11.7` 控制
- 上游 `sandbox-runtime` 当前只给 session command 注入系统目录 PATH 基线；WeClaws 的 `sandbox-runtime` 镜像会默认导出 `SANDBOX_COMMAND_EXTRA_PATHS=/usr/local/bin`，Compose 再显式透传同一个值，把镜像里安装到 `/usr/local/bin` 的 `node`、`lark-cli`、`bun`、`pnpm`、`uv` 重新暴露给 remote sandbox 命令执行
- 当前 Compose 默认网络策略已跟随上游 `sandbox-runtime@0.5.7` 的 denylist 公开语义：通过 `SRT_DEFAULT_DENIED_DOMAINS` 写入每个 user pool，空值表示 allow-by-default
- 当前 sandbox 镜像会预装 `lark-cli`、系统 `python3`、`gh`、`ffmpeg`、`jq`、压缩包工具、PDF / `.docx` 文本提取工具；公开 Compose 基线只保留 Browserless 远程浏览器路径，不再预装本地 Chromium 或执行 `agent-browser install --with-deps`
- 当前默认浏览器执行路径由 `sandbox-runtime` 内的 `agent-browser@0.27.0` 连接 Compose `browserless` sidecar；`--cdp` 保留为调试兜底路径

## 9. Runtime Config Defaults

bot runtime LLM 配置不再从 env 模板提供默认 provider/model。bot 必须绑定用户级 LLM profile。

 env 模板保留的是 per-user SRT pool 默认值：

| Setting | Default |
| --- | --- |
| `SRT_DEFAULT_POOL_SIZE` | `3` |
| `SRT_DEFAULT_MIN_READY_PROCESSES` | `1` |
| `SRT_DEFAULT_SESSION_TIMEOUT_MS` | `600000` |
| `SRT_DEFAULT_MAX_CONCURRENT_INIT` | `1` |
| `SRT_DEFAULT_HEALTH_CHECK_INTERVAL_MS` | `60000` |
| `SRT_DEFAULT_PORT_RANGE_WIDTH` | `100` |
| `SRT_PORT_BASE` | `31000` |
| `SRT_PROXY_PORT_BASE` | `9100` |

建议：

- 本地开发前显式确认根 `.env` 里的 SRT config/status 文件路径和端口基线
- Compose 部署前显式确认 `infra/compose/.env` 里的 `SRT_DEFAULT_*` 是否需要覆盖

## 10. 升级规则

### 10.1 需要同步更新文档的升级

以下依赖变化后，应同步更新手册：

- `next`
- `react`
- `better-auth`
- `drizzle-orm`
- `better-sqlite3`
- `@fastagent/cli`
- `@fastagent/sandbox-runtime`

### 10.2 需要同步更新的文档

- `docs/manuals/fastagent-cli-contract.md`
- `docs/manuals/env-and-secrets-matrix.md`
- `docs/manuals/docker-deployment-runbook.md`

### 10.3 建议

- 一次只升级一类关键依赖
- 先跑本地 `pnpm build` / `pnpm test` / `pnpm typecheck`
- 再验证 Compose 路径
- FastAgent CLI 或 sandbox-runtime 版本升级后，优先重新检查 runtime contract 和 deployment runbook
