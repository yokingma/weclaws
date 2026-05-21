# FastAgent CLI Contract For WeClaws

## 1. 文档定位

本文档定义当前 WeClaws 消费 FastAgent CLI 时依赖的外部 contract。

如果你在阅读 `IM_GATEWAY_WORKSPACE_DIR`、`IM_GATEWAY_DATA_DIR`、sandbox `/workspace`、sandbox `/state` 和 sandbox-runtime `stateRoot` 时容易混淆，请同时参考：

- `docs/manuals/sandbox-path-semantics.md`

WeClaws 当前只依赖这几类能力：

1. 可执行文件路径
2. 启动参数
3. 实例级环境变量
4. stdout JSONL 事件流
5. 停止/退出可观察语义

这是一份外部集成 contract，不讨论 FastAgent 内部包结构。

当前事实来源以本仓库实现和测试为准：

- `apps/supervisor/src/runtime/fastagent-cli-contract.ts`
- `apps/supervisor/src/runtime/spawn-fastagent.ts`
- `apps/supervisor/src/runtime/event-applier.ts`
- `tests/integration/fastagent-cli-contract.test.ts`
- `packages/shared/src/fastagent-jsonl.ts`

## 2. 仓库内的验证基线

当前 WeClaws 仓库已经对下面这些 contract 点有直接验证：

- runtime 命令拼装
- bare root `--output jsonl` 非法调用 smoke
- stdout JSONL 逐行解析与 schema 校验
- `IM_GATEWAY_AGENT_ID -> agentId` 回填行为
- remote sandbox 启动阶段的懒连接语义

当前 supervisor 运行时依赖的 FastAgent 包版本是：

- `@fastagent/cli@0.8.2`

## 3. Binary Path Contract

FastAgent 必须提供一个可由 `child_process.spawn()` 直接启动的可执行入口。

WeClaws 的解析顺序是：

1. 如果设置了 `FASTAGENT_BINARY_PATH`，使用它
2. 否则回退到 repo-local `apps/supervisor/node_modules/.bin/fastagent`

对 FastAgent 来说，真正需要满足的是：

- 路径稳定
- 文件存在且可执行
- 能在 Node 20 / Linux Docker 环境中运行

## 4. Command Contract

### 4.1 Disabled Sandbox 模式

当 `FASTAGENT_SANDBOX_MODE=disabled` 时，当前 supervisor 使用：

```bash
fastagent --channel weixin --output jsonl
```

### 4.2 Remote Sandbox 模式

当 `FASTAGENT_SANDBOX_MODE=remote` 时，当前 supervisor 使用：

```bash
fastagent --channel weixin --sandbox remote --sandbox-url http://sandbox-runtime:<owner-srt-port> --output jsonl
```

`<owner-srt-port>` 来自 bot owner 对应的 per-user SRT pool，不再是全局共享的 manager health port。

### 4.3 Bare Root JSONL 调用

下面这个调用当前被视为非法 root 调用：

```bash
fastagent --output jsonl
```

WeClaws 会把它当成 contract smoke 的错误路径，而不是正常运行入口。

## 5. Environment Contract

### 5.1 supervisor 显式注入

每次启动 bot 时，supervisor 会从 bot 当前绑定的 LLM profile 显式注入：

- `FASTAGENT_API_KEY`
- `FASTAGENT_PROVIDER`
- `FASTAGENT_MODEL`
- `IM_GATEWAY_AGENT_ID`
- `IM_GATEWAY_ALLOW_ALL_PERMISSIONS=true`
- `IM_GATEWAY_DATA_DIR`
- `IM_GATEWAY_WORKSPACE_DIR`

只有在 remote sandbox 模式下，才额外注入 owner-specific SRT child 配置：

- `SANDBOX_URL`
- `SANDBOX_API_KEY`

### 5.2 允许继承的额外变量

FastAgent child 不会继承整份 supervisor `process.env`。

当前只允许继承：

- 系统运行所需变量
- 常见代理变量

`FASTAGENT_BASE_URL` / `FASTAGENT_API_TYPE` 只有在 bot 绑定的 profile 自己携带这些值时，supervisor 才会显式注入 child。

### 5.3 明确不会透传的控制面变量

以下变量不是 FastAgent contract 的一部分，当前也不会下发给 child：

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `WEB_ADMIN_EMAILS`

## 6. 实例级字段语义

### `IM_GATEWAY_AGENT_ID`

- 会回填到 JSONL 事件里的 `agentId`
- WeClaws 当前直接把自己的 `bot_instance.id` 注入到这里

### `IM_GATEWAY_DATA_DIR`

实例级持久化数据目录。

WeClaws 在这个目录下额外约定：

- `data/skills`
  - FastAgent 会消费的实例级 skills 目录
  - WeClaws 只会尝试同步仓库内 `resources/skills/managed` 的托管 bundle 到这里
  - 同名且未被 WeClaws 标记为托管的目录视为用户内容，必须跳过，不可覆盖
- `data/.weclaws-managed-skills.json`
  - WeClaws 托管 skills 的汇总与诊断元数据
- `data/skills/<skillName>/.weclaws-managed-skill.json`
  - per-skill ownership marker，作为托管判定的长期真相来源

这些约定都属于 WeClaws 控制面自己的运行时补充规则，不要求 FastAgent CLI 本身显式理解这些文件。

托管 skills 的完整同步策略和当前默认清单见：

- `docs/manuals/managed-skills.md`

### `IM_GATEWAY_WORKSPACE_DIR`

实例级工作区目录。

### `IM_GATEWAY_ALLOW_ALL_PERMISSIONS`

当前 WeClaws 基线实现固定注入 `true`。

## 7. stdout JSONL Contract

### 7.1 统一规则

- stdout 一行一个 JSON 对象
- stdout 不允许混入自由文本日志
- stderr 不属于 supervisor 事件 contract
- WeClaws 只消费 stdout JSONL

### 7.2 当前 schema

每个事件至少包含：

- `type`
- `timestamp`
- `pid`
- `message`
- `data`

可选字段：

- `agentId`

仓库里的 schema 定义见：

- `packages/shared/src/fastagent-jsonl.ts`

## 8. 已支持的事件集合

WeClaws 认得这些事件类型：

- `process_started`
- `qr_code`
- `login_confirmed`
- `running`
- `account_invalid`
- `runtime_error`
- `stopping`
- `stopped`

## 9. WeClaws 当前真正依赖的事件字段

### 9.1 `process_started`

WeClaws 只依赖：

- 事件存在
- `pid`
- `timestamp`

`data.channel` 可以存在，但状态机不会强依赖它。

### 9.2 `qr_code`

当前 WeClaws 强依赖：

- `data.qrCodeUrl`

当前 WeClaws 可选消费：

- `data.qrCodeId`

说明：

- 如果没有 `qrCodeId`，WeClaws 会用事件时间戳兜底
- 当前 UI 只会展示通过 shared validator 校验的微信二维码 URL

### 9.3 `login_confirmed`

当前 WeClaws 强依赖：

- `data.accountId`

其他字段如 `userId`、`baseUrl` 可以存在，但当前控制面不依赖它们。

### 9.4 `running`

当前 WeClaws 可选消费：

- `data.accountId`

像 `source=qr_login/restored` 这类字段可以存在，但当前状态机不要求它必须存在。

### 9.5 `account_invalid`

当前 WeClaws 依赖事件本身存在。

`data.reason`、`data.accountId` 可以存在，但当前控制面不会把它们当作强依赖字段。

### 9.6 `runtime_error`

当前 WeClaws 会优先读取：

- `data.code`
- `data.error`

如果 `data.error` 不存在，则回退到事件顶层 `message`。

### 9.7 `stopping`

WeClaws 只依赖事件存在。

`data.reason` 可选。

### 9.8 `stopped`

WeClaws 只依赖：

- 事件存在
- `timestamp`
- `message`

实现不会强依赖 `data.exitCode` 或 `data.reason` 才能完成状态流转。

## 10. Remote Sandbox 的懒连接语义

contract smoke 已验证：

- 使用 remote sandbox 启动时
- 即使 owner-specific `SANDBOX_URL` 指向不可达地址

FastAgent 仍然可能先发出：

- `process_started`
- `qr_code`

而不会在 child process 启动瞬间立刻报 `runtime_error`。

这意味着：

- owner-specific `SANDBOX_URL` / `SANDBOX_API_KEY` 不是启动期强校验项
- sandbox 真正的可用性需要通过真实 turn 或命令执行验证

## 11. 停止与退出语义

WeClaws 更依赖 JSONL `stopping` / `stopped` 事件，而不是直接解析裸 exit code。

最低要求是：

- 正常停止不能和 crash 混淆
- bare root 非法命令要以非 0 退出
- 运行期错误最好在退出前先通过 `runtime_error` 发出可观察信号

## 12. WeClaws 当前不接受的集成方式

以下方式都不符合当前 contract：

- 让控制面解析 stdout 自由文本日志
- 让控制面依赖 FastAgent monorepo 内部包
- 让控制面依赖未文档化的额外环境变量
- 要求控制面通过 stderr 反推运行状态

## 13. 依赖边界

WeClaws 实际依赖的 FastAgent CLI 边界可以收敛为：

- 可由稳定 binary path 启动
- 支持 `--channel weixin`
- 支持 `--output jsonl`
- remote 模式支持 `--sandbox remote --sandbox-url`
- stdout 只输出合法 JSONL
- 支持实例级 `IM_GATEWAY_*` 目录隔离
- 在设置 `IM_GATEWAY_AGENT_ID` 时能回填 `agentId`

## 14. 相关文档

- `docs/manuals/env-and-secrets-matrix.md`
- `docs/manuals/docker-deployment-runbook.md`
