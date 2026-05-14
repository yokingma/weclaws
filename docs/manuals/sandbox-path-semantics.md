# WeClaws Sandbox Path Semantics

## 1. 文档定位

本文档专门解释 WeClaws 在 FastAgent remote sandbox 场景下涉及的几组容易混淆的路径概念：

- `IM_GATEWAY_WORKSPACE_DIR`
- `IM_GATEWAY_DATA_DIR`
- sandbox 内的 `/workspace`
- sandbox 内的 `/state`
- `@fastagent/sandbox-runtime` 内部的 `stateRoot`

目标是回答两个问题：

1. 哪些路径是 WeClaws 定义的 bot 目录边界
2. 哪些路径是 sandbox-runtime 自己的会话级运行时目录

当前事实来源以仓库实现和已安装依赖文档为准：

- `packages/shared/src/bot-instance-paths.ts`
- `apps/supervisor/src/runtime/spawn-fastagent.ts`
- `infra/sandbox-runtime/workspace-root-override.mjs`
- `apps/supervisor/PATTERNS.md`
- `@fastagent/sandbox-runtime@0.5.2` 上游源码与 README：
  - `apps/sandbox-runtime/src/core/WorkspaceManager.ts`
  - `apps/sandbox-runtime/src/core/ExecutionContext.ts`
  - `apps/sandbox-runtime/src/core/SandboxProcessPool.ts`
  - `apps/sandbox-runtime/README.md`

## 2. 先看结论

最容易混淆的是下面两件事：

- `/state` 不是 `stateRoot`
- `IM_GATEWAY_DATA_DIR` 不是 sandbox-runtime 内部 `HOME`

可以先直接记这张表：

| 概念 | 谁定义 | 作用 | 典型真实落点 |
| --- | --- | --- | --- |
| `IM_GATEWAY_WORKSPACE_DIR` | WeClaws supervisor | bot 的项目工作目录 | `storage/instances/<botId>/workspace` |
| `IM_GATEWAY_DATA_DIR` | WeClaws supervisor | bot 的持久化数据目录 | `storage/instances/<botId>/data` |
| `/workspace` | WeClaws sandbox wrapper | 给 sandbox 内命令看的虚拟 cwd 根 | 映射到 `IM_GATEWAY_WORKSPACE_DIR` |
| `/state` | WeClaws sandbox wrapper | 给 sandbox 内命令看的虚拟数据根 | 映射到 `IM_GATEWAY_DATA_DIR` |
| `stateRoot` | `@fastagent/sandbox-runtime` | session 级 runtime 状态根目录 | `SRT_WORKSPACE_BASE_ROOT/<ownerId>/.runtime/<userId>/<workspaceId>` |
| `HOME` | `@fastagent/sandbox-runtime` | sandbox 内用户目录 | `stateRoot/home` |

一句话总结：

- WeClaws 负责定义 bot 自己的 `workspace` / `data`
- sandbox-runtime 负责定义会话级 `stateRoot` / `HOME` / `XDG_*`
- WeClaws 额外把 bot 的 `data` 暴露成 `/state`，但这不等于 sandbox-runtime 的 `stateRoot`

## 3. WeClaws 定义的 bot 目录

WeClaws 先从 `instancesRoot + botId` 派生每个 bot 的三类目录：

- `workspaceDir`
- `dataDir`
- `logDir`

当前共享 contract 见：

- `resolveBotInstancePaths(instancesRoot, botId)`

目录形态固定是：

```text
storage/instances/<botId>/
├─ workspace/
├─ data/
└─ logs/
```

这里最重要的是前两个：

- `workspace/`
  - bot 的项目工作目录
  - FastAgent child 的 `cwd`
  - sandbox 内的 `/workspace`
- `data/`
  - bot 的持久化数据目录
  - 托管 skills 等 WeClaws 运行时补充数据会放这里
  - sandbox 内的 `/state`

`logs/` 是独立目录，不属于 `/state`。

## 4. FastAgent child 实际拿到的目录变量

supervisor 启动 bot 时，会把真实目录直接注入给 FastAgent child：

- `IM_GATEWAY_WORKSPACE_DIR=<bot workspaceDir>`
- `IM_GATEWAY_DATA_DIR=<bot dataDir>`

当前注入逻辑是：

```text
IM_GATEWAY_WORKSPACE_DIR -> storage/instances/<botId>/workspace
IM_GATEWAY_DATA_DIR      -> storage/instances/<botId>/data
```

这里注入的是宿主机上的真实路径，不是虚拟路径。

也就是说：

- `IM_GATEWAY_*` 是 FastAgent runtime 看到的真实 bot 目录
- 它们不是 sandbox 对外展示用的别名

## 5. WeClaws 在 sandbox 内额外定义的虚拟路径

remote sandbox 模式下，WeClaws 的 wrapper 会再做一层路径虚拟化。

对 sandbox 内执行的命令，WeClaws 约定：

- `/workspace`
  - 映射到当前 bot 的真实 `workspaceDir`
- `/state`
  - 映射到当前 bot 的真实 `dataDir`

也就是说，sandbox 内的调用者不需要知道真实宿主机路径，只需要理解：

```text
/workspace = bot 项目工作目录
/state     = bot 持久化数据目录
```

这层别名的目的有两个：

1. 隐藏真实宿主机绝对路径
2. 把可访问边界收口成固定、稳定、易理解的两个根

当前实现里，这两个别名不再只是“给 `cwd` 翻译用的虚拟字符串”：

- session 对外仍显示 `/workspace`
- `resolveCommandCwd()` 仍会把 `cwd=/workspace/...`、`cwd=/state/...` 翻译回真实目录
- worker bootstrap 还会在最终 bwrap argv 里额外追加 `--bind <realWorkspacePath> /workspace` 与 `--bind <realDataPath> /state`
- 如果上游 sandbox-runtime 重建 config 时剥离了 WeClaws 的自定义 alias 字段，worker bootstrap 会从当前 bot 的 `workspace` / `data` write roots 兜底推导这两个 alias bind

这意味着 sandbox 内命令正文如果直接引用：

- `/workspace/...`
- `/state/...`

现在也会命中当前 bot 的真实目录，而不是只在 `cwd` 场景下成立。

## 6. `stateRoot` 到底是什么

`stateRoot` 不是 WeClaws 的 bot 数据目录，而是 `@fastagent/sandbox-runtime` 为每个 session 派生的内部运行时目录。

上游 runtime 会从 `stateRoot` 再派生：

- `home`
- `config`
- `cache`
- `state`
- `data`
- `tmp`

对应关系是：

```text
stateRoot/home   -> HOME
stateRoot/config -> XDG_CONFIG_HOME
stateRoot/cache  -> XDG_CACHE_HOME
stateRoot/state  -> XDG_STATE_HOME
stateRoot/data   -> XDG_DATA_HOME
stateRoot/tmp    -> TMPDIR
```

所以如果把 `stateRoot` 理解成“sandbox-runtime 的会话级环境根”，是对的。

它除了运行时环境目录之外，也承担上游 README 里所说的 `tool state` 语义。也就是说，很多命令行工具会把自己的登录态、配置、缓存或临时状态写进这棵目录，而不是写进 WeClaws 暴露的 `/state`。

但要注意：

- `stateRoot` 不等于 `/state`
- `HOME` 不等于 `IM_GATEWAY_DATA_DIR`
- `/state` 只是 WeClaws 给 bot 数据目录取的虚拟别名

## 7. 四层路径怎么对应

把整个链路按层拆开看，会更容易理解：

### 7.1 宿主机真实目录层

```text
storage/instances/<botId>/workspace
storage/instances/<botId>/data
storage/sandbox-runtime-user-workspaces/<ownerId>/.runtime/<userId>/<workspaceId>/
```

### 7.2 FastAgent child 注入变量层

```text
IM_GATEWAY_WORKSPACE_DIR = storage/instances/<botId>/workspace
IM_GATEWAY_DATA_DIR      = storage/instances/<botId>/data
```

### 7.3 sandbox 命令可见虚拟路径层

```text
/workspace -> IM_GATEWAY_WORKSPACE_DIR
/state     -> IM_GATEWAY_DATA_DIR
```

### 7.4 sandbox-runtime 内部环境变量层

```text
HOME            -> stateRoot/home
XDG_CONFIG_HOME -> stateRoot/config
XDG_CACHE_HOME  -> stateRoot/cache
XDG_STATE_HOME  -> stateRoot/state
XDG_DATA_HOME   -> stateRoot/data
TMPDIR          -> stateRoot/tmp
```

## 8. 实际使用时怎么判断该放哪

如果你在设计 bot/skill 的读写位置，可以按下面的规则判断：

- 放到 `/workspace`
  - 项目文件
  - 脚本
  - repo 内容
  - 明确属于 bot 工作区的业务文件

- 放到 `/state`
  - bot 自己的持久化运行数据
  - skills bundle
  - 明确希望跟着 bot 实例一起保留的数据

- 让程序自己写 `HOME` / `XDG_*`
  - 这是 sandbox-runtime 自己管理的 session 级运行时环境
  - 更适合临时缓存、工具配置、运行期用户目录语义

简单说：

- `/workspace` 偏项目内容
- `/state` 偏 bot 数据内容
- `HOME` / `XDG_*` 偏 sandbox 运行时环境

## 9. 常见误解

### 9.1 “`/state` 就是虚拟 home”

不是。

更准确地说：

- 虚拟 `HOME` 是 `stateRoot/home`
- `/state` 是 WeClaws 暴露给 bot 的数据目录

### 9.2 “`IM_GATEWAY_DATA_DIR` 就是 sandbox-runtime 的 `stateRoot`”

不是。

`IM_GATEWAY_DATA_DIR` 是 bot 自己的数据目录。

`stateRoot` 是 sandbox-runtime 每个 session 的内部运行时目录。

### 9.3 “只要能访问 `/state`，就能访问 sandbox-runtime 自己的内部 state”

不是。

WeClaws 当前只把 bot 的 `dataDir` 暴露成 `/state`，不会把 sandbox-runtime 的 `.runtime` / `.runtime-meta` 目录整体暴露给 bot。

### 9.4 “`logs/` 也属于 `/state`”

不是。

当前 `logs/` 是 bot 根目录下单独的 `logs` 目录，不在 `data/` 下，也不是 `/state` 的一部分。

## 10. 文件系统隔离边界

remote sandbox 的可见边界不是通过暴露真实父目录来实现的。

当前稳定规则是：

- sandbox 对外只展示 `/workspace` 和 `/state`
- 当前 bot 的真实 `workspaceDir`、`dataDir` 与当前 session 的 `stateRoot` 会进入 allow read/write
- `storage`、`storage/instances`、`storage/sandbox-runtime-private`、`SRT_WORKSPACE_BASE_ROOT`、当前 pool `basePath` 和 `metadataRoot` 必须同时 deny 目录本身与递归内容
- `/etc/passwd-`、`/etc/shadow-`、`/etc/group*`、`/etc/gshadow*` 以及 `/proc/*/mountinfo`、`/proc/*/mounts`、`/proc/*/mountstats`、`/proc/*/cmdline`、`/proc/*/environ`、`/proc/kallsyms`、cgroup 枚举入口会被 deny，避免命令通过系统元信息还原容器/宿主路径或 bwrap 参数；Linux 下不再直接 deny `/etc/mtab`，因为它是 `/proc/mounts` 的符号链接，硬绑 `/dev/null` 会让 bubblewrap 启动直接失败
- Linux worker 会在最终 bwrap 命令里把当前 bot 的 `workspaceDir` / `dataDir` / `stateRoot` 再 bind 一次，恢复当前 bot 可写性

这意味着 sandbox 内命令不能通过 `ls storage`、`ls storage/instances` 或 `ls SRT_WORKSPACE_BASE_ROOT` 枚举其他 bot、private config/status 文件或其他用户 runtime workspace；当前 bot 只能通过 `/workspace` 和 `/state` 访问自己的工作区与持久化数据。宿主真实 bind mount 源路径本质上来自容器 runtime 的 mountinfo，因此生产环境还应使用标准化的 `${WECLAWS_DATA_ROOT}` 路径，并依赖 `/proc/*/mountinfo` deny 防止 sandbox 内直接读取。

## 11. 一张总图

```text
宿主机真实目录
├─ storage/instances/<botId>/workspace
├─ storage/instances/<botId>/data
├─ storage/instances/<botId>/logs
└─ SRT_WORKSPACE_BASE_ROOT/<ownerId>/.runtime/<userId>/<workspaceId>/
   ├─ home
   ├─ config
   ├─ cache
   ├─ state
   ├─ data
   └─ tmp

FastAgent child 注入
├─ IM_GATEWAY_WORKSPACE_DIR = .../storage/instances/<botId>/workspace
└─ IM_GATEWAY_DATA_DIR      = .../storage/instances/<botId>/data

sandbox 内可见虚拟路径
├─ /workspace -> bot workspaceDir
└─ /state     -> bot dataDir

sandbox 内受保护环境变量
├─ HOME            -> stateRoot/home
├─ XDG_CONFIG_HOME -> stateRoot/config
├─ XDG_CACHE_HOME  -> stateRoot/cache
├─ XDG_STATE_HOME  -> stateRoot/state
├─ XDG_DATA_HOME   -> stateRoot/data
└─ TMPDIR          -> stateRoot/tmp
```

## 12. 维护约定

如果后续修改下面任何一项，应同步检查本文档是否仍然成立：

- `resolveBotInstancePaths()` 的目录结构
- supervisor 对 `IM_GATEWAY_*` 的注入规则
- sandbox wrapper 对 `/workspace`、`/state` 的翻译规则
- sandbox-runtime 上游对 `stateRoot`、`HOME`、`XDG_*` 的公开语义

如果以后 WeClaws 还要继续暴露新的虚拟根路径，也应优先在本文档补充，而不是把语义零散埋进多个 contract 文档里。
