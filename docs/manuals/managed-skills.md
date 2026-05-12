# WeClaws Managed Skills

## 1. 文档定位

本文档说明 WeClaws 官方托管技能的来源、同步策略、当前默认内容和运行依赖。

当前事实来源以仓库文件和共享同步实现为准：

- `resources/skills/managed/manifest.json`
- `resources/skills/managed/index.json`
- `resources/skills/managed/README.md`
- `packages/shared/src/managed-skills/*`
- `apps/supervisor/src/runtime/process-manager.ts`
- `apps/web/src/app/api/bots/[id]/skills/sync/*`

## 2. 设计目标

托管技能的目标是让每个 bot 启动时都能得到一组稳定的官方技能基线，同时不破坏用户自己维护的技能。

边界固定为：

- WeClaws 只同步官方托管 bundle。
- 同步目标只允许是实例级 `data/skills`。
- 用户自管的 `workspace/.fastagent/skills` 不在 WeClaws 托管范围内。
- 用户级密钥、OAuth token、登录态和设备配对状态不进入镜像或托管 bundle。

## 3. 当前 bundle

当前默认同步清单版本：

- `2026-04-15-curated-v6`

`manifest.json` 是默认同步的唯一权威来源。`index.json` 只用于展示、依赖说明和安装提示，不参与默认同步决策。

当前默认同步的技能：

| 技能 | 用途 | 主要运行依赖 | 状态 |
| --- | --- | --- | --- |
| `weather` | 查询天气和预报 | `curl` | 默认同步 |
| `github` | 通过 GitHub CLI 处理仓库、Issue、PR、CI | `gh` | 默认同步 |
| `skill-creator` | 创建、编辑、校验和打包 FastAgent 技能 | `python3` | 默认同步 |
| `video-frames` | 用 ffmpeg 从视频中截帧或生成检查图 | `ffmpeg` | 默认同步 |
| `personal-planner` | 面向复杂任务的先规划、再执行工作流 | 无额外命令依赖 | 默认同步 |
| `agent-browser` | 浏览器自动化技能说明已收编 | `agent-browser`、Browserless sidecar | 默认同步 |

当前已收编但暂不默认同步的技能：

| 技能 | 用途 | 主要运行依赖 | 状态 |
| --- | --- | --- | --- |
| `ppt-skill` | 生成单文件 HTML 网页 PPT、配图提示词与瑞士风校验脚本 | `node` | 已收编，暂不默认同步 |

说明：

- `agent-browser` 已进入托管同步清单，`sandbox-runtime` 镜像也预置了 `agent-browser`。
- 默认 Compose 部署现在会额外提供 `browserless` sidecar；托管技能里的受支持运行路径只有 `agent-browser -p browserless` 和显式远程 `--cdp`，不允许在 nested sandbox 或宿主机内直接 launch 本地浏览器。
- Browserless 在当前仓库里首先是远程浏览器后端；一次性截图、PDF、scrape 这类 one-shot 任务可以直接使用 Browserless，但当前仍统一收口在 `agent-browser` skill 下说明，不单独拆托管 skill。
- `ppt-skill` 已按 WeClaws 托管 skill 收编，但因为其预览与交付更依赖外部浏览器或 HTTP 托管路径，当前只进入 `index.json`，不进入 `manifest.json` 默认同步清单。
- `ppt-skill` 模板已内嵌关键拉丁字形，中文继续走系统字体栈；当前目标是避免 Google Fonts 波动导致离线预览或远程截图排版漂移，而不是把整包 CJK 字体塞进 skill。

## 4. 同步时机

托管技能有两条同步入口：

- supervisor 在启动 FastAgent 子进程前会尝试同步一次。
- bot 详情页提供手动 `Sync Skills` 入口，对应 `POST /api/bots/{id}/skills/sync`。

同步失败的处理原则：

- 启动前自动同步失败不会阻断 FastAgent 启动。
- 如果 bot 级同步锁已被占用，当前同步会返回 `SYNC_IN_PROGRESS` 或记录 busy 状态。
- 手动同步只做目录对账，不写 bot 运行意图，也不附带重启语义。

## 5. 目标目录和标记文件

每个 bot 的实例目录形态为：

```text
storage/instances/<botId>/
├─ workspace/
├─ data/
│  ├─ skills/
│  │  └─ <skillName>/
│  │     └─ .weclaws-managed-skill.json
│  ├─ .weclaws-managed-skills.json
│  └─ .weclaws-managed-skills.lock
└─ logs/
```

文件语义：

- `data/skills/<skillName>/.weclaws-managed-skill.json`
  - 单个技能是否由 WeClaws 托管的长期真相来源。
- `data/.weclaws-managed-skills.json`
  - 当前同步结果的汇总和诊断元数据。
- `data/.weclaws-managed-skills.lock`
  - bot 级同步锁，确保 supervisor 自动同步和 web 手动同步不会并发写同一目录。

## 6. 覆盖和退休策略

同步引擎遵循下面的目录安全规则：

- 目标目录为空时，安装 manifest 中的所有默认同步技能。
- 已存在且带 WeClaws 托管标记的同名技能，可以被更新。
- 已存在但没有 WeClaws 托管标记的同名技能，视为用户内容，必须跳过，不覆盖。
- manifest 删除某个曾由 WeClaws 托管的技能后，同步可以移除该退休技能。
- 不认识的 sibling 目录必须保留。
- staging 目录必须落在目标 `data/skills` 的同一文件系统内，避免 Docker 挂载卷场景下跨文件系统 `rename` 触发 `EXDEV`。

## 7. 运行依赖

默认 Compose 镜像会为托管技能准备一组基础命令：

- `curl`
- `gh`
- `python3`
- `ffmpeg`
- `agent-browser`
- Browserless sidecar（默认 Compose 部署）

技能是否真正可用仍取决于运行环境和用户授权。例如：

- `github` 需要可用的 `gh` 认证上下文。
- `weather` 默认通过公开天气接口查询，不需要用户 API key。
- `video-frames` 依赖输入视频文件在当前 bot 可访问路径内。
- 用户级密钥和 OAuth 状态不会被写入镜像层。

## 8. 维护清单

新增、删除或调整官方托管技能时，应同步检查：

- `resources/skills/managed/manifest.json`
- `resources/skills/managed/index.json`
- `resources/skills/managed/README.md`
- `docs/manuals/managed-skills.md`
- `docs/manuals/docker-deployment-runbook.md`
- `docs/manuals/version-matrix.md`，如果新增了镜像内置工具或版本基线
- 对应 workspace 的 `CHANGELOG.md` / `PATTERNS.md`，如果改动了同步行为、镜像内容或运行契约
