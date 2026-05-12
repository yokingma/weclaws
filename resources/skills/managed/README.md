# Managed Skills Bundle

这个目录保存 WeClaws 已纳入官方托管同步体系的 skills。

当前目录里的 skill 分两类：

- 已进入 `manifest.json` 的默认同步 skill
- 已收编但暂不默认同步的官方托管 skill

当前默认同步：

- `agent-browser`
- `weather`
- `github`
- `skill-creator`
- `video-frames`
- `personal-planner`

当前已收编但暂不默认同步：

- `ppt-skill`

当前约束：

- `manifest.json` 是默认同步清单的唯一权威来源
- `index.json` 是 WeClaws 自己的展示、依赖与安装提示清单；它不参与默认同步决策
- 只同步 manifest 中声明的 skill
- 默认目标目录是每个实例的 `data/skills`
- 如果目标目录已有同名且未被 WeClaws 托管的 skill，则跳过，不覆盖用户内容
- `workspace/.fastagent/skills` 不在 WeClaws 托管范围内
- 各 skill 的 `SKILL.md` frontmatter 只保留 `name`、`description`；`homepage`、`emoji`、`requires`、`install` 等平台元数据统一写入 `index.json`

运维约束：

- 是否真正可用，仍取决于 runtime 是否具备对应 CLI 和所需环境变量
- `agent-browser` 已进入默认同步清单；默认 Compose 部署下，WeClaws 只支持通过 `sandbox-runtime` 内的 `agent-browser -p browserless` 或显式远程 `--cdp` 执行浏览器自动化；少量一次性截图/PDF/scrape 场景可以直接调用 Browserless，但不单独拆 skill
- `ppt-skill` 已完成收编但暂不默认同步；当前主要依赖 `node` 执行瑞士风校验脚本，产物是单文件 HTML deck 与同级 `images/` 目录；其模板已内嵌关键拉丁字形，中文继续走系统字体栈，避免 Google Fonts 不稳定导致版式漂移
- 用户级 secrets 不进入镜像层
