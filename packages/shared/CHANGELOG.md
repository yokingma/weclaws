# CHANGELOG

## 2026-05-13

### Added

- 为托管 `editorial-card-screenshot` 新增 managed-skill bundle contract 测试，锁住 `index.json` 收编状态、`manifest.json` 默认同步边界，以及 Browserless-only 截图契约。

### Changed

- `editorial-card-screenshot` 现已进入默认同步清单；相关 bundle contract 测试也同步收紧为“必须同时出现在 `manifest.json` 与 `index.json` 的默认同步集合中”。

## 2026-05-07

### Fixed

- managed skills 同步的 staging 目录现在改为落在目标 `data/skills` 同一文件系统内，避免在 Docker 挂载卷上把临时目录从 `/tmp` `rename` 到实例卷时触发 `EXDEV`。

## 2026-05-04

### Changed

- per-user SRT pool 默认 `defaultDenyRead` 不再包含 `/etc/mtab`，并新增共享净化逻辑；Linux remote sandbox 现在统一依赖标准化 `${WECLAWS_DATA_ROOT}` 路径和敏感 `/proc` 入口 deny 做 mount 信息降敏，避免旧的 `/etc/mtab` deny 直接把 bubblewrap 启动打死。

## 2026-05-03

### Changed

- per-user SRT pool 默认 `defaultDenyRead` 增加 `/etc` 账号数据库备份文件、`/etc/mtab` 和敏感 `/proc` 入口，降低新建 pool 默认暴露容器身份、mount 表、cmdline、environ、kallsyms 与 cgroup 信息的风险。

## 2026-05-02

### Added

- 新增 per-user sandbox-runtime pool 共享 contract：
  - `SRT_POOL_CONFIG_FILE_VERSION`
  - `SRT_POOL_STATUS_FILE_VERSION`
  - `SandboxRuntimePoolDefaults`
  - `SandboxRuntimePoolState`
  - `parseSandboxRuntimePoolDefaults()`

### Notes

- `parseSandboxRuntimePoolDefaults()` 是 web 注册自动 provisioning 与 supervisor 配置渲染的共同默认值入口，避免两侧对 `SRT_DEFAULT_*`、`SRT_PORT_BASE`、`SRT_PROXY_PORT_BASE` 和 `SRT_WORKSPACE_BASE_ROOT` 的解析规则漂移。

## 2026-04-17

### Added

- 新增共享 SSE 事件名：`bot.stream.error`

### Notes

- `bot.stream.error` 只表示流级脱敏错误，不代表 bot runtime 状态字段更新；`bot.error.updated` 继续保留给 `lastErrorCode / lastErrorMessage`

## 2026-04-12

### Added

- 新增跨 workspace 的 provider-scoped LLM 配置解析 helper：`resolveProviderScopedLlmConfig()`

### Notes

- `provider` 仍可回退到 env 默认值；但 `model / apiKey / baseUrl / apiType` 不再跨 provider 继承 env 默认项，避免把一家的默认 key / gateway 混进另一家的运行时配置

## 2026-04-10

### Fixed

- 收紧 managed skills 的路径边界校验：
  - `manifest.json` 中的 `skill.path` 规范化后必须仍然落在 `resources/skills/managed` 内
  - `skill.name` 必须是单段目录名，不能逃出 `data/skills` 或创建嵌套目录
  - 同步引擎在 install / retire 两侧都不再裸拼托管路径

### Tests

- 新增回归测试覆盖：
  - bundle source path 逃逸
  - `../escaped` 形式的非法 skill name
  - `nested/name` 形式的嵌套 skill name

## 2026-04-09

### Added

- 新增共享实例根目录解析：
  - `DEFAULT_INSTANCES_ROOT_RELATIVE_PATH`
  - `resolveInstancesRootPath(workspaceRoot, instancesRoot?)`
- 新增 server-only managed skills 子路径导出：`@weclaws/shared/managed-skills`
- 新增 managed skills 共享 contract：
  - bundle manifest 解析
  - bot 级文件锁
  - marker-first 同步引擎
  - `data/.weclaws-managed-skills.json` 元数据
  - per-skill `.weclaws-managed-skill.json` ownership marker

### Notes

- web 与 supervisor 现在共用同一套 `INSTANCES_ROOT` 解析语义，避免实例目录创建和 runtime 启动落到不同根目录
- managed skills 的文件系统实现不进入 `@weclaws/shared` 根导出，只通过 server-only 子路径暴露

## 2026-04-08

### Added

- 新增 `resolveBotInstancePaths()`，统一从 `instancesRoot + botInstanceId` 派生：
  - `botRoot`
  - `dataDir`
  - `workspaceDir`
  - `logDir`

### Changed

- workspace package 名称改为 `@weclaws/shared`

### Notes

- bot 实例目录结构现在是 shared contract，web 与 supervisor 必须复用同一套路径推导
- 宿主机绝对路径不再写入数据库，避免新机器复用旧环境路径

## 2026-03-31

### Added

- 新增共享 QR URL validator/normalizer，只信任 `https://liteapp.weixin.qq.com/q/...`

### Notes

- web 与 supervisor 现在共用同一套二维码白名单逻辑，避免前后端各自维护 URL 信任规则

## 2026-03-30

### Added

- 新增 Sprint 2 shared contract 约束文档，收敛 runtime 常量与 JSONL schema 的使用边界
- 新增 restart policy 共享常量：
  - `RESTART_BACKOFF_DELAYS_MS`
  - `MAX_CONSECUTIVE_RESTARTS`
