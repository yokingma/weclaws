# PATTERNS

## Contract Boundaries

- cross-workspace 共享 contract 统一通过 `@weclaws/shared` 导出和引用
- `packages/shared` 只承载跨 app 共享的稳定 contract、常量和类型
- 不放置依赖数据库、Web 或 child process 的运行时逻辑
- 涉及 Node `fs` / 进程锁的 server-only 实现，只能放在显式子路径导出里，例如 `@weclaws/shared/managed-skills`；不要回挂到根入口

## FastAgent JSONL

- FastAgent JSONL 事件集合以当前 `FASTAGENT_JSONL_EVENT_TYPES` 为唯一基线
- 不为历史字段如 `botInstanceId` 或未落地事件如 `runtime_warning` 提供兼容层

## Runtime Constants

- restart backoff、reconcile interval 等跨 app 常量优先放在 `packages/shared`
- 具体状态迁移逻辑仍留在 supervisor，不放入 shared
- 当前共享的 restart 常量只描述稳定策略数值，不包含任何数据库或进程副作用

## Sandbox Runtime Pool Contract

- per-user sandbox-runtime pool 的默认配置、配置文件版本和状态文件版本统一由 `packages/shared/src/sandbox-runtime-pools.ts` 定义
- web 和 supervisor 必须复用 `parseSandboxRuntimePoolDefaults()` 解析 `SRT_DEFAULT_*`、`SRT_PORT_BASE`、`SRT_PROXY_PORT_BASE` 和 `SRT_WORKSPACE_BASE_ROOT`，避免注册时写入 DB 的默认值与 supervisor 渲染值漂移
- shared 只负责 env 默认值解析、类型和稳定 contract，不读取数据库、不写文件、不启动进程
- proxy 端口段默认宽度必须能覆盖 `poolSize * 2`，因为每个 worker 当前至少需要一对 proxy port
- 默认 `SRT_DEFAULT_DENY_READ` 必须包含 `/etc` 账号数据库备份文件和敏感 `/proc` 入口，但不能再包含 `/etc/mtab`；Linux remote sandbox 统一依赖标准化 `${WECLAWS_DATA_ROOT}` 路径和 `/proc/*/mountinfo` / `/proc/*/mounts` deny 做 mount 信息降敏，因为直接 deny `/etc/mtab` 会把 bubblewrap 启动打死

## SSE Contract

- 单 bot SSE 事件名基线统一放在 `BOT_SSE_EVENT_NAMES`
- `bot.status.updated` / `bot.qrcode.updated` / `bot.error.updated` 这三类 patch 必须仍然兼容 `BotDetailItem` 的字段形状
- `bot.stream.error` 只表示 SSE transport/polling 自身的脱敏错误提示；它不是 bot runtime 状态补丁，消费者不能把它直接 merge 进 bot DTO

## LLM Runtime Resolution

- 用户级 LLM 配置与 env 默认值的合并规则统一走 `resolveProviderScopedLlmConfig()`
- `provider` 可以回退到 env 默认值；但 `model / apiKey / baseUrl / apiType` 这组 provider-bound 字段，只能在“当前生效 provider 与 env 默认 provider 相同”时继续复用 env 默认值
- 一旦用户把 provider 切到与 env 默认不同的厂商，shared resolver 必须把仍未显式覆盖的 provider-bound 字段收敛为 `null/missing`，由上层决定阻止 create、阻止 auto-recovery，或在 runtime 配置解析阶段抛出 typed error
- web / supervisor 不要各自重新实现字段级 merge，否则前后端很容易再次漂移

## Bot Instance Paths

- bot 实例目录的共享 contract 统一放在 `resolveBotInstancePaths()`
- `instancesRoot` 的默认值和 override 解析统一放在 `DEFAULT_INSTANCES_ROOT_RELATIVE_PATH` + `resolveInstancesRootPath(workspaceRoot, instancesRoot?)`
- 目录结构固定为 `botRoot/data/workspace/logs`，调用方只传 `instancesRoot` 和 `botInstanceId`
- web 与 supervisor 必须复用同一套 `INSTANCES_ROOT` 解析逻辑，避免一侧创建目录、另一侧在不同根目录启动 runtime
- shared 不读取数据库，也不关心宿主机历史路径
- 不为旧机器残留路径、工作目录持久化或 per-bot FastAgent binary override 保留兼容层

## QR URL Contract

- QR URL 信任边界统一放在 `packages/shared`，避免 web/supervisor 策略漂移
- 当前唯一可信来源是 `https://liteapp.weixin.qq.com/q/...`
- 必须同时满足：
  - `protocol === 'https:'`
  - `hostname === 'liteapp.weixin.qq.com'`
  - `pathname` 以 `/q/` 开头
- 不为 `javascript:`、`data:`、任意图片 CDN、历史测试域名提供兼容分支

## Managed Skills Contract

- 官方托管 bundle 根目录固定为 `resources/skills/managed`
- 运行时托管目标只允许是 `storage/instances/<botId>/data/skills`
- 对默认同步和托管但暂不默认同步的 skill，都应在 `packages/shared/src/managed-skills/__tests__` 下补 bundle contract 测试，至少锁住 `index.json` 收编状态、`manifest.json` 默认同步边界，以及和当前运行契约直接相关的静态资源/脚本文案约束
- managed skills install 的临时 staging 目录必须与目标 `data/skills` 位于同一文件系统内，避免容器挂载卷上从 `/tmp` 直接 `rename` 到实例目录触发 `EXDEV`
- `manifest.json` 中的 `skill.path` 规范化后必须仍然位于 bundle 根目录内，不能通过 `..`、嵌套回退或符号链接逃逸到外部目录
- `skill.name` 必须是 `data/skills` 下的单段子目录名：
  - 不能包含 `/`、`\\`
  - 不能是 `.` 或 `..`
  - 不能借由名称拼接写到 `data/skills` 之外，也不能创建嵌套目录
- ownership 采用 marker-first：
  - skill 目录下的 `.weclaws-managed-skill.json` 是长期真相来源
  - `data/.weclaws-managed-skills.json` 只是汇总与诊断文件
- bot 级同步锁固定为 `data/.weclaws-managed-skills.lock`
- shared 同步引擎必须允许“同步失败不阻断调用方主流程”，由调用方决定如何记录和继续执行
