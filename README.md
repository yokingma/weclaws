# WeClaws

WeClaws 是一个面向微信多用户 agent 系统 bot 的控制面，目标是把 bot 做成像云服务一样可一键部署、统一管理、多人共用且安全隔离的能力。每个用户都可以拥有自己的 bot，并按需多开。底层通过 `@fastagent/cli` 对接 bot 执行引擎，再用 `@fastagent/sandbox-runtime` 提供隔离的远程执行层。

## 项目是什么

这是一个 monorepo，按职责拆成四块：

- `apps/web`：控制台、HTTP API、SSE、认证
- `apps/supervisor`：真正的 runtime owner，负责拉起 FastAgent child process 并收敛状态
- `packages/db`：SQLite/Drizzle schema、migrations、repositories
- `packages/shared`：跨 workspace 的稳定 contract、常量和路径规则

WeClaws 的目标很直接：把 bot 的运行、数据和部署收口到一套可维护、可验证、像云服务一样好用的控制面里。

## 功能亮点

- Web 控制台 + API + SSE，状态实时刷新
- 一键部署和统一管理 bot，降低日常运维成本
- 每个用户可拥有多个 bot，适合多账号、多场景并行运行
- supervisor 统一管理 bot 生命周期，web 不直接碰本地进程
- `sandbox-runtime` 按用户隔离 pool，兼顾权限边界和可观测性
- `@fastagent/cli` 作为执行引擎，负责对接 bot 运行 contract
- 内置 managed skills，同步、部署、排障更直接
- 提供本地开发和 Docker Compose 两条清晰路径

## 怎么使用 / 部署

### 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev:web
pnpm dev:supervisor
```

如果需要初始化数据库：

```bash
pnpm db:generate
pnpm db:migrate
```

### Docker Compose

```bash
cp infra/compose/.env.example infra/compose/.env
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml up -d
```

生产部署使用预构建镜像：

```bash
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.prod.yml pull
docker compose --env-file infra/compose/.env -f infra/compose/docker-compose.yml -f infra/compose/docker-compose.prod.yml up -d
```

部署前重点检查：

- `APP_BASE_URL`
- `BETTER_AUTH_SECRET`
- `WECLAWS_DATA_ROOT`

更详细的部署说明见 [Docker Runbook](docs/manuals/docker-deployment-runbook.md)。

## 怎么开发

先读 [AGENTS.md](AGENTS.md)，再按需查看对应 workspace 的 `PATTERNS.md` 和 `CHANGELOG.md`。

常用命令：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm --filter @weclaws/web test
pnpm --filter @weclaws/supervisor test
pnpm --filter @weclaws/db test
```

开发时建议：

- 先写测试，再改实现
- 保持改动小而集中
- 只跑能覆盖当前改动的最小验证集
- 代码或行为变化时，同步更新对应 workspace 的 `CHANGELOG.md` 和 `PATTERNS.md`

## 未来规划

- 更完整的多用户管理和权限体验
- 更强的运行态可观测性、告警和排障能力
- 更丰富的 sandbox 工具与 skills 生态
- 更平滑的部署、升级和数据迁移路径

## 更多文档

- [docs/manuals/README.md](docs/manuals/README.md)
- [docs/manuals/docker-deployment-runbook.md](docs/manuals/docker-deployment-runbook.md)
