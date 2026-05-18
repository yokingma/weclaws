# CHANGELOG

## 2026-05-18

### Changed

- 已按上游 `fix(sandbox-runtime): make command path expansion explicit` 收口 WeClaws 适配：Compose 现在会显式注入 `SANDBOX_COMMAND_EXTRA_PATHS=/usr/local/bin`，repo-local SRT manager child env 也会继续转发它，避免上游把 session command PATH 基线收窄到系统目录后，镜像内安装到 `/usr/local/bin` 的 `lark-cli`、`bun`、`pnpm`、`uv` 在 remote sandbox 里失效。
- 已重新核对 `@fastagent/sandbox-runtime@0.5.7` 发布包与上游源码；WeClaws 当前依赖的 `WorkspaceManager`、`SandboxProcessPool`、`SandboxAPI` 以及 `@anthropic-ai/sandbox-runtime` `sandbox-manager` patch 点仍保持兼容，因此这次只同步事实文档和 Compose 配置回归测试。
- repo-local FastAgent CLI 的事实文档与 Compose 配置回归测试现已对齐到 `@fastagent/cli@0.8.0`。
- `sandbox-runtime` 镜像构建基线现在固定预装官方 `@larksuite/cli@1.0.32`，并通过新的 `LARK_CLI_NPM_VERSION` build arg 暴露版本钉住入口；Compose、版本矩阵与部署手册已同步更新。
- managed skills 默认同步清单现在纳入官方公开的 Feishu/Lark 24-skill bundle：`lark-*` 目录按 upstream-vendored 方式完整收编，保留 `references/`、`scripts/`、`assets/` 等运行资料，不包含未进入官方公开 catalog 的 `lark-vc-agent`。

## 2026-05-14

### Fixed

- remote sandbox 的 worker bootstrap 现在会在最终 bwrap alias bind 前先创建 `/workspace` / `/state` 挂载点，避免 Linux 下根文件系统已被 `--ro-bind / /` 后，`bwrap --bind <real> /workspace` 因无法创建目标目录而让所有 `bash` 命令和根目录 `glob` 直接失败。
- remote sandbox 不再把返回给 FastAgent host/tool 层的 `session.workspacePath` 改写成字面 `/workspace`；对外保持真实 bot `workspace` 路径，避免文件、搜索和 `bash` 工具在宿主进程里先执行 `realpath('/workspace')` 后直接失败。`/workspace` 与 `/state` 仍只作为 sandbox 内 bwrap alias 和 `cwd` 翻译入口保留。
- remote sandbox 现在会把当前 bot 的真实 `workspace` / `data` 目录额外 bind 到字面 `/workspace` / `/state`，不再只翻译 `cwd`；即使上游 sandbox-runtime 重建 config 时丢掉 WeClaws 的自定义 alias 字段，worker bootstrap 也会从当前 bot 的 write roots 推导出这两个 bind，让 `bash /workspace/...` 和上游文件工具生成的绝对虚拟路径命中当前 bot scope。
- `sandbox-runtime-session-security` 与 `sandbox-runtime-worker-bootstrap` 回归测试已补上 virtual path alias 断言，锁住 `/workspace -> bot workspace`、`/state -> bot data` 的实际 bwrap bind 行为。

### Changed

- `apps/supervisor` 依赖的 `better-sqlite3` 已升级到 `^12.10.0`，对齐 `better-auth@^1.6.11` 当前要求的 SQLite 驱动 peer baseline。
- repo-local FastAgent CLI 基线已升级到 `@fastagent/cli@0.7.5`，并同步更新 `pnpm-lock.yaml`、CLI contract、部署手册、版本矩阵和 Compose 配置回归测试。
- Compose 默认 `sandbox-runtime` npm 基线已升级到 `@fastagent/sandbox-runtime@0.5.5`，并同步更新版本矩阵、部署手册、路径语义文档、PATTERNS 和 Compose 配置回归测试。
- 已核对 `@fastagent/sandbox-runtime@0.5.5` 发布包和其 `@anthropic-ai/sandbox-runtime@0.0.42` 依赖仍包含当前 wrapper 直接 patch 的内部 `dist/**` 文件。

## 2026-05-12

### Changed

- 托管 `agent-browser` skill 与相关 README / manuals / patterns 文档已进一步收口到 remote-only 契约：只允许 `agent-browser -p browserless` 或显式远程 `--cdp`，不支持在 nested sandbox、`sandbox-runtime` 或宿主机本地启动浏览器。
- Browserless / 远程 CDP 不可用时的预期行为已明确为“直接报阻塞”，不再允许把本地浏览器启动、本地浏览器安装或宿主机会话当作回退路径。
- `agent-browser` skill 现已补充 Browserless direct 的场景划分：一次性截图、PDF、scrape 等 one-shot 任务可直接走 Browserless，但当前不单独拆托管 Browserless skill。
- 托管 `ppt-skill` 现已进入 `manifest.json` 默认同步清单；其交付仍以生成产物优先，保留模板、参考资料和 Node 校验脚本，并明确不依赖 remote sandbox 内的本地浏览器路径。
- `ppt-skill` 两套模板已补上离线字体策略：内嵌关键拉丁字形，中文继续走系统字体栈，避免 Google Fonts 不稳定导致远程预览、截图或本地离线打开时版式漂移。
- `ppt-skill` 交付契约现已进一步收紧为本地分发：生成 deck 时必须同级携带 `assets/motion.min.js` 与 `assets/lucide.min.js`，模板不再依赖 `unpkg` / `jsDelivr` 这类外网运行时 CDN。
- `ppt-skill` 两套模板现已内联默认 favicon，静态预览不再额外请求 `/favicon.ico`，避免本地 HTTP smoke 或远程截图链路出现无意义的 404 控制台噪音。
- 托管 `editorial-card-screenshot` skill 现已进入 `manifest.json` 默认同步清单；其截图链路继续固定为 Browserless direct，一次性 PNG 导出不再依赖本地 Chrome / Chromium 或 `file://` 路径。

## 2026-05-11

### Changed

- 发布基线已同步到 WeClaws `0.2.0`，并把 repo-local FastAgent CLI 固定到 `@fastagent/cli@0.6.50`。
- Compose 默认 `sandbox-runtime` npm 基线已升级到 `@fastagent/sandbox-runtime@0.5.2`，同步更新 README、版本矩阵、部署手册、路径语义文档和 Compose 配置回归测试。
- 已核对 `@fastagent/sandbox-runtime@0.5.2` 发布包和其 `@anthropic-ai/sandbox-runtime@0.0.42` 依赖仍包含当前 wrapper 直接 patch 的内部 `dist/**` 文件。

## 2026-05-10

### Changed

- sandbox-runtime manager 的 `/health` 现在返回聚合后的 manager/pool 状态，不再只返回静态 `{"ok":true}`。
- sandbox-runtime manager 在 reconcile 时会探测每个 per-user SRT child 的 `/pool/status`，把 `activeSessions`、`busyProcesses`、`readyProcesses` 和 `lastHealthAt` 写入 `srt-pool-status.json`；启动宽限期后探活失败的 child 会被重启。
- sandbox-runtime manager 停 child 时会先发 `SIGTERM` 并等待宽限期，未退出时再发 `SIGKILL`，避免僵住的 child 长期假活。
- sandbox-runtime manager 现在会串行执行 reconcile / stopAll，并用 UUID status 临时文件名做原子写入，避免 interval 与 file watcher 并发触发时重复重启同一 pool 或写坏 `srt-pool-status.json`。
- reconcile 现在会消费 `bot_instances.qr_reissue_requested_at`：如果 bot 仍在运行，supervisor 先标记 `stopping` 并停掉当前 child；child 完全停稳后，再清理 FastAgent 登录态文件并重新拉起出码链路。
- 新增 runtime 登录态清理步骤，当前固定清掉 `IM_GATEWAY_DATA_DIR` 下的 `accounts-roster.jsonl`、`accounts-runtime.jsonl` 和 `bindings.jsonl`，用于“重新扫码/重新出码”而不是微信通道内真实 logout。
- 新增 integration-style reconcile 回归测试，锁住“已登录 runtime 触发 Reissue QR 后会重新回到 `waiting_for_qr`”的行为。

## 2026-05-08

### Changed

- CNB 远程 `sandbox-runtime` 镜像构建的 `AGENT_BROWSER_NPM_VERSION` 已同步到 `0.27.0`，并新增 Compose 配置回归测试锁住发布流水线与 Dockerfile 默认值一致，避免远程 latest 镜像继续被 build-arg 覆盖回旧版 `agent-browser`。
- `sandbox-runtime` 镜像已移除本地 Chromium 与 `agent-browser install --with-deps` 构建路径；当前公开 Compose 基线只保留 `agent-browser -p browserless` 远程浏览器能力，不再支持在 nested sandbox 内本地 launch 浏览器。
- `compose-config` 回归测试、部署手册、版本矩阵和托管技能说明已同步收口到 Browserless-only 契约，避免继续暗示 ARM64 或其他环境存在本地 Chromium fallback。
- 默认 Compose 拓扑新增 `browserless` sidecar，作为 WeClaws 受支持的远程浏览器后端；`sandbox-runtime` 继续保留 `agent-browser` 客户端与文件输出边界，但真实浏览器进程现在优先交给 sidecar 承载。
- `sandbox-runtime` 的 Compose / child allowlist 已新增 `BROWSERLESS_API_URL` 与 `BROWSERLESS_API_KEY` 透传，允许 nested sandbox 内的 `agent-browser` 直接走 `-p browserless` 连接 sidecar。
- Compose 默认 `agent-browser` 基线已升级到 `0.27.0`，并同步把 Browserless 契约、部署手册、版本矩阵和托管技能说明对齐到 `skills get core --full` 与 `-p browserless` 主路径。

### Notes

- `agent-browser --cdp "<ws-url>"` 仍保留为兜底/调试路径，但不再作为默认产品接入方式。

## 2026-05-07

### Changed

- `sandbox-runtime` 运行镜像现在额外预装 `gh`，让默认同步的 `github` 托管技能在 remote sandbox 执行面具备基础 CLI；README、部署手册、版本矩阵和托管技能手册已同步补齐。
- `infra/compose/docker-compose.prod.yml` 的公开镜像前缀已切到 `ghcr.io/baseclaw/weclaws/*:latest`，避免公开仓库继续默认引用旧私有 registry；对应 Compose 回归测试也已同步到 GHCR 基线。

### Fixed

- 修正 remote sandbox restored session 的 `cwd` 恢复路径：如果上游恢复出来的 session 丢失了 WeClaws 注入的内部真实路径 marker，wrapper 现在会回退到 `workspaceMapFile + workspaceId` 重新解析真实 bot workspace，并继续推导 `/state -> dataDir`，避免运行中的 bash/命令调用突然退回字面 `/workspace` 路径、表现为 sandbox 会话丢失。
- `sandbox-runtime-session-security` 回归测试新增 restored-session 场景，锁住“只剩 `workspaceId + /workspace` 时仍能恢复真实 cwd”的行为。

## 2026-05-04

### Fixed

- 修正 Linux remote sandbox 的 writable rebind 注入顺序：worker bootstrap 不再把补救 `--bind` 盲目插到最终 `--` 前面，而是固定插回 PID namespace 阶段之前，避免把 `--bind` 落到 `--unshare-pid` / `--proc` 之后导致真实命令执行链失效。
- 修正 Linux remote sandbox 的 mount 表收口实现：session 强制 deny 不再直接把 `/etc/mtab` 绑定到 `/dev/null`，worker bootstrap 也会剥掉历史 pool 里遗留的同类 argv；此前该规则会让 bubblewrap 在启动阶段直接报 `Can't create file at /etc/mtab`，导致任意命令无法执行。
- `srt-pools.json` 渲染现在会自动净化历史 pool 里的 `/etc/mtab` deny，避免数据库里残留的旧 `defaultDenyRead` 再次把 Linux remote sandbox 命令执行链打坏。
- `sandbox-runtime-worker-bootstrap` 回归测试新增真实 bwrap argv 顺序样本，显式锁住 `--bind` 必须先于 `--unshare-pid` / `--proc`。

## 2026-05-03

### Fixed

- remote sandbox 文件系统限制补上父目录级 deny：`storage`、`instances`、`SRT_WORKSPACE_BASE_ROOT`、pool `basePath`、`sandbox-runtime-private` 和 `metadataRoot` 现在都会同时 deny 目录本身与递归内容，避免 bot 通过目录枚举看到其他实例、private config 或其他用户 runtime workspace。
- remote sandbox denyRead 继续补上 `/etc` 账号数据库备份文件、`/etc/mtab` 和敏感 `/proc` 入口，降低通过 `passwd-` / `shadow-`、mount 表、`cmdline`、`environ`、`kallsyms`、cgroup 枚举泄露容器/宿主细节的风险。
- `sandbox-runtime` 镜像构建会删除 `/etc/passwd-`、`/etc/shadow-`、`/etc/group-`、`/etc/gshadow-`，Compose 也改为 `cap_drop: [ALL]` 后只加回 bubblewrap 所需的 `SYS_ADMIN` / `NET_ADMIN`，并使用 private cgroup namespace。
- worker bootstrap 的 writable rebind 回归测试已覆盖这些父目录级 deny，确保当前 bot 的 `workspace` / `data` / `stateRoot` 仍能在最终 bwrap 命令里恢复可写。
- 同步修正 FastAgent CLI `0.6.42` 与 sandbox-runtime `0.5.0` 的事实文档和 Compose 回归测试，避免版本矩阵与当前依赖漂移。

## 2026-05-02

### Changed

- supervisor remote sandbox config 已从全局 `SANDBOX_URL` / `SANDBOX_API_KEY` 切换为 per-user SRT pool：
  - `getSupervisorConfig()` 解析 `SRT_POOL_CONFIG_FILE`、`SRT_POOL_STATUS_FILE`、`SRT_WORKSPACE_MAP_DIR`、`SRT_SERVICE_HOST` 和 shared `SRT_DEFAULT_*`
  - remote mode 不再要求全局 sandbox URL/API key
  - supervisor 启动和每轮 reconcile 前会从 DB 渲染 `srt-pools.json`
  - `ProcessManager` 在 spawn 前确保 bot owner 的 SRT pool，并注入 owner-specific `SANDBOX_URL` / `SANDBOX_API_KEY`
  - owner pool 被禁用时，bot 会收敛成 `failed + SRT_POOL_DISABLED`
- `infra/sandbox-runtime/entry.mjs` 已改为 per-user SRT manager 入口；原 `SandboxAPI` wrapper 启动逻辑拆到 `srt-child-entry.mjs`
- 新增 sandbox-runtime manager/status/resource collector：
  - 按 `srt-pools.json` 启停 per-user SRT child
  - 对 restart marker 或敏感配置变化做单 pool 重启
  - 写入 `srt-pool-status.json`
  - 从 `/proc` 采集 manager/child RSS 与 CPU 样本
- Compose/env 接线已切到 per-user SRT manager：
  - `sandbox-runtime` 容器只接收 manager 配置，不再接收全局 `API_KEY` / `POOL_SIZE` / `SANDBOX_DEFAULT_*`
  - `web` 与 `supervisor` 共享 `SRT_DEFAULT_*`、端口基线和 private status/config 卷
  - user workspace 根目录从单池 `workspace` 改为 `user-workspaces`

### Notes

- sandbox-runtime manager 仍通过 private shared volume 读取 `srt-pools.json`；manager 不读取 SQLite，bot runtime 生命周期仍由 supervisor 拥有。

## 2026-04-24

### Changed

- `sandbox-runtime` 镜像构建默认值已更新到 `@fastagent/sandbox-runtime@0.4.1`，并收口到 `infra/docker/sandbox-runtime.versions.env`；发布流水线不再重复传入版本，Compose 仅保留可选本地 override
- repo-local FastAgent CLI 基线已固定到 `@fastagent/cli@0.6.35`，并同步更新 CLI contract、部署手册、版本矩阵和 supervisor packaging 规则

## 2026-04-23

### Changed

- Compose 默认 `sandbox-runtime` npm 基线已从 `0.3.0` 升级到 `0.4.0`，并同步更新 `infra/compose/.env.example`、`infra/docker/sandbox-runtime.Dockerfile`、Compose 回归测试、部署手册和版本矩阵
- 已按 `@fastagent/sandbox-runtime@0.4.0` 发布包重新核对 WeClaws 的 repo-local wrapper 依赖：当前 tarball 仍包含 `WorkspaceManager` / `SandboxProcessPool` / `SandboxAPI` 等内部 `dist/**` 模块，因此 `/workspace` `/state` 虚拟路径和 Linux writable rebind 补丁无需额外适配
- FastAgent CLI 事实文档也已重新对齐到仓库实际依赖版本，恢复 Compose 文档一致性回归测试

### Notes

- 这次升级仍保留 WeClaws 对已发布包内部模块的直接 patch；后续再升级 `SANDBOX_RUNTIME_NPM_VERSION` 时，必须继续核对发布 tarball 的内部 `dist/**` surface，而不能只看公开 SDK / CLI contract

## 2026-04-22

### Changed

- `sandbox-runtime` 运行镜像现在会额外预装 `bun@1.3.13`、`pnpm@9.15.4` 和 `uv@0.11.7`，补齐 remote sandbox 内的 JS / Python 包管理与脚本执行工具链
- Compose 默认 sandbox build surface 新增 `BUN_VERSION`、`PNPM_VERSION`、`UV_VERSION`，用于显式锁定镜像里的 bun / pnpm / uv 基线，避免 Docker 构建内容静默漂移
- `infra/compose/.env.example`、`apps/supervisor/PATTERNS.md`、`docs/manuals/docker-deployment-runbook.md`、`docs/manuals/env-and-secrets-matrix.md` 与 `docs/manuals/version-matrix.md` 已同步记录 bun / pnpm / uv 的默认版本和验证方式
- `sandbox-runtime` 镜像里的 `bun` 现在固定安装到 `/usr/local/bin`，避免 remote sandbox 因 deny `/root` 而把镜像内 bun 自己藏掉
- `sandbox-runtime` 镜像里的 Linux x64 `bun` 现在固定下载官方 `linux-x64-baseline` 资产，不再让安装脚本按构建机 CPU 自动选现代版；这样生产如果跑在不支持 AVX2 的旧 x64 机器上，也不会因为 builder/runtime CPU 能力不一致而直接 core dump
- remote sandbox 会话级文件系统规则重新收口为父级 `instances/**` / runtime `basePath/**` broad deny，彻底挡住 sibling bot / workspace 的父目录枚举；同时新增 worker 侧 bootstrap，在最终 bwrap 命令里把当前 bot 的 `workspace` / `data` / `stateRoot` 再 `--bind` 一次，避免 broad deny 又把当前 bot 压回只读

## 2026-04-21

### Changed

- remote sandbox 的 workspace map 已从 `INSTANCES_ROOT/.sandbox-runtime/workspace-map.json` 挪到工作区私有路径 `storage/sandbox-runtime-private/workspace-map.json`；Compose/production override 也同步新增 `sandbox_runtime_private` 共享卷，避免 bot session 直接读到映射文件
- repo-local `sandbox-runtime` wrapper 现在会把对外 session `workspacePath` 固定伪装成 `/workspace`，并额外支持 `/state` 作为当前 bot `dataDir` 的虚拟 cwd 根；命令执行前再翻译回真实 bot 目录
- remote sandbox 会话级文件系统策略现在会对整棵 `instances` 和 runtime base path 做 deny-then-allow 收口，只重开当前 bot 的 `workspace`、`data` 和当前 session `stateRoot`，避免跨 bot 读目录
- Compose / supervisor config 默认的 `SANDBOX_WORKSPACE_MAP_FILE` 已全部切到私有路径；本地开发和生产部署都不再把 workspace map 混在 `instances` 根目录里

## 2026-04-20

### Changed

- `spawn-fastagent` 现在要求调用方显式传入已解析好的 bot runtime config；supervisor 不再保留任何 repo-wide LLM env fallback 分支
- FastAgent child 不再从父进程隐式继承额外的 `FASTAGENT_*` 变量；`FASTAGENT_BASE_URL` / `FASTAGENT_API_TYPE` 只有在 bot 绑定 profile 自己提供时才会注入
- `getSupervisorConfig()`、根 `.env.example`、Compose `.env.example` 与 `docker-compose.yml` 已同步移除退役的 repo-wide LLM 默认值接线，避免继续暗示 bot runtime 会读取这些 env

## 2026-04-17

### Changed

- runtime LLM 配置解析已 hard cut 到 profile-only：`ProcessManager.startInstance()` 现在只读取 `bot_instances.llm_config_id -> user_llm_profiles`，不再使用 supervisor 进程里的 `FASTAGENT_*` 默认值补齐 bot 运行配置
- 缺少 profile 绑定或绑定失效的 bot 现在会分别收敛成 `failed + LLM_PROFILE_REQUIRED` / `failed + LLM_PROFILE_INVALID`，而不是继续尝试启动
- `ProcessManager.startInstance()` 现在会把 spawn 前阶段的 bot 级启动失败收敛成 `failed + FASTAGENT_START_FAILED`，避免缺失 binary / 启动规格准备失败把整轮 reconcile 直接打断
- 周期性 reconcile 调度现在会显式捕获 rejected promise 并写日志，不再让定时器里的异步收敛异常变成未处理拒绝

## 2026-04-16

### Changed

- repo-local `@fastagent/cli` 基线已从 `0.5.8` 升级到 `0.6.6`，并同步更新 `pnpm-lock.yaml`
- 新增 supervisor Docker/Compose 回归测试，锁住 `apps/supervisor/package.json`、根 `pnpm-lock.yaml` 与 FastAgent 版本文档的同步，避免 CI / Docker 构建再次因 frozen lockfile 漂移失败
- 新增 `infra/compose/docker-compose.prod.yml`：生产环境改为直接拉取已发布镜像，并通过 `${WECLAWS_DATA_ROOT}` bind mount 把 SQLite、instances、sandbox workspace 显式落到宿主机目录
- `infra/compose/.env.example` 现在会把大多数按需 override 的 Compose 变量保留为注释形式；同时 `docker-compose.yml` 对 `FASTAGENT_DEFAULT_PROVIDER` / `FASTAGENT_DEFAULT_MODEL` 改用空字符串默认值，避免注释掉这些可选 fallback 后继续收到 Compose 未设置变量告警
- `supervisor` 运行镜像现在额外预装 `procps`，保证单实例锁与 child identity 校验在容器内也能调用 `ps` 读取进程启动时间
- Compose 的 `sandbox-runtime` session budget 基线现在显式固定为 `POOL_SIZE=10`、`SESSION_TIMEOUT=600000`、`MIN_READY_PROCESSES=0`、`MAX_CONCURRENT_INIT=1`，避免 `local` profile 的短 session timeout 在 IM reconnect 场景下更容易触发 `POOL_EXHAUSTED`
- `infra/compose/.env.example`、部署手册和环境矩阵已同步暴露 `SANDBOX_SESSION_TIMEOUT_MS`，不再让 Compose 静默依赖上游 `local` profile 的 `120000ms` 默认值
- Compose 的 `sandbox-runtime` 安全基线现在额外固定 `apparmor=unconfined`；Ubuntu 24 上如果继续落在 `docker-default` profile，bubblewrap 会在命令执行阶段报 `Failed to make / slave: Permission denied`

### Notes

- 这次调整只收口 Compose 默认基线，不改变 `@fastagent/sandbox-runtime@0.3.0` 的公开 env surface

## 2026-04-15

### Changed

- `sandbox-runtime` 运行镜像现在会额外预装 `ffmpeg`、`jq`、`zip`、`unzip`、`file`、`poppler-utils`、`pandoc`，让 remote sandbox 直接具备常用媒体处理、JSON/压缩包操作和 PDF / `.docx` 纯文本提取能力
- `sandbox-runtime` 构建现在会固定安装 `agent-browser@0.25.4`；默认预装系统 `chromium` 并导出 `AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium`，其中非 ARM64 构建阶段继续执行 `agent-browser install --with-deps`，ARM64 则回退到系统 Chromium，避免卡在 Chrome for Testing 不支持 Linux ARM64
- Compose 默认 sandbox build surface 新增 `AGENT_BROWSER_NPM_VERSION`，用于显式锁定 browser CLI 基线，避免镜像内容静默漂移
- 新增 Compose 回归测试，锁住 `AGENT_BROWSER_NPM_VERSION` 的 build arg 接线和 `sandbox-runtime` Dockerfile 的扩容工具集 contract

### Notes

- 这批新增 CLI 只属于 `sandbox-runtime`；`supervisor` 继续只保留编排、迁移和少量托管 skills 所需的控制面工具
- 当前文档提取范围只覆盖 PDF / `.docx` 的纯文本提取，不包括 OCR、`.doc` 或 LibreOffice 转换链

## 2026-04-14

### Changed

- remote sandbox 现在会在 `INSTANCES_ROOT/.sandbox-runtime/workspace-map.json` 里登记 `workspaceId -> 真实 bot workspace` 映射，避免命令执行阶段因 session root 漂到临时 `/tmp/.../ws_*` 而拒绝真实 `cwd`
- repo-local `sandbox-runtime` 镜像入口改为仓库内 wrapper：wrapper 会读取 workspace map，把 remote sandbox session root 对齐到真实 bot workspace
- Compose 的 `sandbox-runtime` 服务现在额外共享 `claws_instances` 卷到 `/app/storage/instances`，保证 sandbox 容器能访问 supervisor/FastAgent child 看到的同一份真实 bot workspace
- Compose 部署路径现在只保留 repo-local 三镜像拓扑，不再继续维护 `docker-compose.external-sandbox.yml` / `SANDBOX_RUNTIME_IMAGE`
- Compose 的 `sandbox-runtime` 网络策略接线已切到上游 denylist 语义：默认使用 `SANDBOX_DEFAULT_DENIED_DOMAINS`，不再继续维护旧的 `SANDBOX_DEFAULT_ALLOWED_DOMAINS`
- 新增 Compose 回归测试，锁住 `sandbox-runtime` denylist env wiring，避免后续回退到已失效的 allowlist contract
- Compose 默认 `sandbox-runtime` npm 基线已统一到 `0.3.0`，并同步收敛示例 env、runbook 与版本矩阵

### Notes

- 当前 remote sandbox 真实 turn 会使用 bot 的真实 workspace 作为 session root；普通消息能回复但命令执行无响应的已知根因不再是 workspace root 漂移
- 当前仓库已明确接受上游“allow-by-default + denylist carve-outs”的公开网络语义；空 denylist 不再代表配置缺失

## 2026-04-12

### Changed

- supervisor 启动时不再把 `FASTAGENT_API_KEY`、`FASTAGENT_DEFAULT_PROVIDER`、`FASTAGENT_DEFAULT_MODEL` 视为硬必填；这些全局变量现在只是 bot 运行时的 env fallback
- 新增用户级运行时配置解析：bot spawn 前会先读取 `user_llm_configs`，再回退 supervisor 进程里的 `FASTAGENT_*` 默认值
- bot 运行时配置解析现在改为 provider-scoped fallback：如果用户把 provider 切到与 env 默认不同的厂商，`model / apiKey / baseUrl / apiType` 不再继续继承那组 env 默认项，避免 spawn 时混出跨 provider 的假完整配置
- FastAgent child 的 `FASTAGENT_BASE_URL` / `FASTAGENT_API_TYPE` 现在支持按用户配置覆盖，不再只能复用 supervisor 进程级继承值
- 当 bot 的生效 LLM 配置仍缺少 `provider / model / apiKey` 时，`ProcessManager` 会直接把实例标成 `failed + LLM_CONFIG_INCOMPLETE`，避免 reconcile 死循环反复拉起
- `ProcessManager` 现在会在 spawn 前把本次解析出来的 `provider / model` 写回 `bot_instances`，让 web 详情页和列表页展示 bot 自己的 runtime 快照
- `Restart` / `Start` 写入的 restart intent 现在可以把 `failed` bot 重新放回 reconcile；web 在用户补齐 LLM 设置后也会自动触发这条恢复链

### Notes

- bot 因 `LLM_CONFIG_INCOMPLETE` 进入 `failed` 后，不再需要人工改库；只要后续存在有效 restart intent，supervisor 就会重新接管恢复
## 2026-04-10

### Changed

- `supervisor` 运行镜像现在会预装 `curl`、`gh`、`ffmpeg`，为首批官方托管 skills 提供稳定的通用运行工具层

### Notes

- 镜像只预装通用 CLI，不会把用户 API key、OAuth token 或设备配对状态写进镜像层
- 当前这层基础工具主要服务于 `weather`、`github`、`video-frames` 这类首批官方 skills；是否真正可用仍取决于对应运行时环境变量和账号配置

## 2026-04-09

### Changed

- `supervisor` Docker 构建现在会在 build 阶段用 `esbuild` 产出 `apps/supervisor/dist/index.js`，并把 `packages/db/src/migrations` 复制到 `apps/supervisor/dist/migrations`；运行层默认改为 `node apps/supervisor/dist/index.js`
- supervisor 运行镜像现在会额外携带仓库级 `resources/` 目录，供运行时读取托管 skills bundle
- `ProcessManager.startInstance()` 现在会在 spawn 前尝试把 `resources/skills/managed` 同步到实例 `data/skills`
- managed skills 同步使用 bot 级文件锁；锁 busy、manifest 错误、I/O 错误都只记录并继续启动 FastAgent
- `apps/supervisor` 新增直接运行时依赖 `better-sqlite3`，确保 bundle 后的 dist 入口在 Node 解析链上能拿到 SQLite 原生依赖
- `resolve-fastagent-binary-path` 的默认 repo-local binary 解析不再依赖源码目录层级，bundle 后的 dist 运行路径也能稳定回到 `apps/supervisor/node_modules/.bin/fastagent`
- 新增 Compose 回归测试并补齐 `web` 容器 runtime env 注入：`WEB_ADMIN_EMAILS`、`FASTAGENT_DEFAULT_*`、`FASTAGENT_BASE_URL`、`FASTAGENT_API_TYPE` 现在都由 base compose 显式透传，避免 `standalone` 运行层静默依赖宿主机根 `.env`
- `apps/supervisor` 现在直接声明 repo-local `@fastagent/cli@0.2.1` 依赖；默认真实启动链与 contract smoke 都会优先解析 `apps/supervisor/node_modules/.bin/fastagent`
- `FASTAGENT_BINARY_PATH` 不再是本地开发/Compose 的常规必填项，只保留给显式 override 场景
- `supervisor` 运行镜像不再额外全局安装 `@fastagent/cli`，Compose 也不再固定注入 `/usr/local/bin/fastagent`
- supervisor 入口的信号处理现在会等待 `startSupervisor()` 启动链 settle 后再退出；即使 `SIGTERM` 落在首轮 `reconciler.runOnce()` 期间，也会继续走 `runtime.close()` / `processManager.dispose()`，避免自动接管旧实例时遗留 orphan FastAgent child
- 工作区单实例锁写入的 `startedAt` 现在来自操作系统观察到的真实进程启动时间；自动替换旧 supervisor 前必须同时匹配 `pid + startedAt`，避免 stale lock 命中 PID 复用后误杀无关本地进程
- FastAgent child 进程不再继承整份 supervisor `process.env`；现在只透传系统运行必需变量和 `FASTAGENT_*` 前缀，避免把控制面 secrets 暴露给 bot runtime
- child env allowlist 额外补上常见的小写代理变量：`http_proxy`、`https_proxy`、`no_proxy`、`all_proxy`，避免容器/CI 只配置小写代理时 FastAgent child 丢失出网能力
- reconcile 现在会在内存 registry 缺席但 DB 仍残留 `processPid/processStartedAt` 时，先按真实进程身份回收 orphan FastAgent 进程，再继续收敛到 `stopped` 或后续 restart
- `process_started` 落库时现在会优先读取操作系统观察到的真实 child birth time；只有当前 pid 已不可观察时才回退到 JSONL 事件时间，避免后续 orphan 回收用 `pid + startedAt` 对不上
- 当调用方直接传入 `process.env` 时，supervisor 现在总会尝试加载工作区根 `.env` 的缺省配置；即使 FastAgent 必填变量已在当前 shell 中提供，`DATABASE_URL` / `INSTANCES_ROOT` 这类可选项也不会静默退回默认值
- contract smoke helper 现在只有在真实 binary 可执行且 `FASTAGENT_API_KEY`、模型、provider 运行时配置都齐备时才会启用，避免 fresh checkout / CI 因 repo-local binary 存在而误跑真实 smoke

### Notes

- web 与 supervisor 现在都尊重同一套 `INSTANCES_ROOT` shared resolver，避免 bot 目录创建和 runtime 启动漂移
- supervisor 只托管 `data/skills`，不会修改 `workspace/.fastagent/skills`

## 2026-04-08

### Changed

- workspace package scope 统一改为 `@weclaws/*`，当前 supervisor 脚本、容器入口和依赖引用都以新 scope 为准
- supervisor 启动 FastAgent 时不再读取数据库中的 per-bot binary/path 字段
- runtime 所需的 `data/workspace/logs` 目录统一通过 shared path resolver 从 `instancesRoot + botId` 派生
- 真实 child process 现在只使用全局 `FASTAGENT_BINARY_PATH`
- 新增 `FASTAGENT_SANDBOX_MODE=remote|disabled`；默认保持 `remote`
- `FASTAGENT_SANDBOX_MODE=disabled` 时，supervisor 不再要求 `SANDBOX_URL` / `SANDBOX_API_KEY`，真实 FastAgent 启动命令退回 `fastagent --channel weixin --output jsonl`
- `FASTAGENT_SANDBOX_MODE=disabled` 时，supervisor 现在会显式剥离继承下来的 `SANDBOX_*` 子进程环境，避免把无效/敏感 sandbox 配置继续透传给 FastAgent
- Compose 默认 supervisor 环境新增 `FASTAGENT_SANDBOX_MODE` 透传，repo-local `sandbox-runtime` 默认 npm 版本同步到 `0.2.0`
- event applier 现在会忽略来自旧 pid 的非 `process_started` 事件，避免扫码成功后被历史 runtime 的 `qr_code` 再次打回 `waiting_for_qr`
- supervisor 现在会在 `storage/supervisor.lock` 上持有工作区级单实例锁；新实例启动时会先 warn 并尝试停掉旧 supervisor，只有同进程重复启动或无法安全停掉旧实例时才会拒绝启动

### Notes

- 旧机器残留在 SQLite 里的绝对路径不再影响新机器启动
- `cwd`、`IM_GATEWAY_DATA_DIR`、`IM_GATEWAY_WORKSPACE_DIR` 全部来自 supervisor 本地配置和派生目录，不依赖 DB 持久化路径

## 2026-04-07

### Changed

- Compose 部署改为在容器内固定安装 `@fastagent/cli@0.2.1`，`supervisor` 不再依赖宿主机 `fastagent` binary bind mount
- Compose 默认路径改为在本仓库内构建 `sandbox-runtime` 运行镜像，并固定安装 `@fastagent/sandbox-runtime@${SANDBOX_RUNTIME_NPM_VERSION}`
- `sandbox-runtime` 继续保持独立服务边界；`supervisor` 仍只依赖 `SANDBOX_URL` / `SANDBOX_API_KEY` 和既有 sandbox HTTP / Socket.IO contract
- 新增 `infra/compose/docker-compose.external-sandbox.yml` 作为外部预构建 sandbox 镜像 override；`SANDBOX_RUNTIME_IMAGE` 仅在该模式下生效
- Compose 示例环境变量调整为：`FASTAGENT_CLI_VERSION` / `SANDBOX_RUNTIME_NPM_VERSION` / `SANDBOX_RUNTIME_IMAGE`
- 本地开发时，`getSupervisorConfig()` 会在缺少必填 runtime 环境变量时自动回退到工作区根目录 `.env`；`pnpm dev:supervisor` 不再要求先手动 `source .env`

## 2026-03-31

### Changed

- real FastAgent 启动路径改为 `bot.fastagentBinaryPath ?? FASTAGENT_BINARY_PATH`；per-bot 路径为空时明确回退 supervisor 全局配置
- `qr_code` 事件现在只接受 `https://liteapp.weixin.qq.com/q/...`；非法 URL 不再写入 `lastQrCode*`，而是记录 `INVALID_QR_URL`
- `ProcessManager` 现在会把两类 runtime 脏输出都视为 fatal：
  - 非法 JSONL 行
  - `applyFastAgentEvent()` 未处理异常
- fatal 路径统一先记录 bot 错误，再终止 child，并复用已有 `stopped/backoff/failed` 语义继续收敛
- `provisioning + desired_state=stopped` 的实例现在能在首轮 reconcile 时直接收敛到稳定 `stopped`

## 2026-03-30

### Added

- 新增 supervisor runtime 闭环实现：
  - `config.ts`
  - `event-reader`
  - `event-applier`
  - `restart-policy`
  - `process-registry`
  - `process-manager`
  - `instance-lock`
  - `instance-reconciler`
  - root `tests/fixtures/mock-fastagent.ts`
- 新增 supervisor runtime 测试：
  - JSONL reader
  - event applier
  - restart policy
  - process manager
  - instance reconciler

### Changed

- 本地开发入口改为 `tsx watch src/index.ts`
- `apps/supervisor` 新增对 `@weclaws/db` 的 workspace 依赖，为 runtime 落库做准备
- `src/index.ts` 改为真实 supervisor 入口，会启动 DB、process manager 和周期性 reconcile loop
- 默认 FastAgent 启动链已切换到真实 `FASTAGENT_BINARY_PATH`，mock fixture 仅保留给显式测试场景
- 新增 `src/runtime/fastagent-cli-contract.ts`，统一真实 CLI contract smoke 的命令拼装、JSONL 校验和可运行性判断
- `runtime_error` 落库优先保留结构化 `data.error`，避免真实 FastAgent 样本只留下泛化 message
- 新增真实 standalone 样本夹具，覆盖 `qr_code`、`running(restored)`、正常 `stopping/stopped`
- `running(accountId=...)` 现在会回填 `weixinAccountId`，避免 restore 路径丢账号信息
- 记录 remote sandbox 的真实接线语义：`SANDBOX_URL` / `SANDBOX_API_KEY` 为懒使用，不会在 child process 启动期提前校验
- `ProcessManager` 现在会等 stdout 事件 apply 链排空后再释放 registry，避免 crash/stop 后过早重启导致恢复竞态
- 新增 scripted real-runtime 测试 binary，覆盖 restored running、graceful stop、restored crash 和四次失败阈值
- supervisor Docker 运行层现在会同时复制 `apps/supervisor`、`packages/db`、`packages/shared` 的包级 `node_modules`，避免基于 pnpm workspace 源码运行的容器在启动时丢失 `tsx`、`better-sqlite3` 等包级依赖解析
