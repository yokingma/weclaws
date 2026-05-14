# CHANGELOG

## 2026-05-14

### Changed

- Web 运行时依赖已提升到安全基线：`next` 升级到 `^16.2.6`，`better-auth` 升级到 `^1.6.11`，用于压掉当前公开的 Next.js / Better Auth 依赖树安全告警。
- 根测试工具链已切到 `vitest@^4.1.6` 和 `vite@^6.4.2`；`apps/web` 相关单测的 `EventSource` / `Intl.DateTimeFormat` mock 现已改成兼容新版本构造函数语义的写法。

## 2026-05-10

### Changed

- bot 列表页的 inline rename 名称按钮现在在 hover/focus 时提示“点击名称重命名 Bot”，保留点击名称进入编辑的轻量交互。
- bot 详情页把 `Start` / `Stop` / `Restart`、`Profile`、`Sync Skills` 和 `Delete Bot` 入口提升到头部右侧；`Profile` 改为模态框编辑，不再常驻左侧控制栏。
- bot 详情页移除独立 `运行概览` 卡片，启动时间并入头部 summary，`Stop` / `Restart` / `Sync Skills` / `Delete Bot` 等谨慎操作统一先弹确认再执行。
- bot 详情页新增独立“二维码与分享”模块，集中承载二维码预览、`Reissue QR`、公开分享开关和复制链接；模块内二维码使用紧凑展示，减少重复小标题、来源说明和预览说明。
- 二维码与分享模块取消内部两列并排布局，改为单列满宽流，避免左侧控制栏里二维码和分享控件拥挤错位。
- 二维码预览下方的 `Open QR page` 和 `Reissue QR` 现在位于同一横行动作组，窄屏自动换行。
- sandbox-runtime 管理台的 pool 重启时间改为复用 `LocalizedDateTime`，避免客户端组件在 render 阶段自行格式化时间造成 hydration mismatch。
- bot 列表页现在支持直接点击名称做 inline rename；本地列表状态由 `BotsConsole` 持有，保存继续走 owner-scoped `PATCH /api/bots/[id]`，详情页不再保留独立名称编辑卡片。
- inline rename 的客户端交互已收口到独立 `BotRenameControl`，避免列表渲染组件继续承载表单副作用。
- 二维码与分享模块提供 `Reissue QR` 动作：web 只写 `POST /api/bots/[id]/reissue-qr` intent，不伪装成微信通道内的真实登出；runtime 后续由 supervisor 停实例、清登录态并重新出码。
- 新增二维码公开分享闭环：
  - owner-scoped `GET/POST/DELETE /api/bots/[id]/qr-share`
  - 公共 `GET /api/share/qr/[token]`
  - 未登录也可访问的 `/share/qr/[token]` 公开页面
- owner 侧二维码分享控件已拆成独立 `BotQrShareControls`，详情页维护动作统一由头部操作区承载。
- 公开二维码页当前按 2 秒轮询最新 bot 状态；同一分享链接会在 bot 重出码后继续返回最新二维码，不需要重新复制新页面地址。
- 公共 `GET /api/share/qr/[token]` 显式返回 `cache-control: no-store`，避免 QR 状态轮询和 revoke 结果被缓存。
- `toApiError()` 继续只透传显式 `ApiError`；普通 error-like 对象统一折叠为通用 500，避免泄露底层错误细节。

## 2026-05-07

### Changed

- Bot 详情页新增基础信息卡片，可直接编辑 Bot 展示名称；保存走 owner-scoped `PATCH /api/bots/[id]`，只更新 `bot_instances.name`，不触发 restart intent，也不修改 LLM profile 或 runtime 快照。
- `PATCH /api/bots/[id]` 现在只接受 trim 后非空的 `name` 字段，继续复用统一 API envelope、session 校验和 bot owner 校验。

## 2026-05-04

### Changed

- sandbox-runtime 管理 API 现在会在读写 pool 配置时自动净化 `/etc/mtab`，避免管理员界面继续回显或保存这条会打死 Linux bubblewrap 的历史 `defaultDenyRead` 项；mount 信息降敏统一改为依赖标准化 `${WECLAWS_DATA_ROOT}` 和敏感 `/proc` 入口 deny。
- `/admin/sandbox-runtime` 现在把每个用户 pool 收口为紧凑列表，列表明细只保留并列展示的 Port / CPU / 内存，配置编辑、启停和重启统一迁入模态框，避免账号很多时页面被超大配置卡片撑满。
- sandbox-runtime 管理台现在会在前端阻止无效 pool 配置提交：所有数值字段必须是正整数，并新增 `minReadyProcesses <= poolSize`、`portRangeStart <= portRangeEnd` 两条跨字段校验。
- admin sandbox-runtime PATCH 现在显式拒绝 `workspaceBasePath` 更新；该路径改为 runtime 派生元数据，不再允许浏览器配置。

## 2026-05-02

### Changed

- `getEnv()` 现在会解析 SRT 默认池配置，并在核心 web env 已来自 `process.env` 时继续从工作区根 `.env` 补读缺失的 `SRT_*` 默认值。
- 用户通过邀请码或首个管理员自举注册成功后，web 会为该用户自动创建默认 `user_sandbox_runtime_pools` 记录；创建失败只记录日志，不回滚已完成的账号创建或邀请码消费。
- 新增 sandbox-runtime 管理 API：`GET /api/admin/sandbox-runtime/pools`、`PATCH /api/admin/sandbox-runtime/pools/{ownerUserId}`、`POST /api/admin/sandbox-runtime/pools/{ownerUserId}/restart`。
- sandbox-runtime 管理 API 现在会合并数据库 pool 配置、用户邮箱和 manager status 文件；缺失 status 文件时仍返回已配置 pool，且响应只暴露 `apiKeyConfigured`。
- sandbox-runtime 管理 API 会把 child port 冲突映射为稳定 `SRT_POOL_PORT_CONFLICT`，避免底层 DB unique constraint 变成 500。
- `/admin` 现在默认进入 `/admin/sandbox-runtime`，并使用独立 `AdminShell`；用户 Bot 工作台顶部不再混入邀请码管理入口，管理员从账号菜单进入 `Admin Console`。
- 新增 `/admin/sandbox-runtime` 页面，用于查看 sandbox-runtime manager 与每个用户池的 CPU、RSS、PID、状态、端口和容量配置，并支持重启、启停和保存配置。

## 2026-04-20

### Changed

- `/settings` 的 LLM profile 表单现在为 `Profile Name / Provider / Model / API Type` 显示可见必填 `*`；`API Key` 只在创建新 profile 时显示必填标识，编辑现有 profile 继续允许留空以保留当前 key
- 设置页的 `Base URL` 现在明确备注“留空将使用 Provider 官方默认 URL”；浏览器提交空值时继续写成 `null`，不再把这种正常场景展示成语义不清的“未设置”
- 设置页的 `API Type` 现在必须由用户显式选择后才能保存；`POST /api/settings/llm-profiles` 要求提供非空 `apiType`，`PATCH /api/settings/llm-profiles/{profileId}` 继续允许省略该字段，但不再接受显式 `apiType: null`
- legacy `apiType=null` 的 profile 现在不会再因为空 PATCH 或编辑其他字段被静默回填；只有用户显式选择 `API Type` 后才会更新这类旧记录
- `src/lib/env.ts` 已删除遗留的 create-bot 默认 LLM env helper；web 运行时不再暴露 `FASTAGENT_DEFAULT_*` / `FASTAGENT_BASE_URL` / `FASTAGENT_API_TYPE` 这组旧默认值读取入口
- Compose `web` 服务不再注入退役的 repo-wide LLM 默认 env；create-bot 与 bot 详情里的 LLM 信息统一只来自用户级 LLM profiles

## 2026-04-19

### Changed

- `POST /api/settings/llm-profiles` 和 `PATCH /api/settings/llm-profiles/{profileId}` 现在会把同 owner 的 profile 重名唯一约束稳定收口为 `409 LLM_PROFILE_NAME_CONFLICT`，不再落成泛化 `500`
- `PATCH /api/settings/llm-profiles/{profileId}` 现在会先做 no-op 检测；空 PATCH 或字段未变化时不会写库，也不会为绑定中的运行态 bot 追加 restart intent
- `DELETE /api/settings/llm-profiles/{profileId}` 在预检查后如果又撞上并发 bot 绑定导致 FK 删除失败，现在也会继续返回 `409 LLM_PROFILE_IN_USE`

## 2026-04-17

### Changed

- `/settings` 已从单一用户级 LLM 设置 hard cut 到多 profile 控制台：
  - 新增 `GET/POST /api/settings/llm-profiles`
  - 新增 `PATCH/DELETE /api/settings/llm-profiles/{profileId}`
  - API key 不再回显明文，只返回 `hasApiKey`
- `POST /api/bots` 现在必须显式携带 `llmProfileId`；bot 创建时会把所选 profile 绑定到 `bot_instances.llm_config_id`，并把 `provider / model` snapshot 一起写入 bot row
- bot 详情页新增 LLM profile 卡片，并接入 `PATCH /api/bots/[id]/llm-profile`；换绑 profile 后如果 bot 的 `desiredState=running`，web 会自动写入 restart intent
- 更新 LLM profile 后，web 现在会为所有绑定该 profile 且 `desiredState=running` 的 bot 写入 restart intent；删除仍被 bot 绑定的 profile 会返回 `409 LLM_PROFILE_IN_USE`
- 管理员邀请码现在支持 `DELETE /api/admin/invites/[id]`；只有未使用且未预占的邀请码允许删除，`reserved/used` 会返回 `409 INVITE_DELETE_NOT_ALLOWED`
- bot 详情页 SSE 现在新增独立的 `bot.stream.error` 事件，用于承载流自身的脱敏错误提示；`bot.error.updated` 重新收口为只同步 bot runtime 的 `lastErrorCode / lastErrorMessage`
- SSE snapshot / polling 失败现在统一走 `toApiError()` 折叠未知异常，不再把原始 DB / 文件系统报错直接透传到浏览器
- bot 详情页 live view 现在会把流级错误单独渲染为内联错误提示，而不是继续把错误 payload 当作 `BotDetailItem` patch 直接 merge
- `next-env.d.ts` 再次收口为稳定的 `./.next/types/routes.d.ts` 引用，避免全量测试和 fresh checkout 被本地 `next dev` 生成的 dev-only 路径污染

## 2026-04-16

### Changed

- `web` 运行镜像现在额外保留 `resources/skills/managed` 并预装 `procps`，修复生产环境点击 `Sync Skills` 时因缺少 bundle 或 `ps` 命令而落入 `INTERNAL_SERVER_ERROR`
- `web` 运行镜像现在额外保留 `apps/supervisor/package.json`，修复生产环境页头无法显示 `FastAgent CLI v...` 版本 badge
- bot 列表、详情、事件流和管理员邀请码页里的时间文本现在统一走 hydration-safe 的 [`LocalizedDateTime`](./src/components/ui/localized-date-time.tsx)；首屏先渲稳定文本，挂载后再切到本地化时间，修复生产环境 React `#418` hydration mismatch
- bot 详情页现在只在 `waiting_for_qr` 状态展示二维码；扫码登录后即使 DB 里暂时仍保留最近一次 `lastQrCode*`，前端也不再继续显示旧二维码

## 2026-04-14

### Changed

- 新增可选全局 env：`WEB_USER_BOT_LIMIT`
  - 空值或 `0` 表示不限
  - 正整数表示每个用户最多可创建的 Bot 数量
- `POST /api/bots` / `createBot()` 现在会按 owner 统计现有 Bot 数量；达到上限时返回 `409 BOT_LIMIT_REACHED`
- `createBot()` 现在会在同一个 SQLite `immediate` 事务里重新执行 owner-scoped Bot 数量检查，修复并发创建请求可能同时越过 `WEB_USER_BOT_LIMIT` 的问题
- `/bots` 与 `/bots/new` 现在都会展示当前账号的 Bot 已用数量；当 `WEB_USER_BOT_LIMIT` 生效时，同时显示上限与剩余额度
- 创建页在命中 `WEB_USER_BOT_LIMIT` 时会直接禁用 `Create Bot` 按钮，并以内联错误提示说明当前账号已达到上限
- `web` 的 env 解析现在会校验 `WEB_USER_BOT_LIMIT` 为非负整数
- `getEnv()` 现在即使核心必填变量已经来自 `process.env`，也会继续从工作区根 `.env` 补读缺失的 `WEB_USER_BOT_LIMIT` / `WEB_ADMIN_EMAILS`
- Compose `web` 服务现在会显式注入 `WEB_USER_BOT_LIMIT`，保证容器运行时与宿主机直跑行为一致
- bot 详情页左侧控制区现在把二维码内容直接内嵌进 `运行概览` 顶部，不再保留独立二维码卡片或额外二维码小标题块
- `运行概览` 现在只保留头部未展示的补充信息与操作区，去掉和 `当前运行状态` 重复的状态字段

## 2026-04-13

### Changed

- `/settings` 页的 `API Type` 改为固定选项 `Select`，当前只允许：
  - `anthropic-messages`
  - `openai-completions`
  - `openai-responses`
  - `google-generative-ai`
  默认表单值固定为 `openai-completions`
- `PATCH /api/settings/llm` 现在会校验 `apiType` 只能是上述四个值之一或 `null`
- 设置页的 `API Key` 输入新增眼睛按钮，可在显示/隐藏之间切换，不改变已保存 key 的回显策略
- 新增 owner-scoped 删除接口：`DELETE /api/bots/[id]`
- bot 详情页状态卡片新增危险操作区；删除 bot 时必须先点 `Delete Bot`，再点 `Confirm Delete`
- bot 删除当前只允许在 `desiredState=stopped`、`status=stopped`、`processPid=null` 时执行；删除成功后会级联清理 workspace / bot / events，并删除对应实例目录
- `web` 侧 repository 现在只缓存 DB client，不再缓存 repository 实例，修复 `next dev` 热更新后旧实例缺少新方法时把删除请求打成 `500`
- bot 详情页的 `运行概览` 去掉重复状态 tag；`返回 Bots` 按钮改为右对齐
- 设置页里的 `API Type` 现在只是默认展示 `openai-completions`；当当前账号仍在继承服务端默认 `apiType` 时，普通保存不再静默写入自定义覆盖
- 设置页新增“使用服务端默认 API Type”按钮，可把当前自定义 `apiType` 清回 `null`
- bot 删除成功后，如果实例目录清理失败，接口现在会记日志并继续返回成功，不再把这条半清理路径误报成 `500`
- 登录后控制台顶部工具条左侧新增 `FastAgent CLI v...` 轻量 badge；版本号来自 `apps/supervisor/package.json` 里当前集成的 `@fastagent/cli`

## 2026-04-12

### Changed

- 新增用户级 LLM 设置页 `/settings`，账号菜单里的 `Settings` 现在会跳转到真实页面，不再只是占位项
- 新增 owner-scoped LLM 设置接口：`GET /api/settings/llm`、`PATCH /api/settings/llm`
- create bot 现在不再直接依赖全局 `FASTAGENT_DEFAULT_*`；provider / model / baseUrl / apiType / apiKey 的生效顺序改为“用户配置优先，服务端 env 兜底”
- 用户级 LLM 配置解析现在改为 provider-scoped fallback：如果用户把 provider 切到与 env 默认不同的厂商，`model / apiKey / baseUrl / apiType` 不再继续继承那组 env 默认项，避免把跨 provider 的默认 key / gateway 混进 create-bot 和自动恢复链路
- create bot 页的运行配置摘要现在展示“当前生效配置 + API key 是否已配置”，配置不完整时会阻止提交并引导去设置页
- `PATCH /api/settings/llm` 现在改为稀疏更新语义：省略字段表示保持现值，`null` 表示清除用户覆盖，非空字符串表示更新；不再使用 `clearApiKey`
- bot 列表与详情页返回的 `provider / model` 现在重新对齐 bot 自己的 runtime 快照；快照在 create-bot 和每次 supervisor spawn 前刷新，不再跟随账号当前设置即时漂移
- 当用户把 LLM 设置补齐后，web 会自动为名下 `LLM_CONFIG_INCOMPLETE` 且 `desiredState=running` 的 bot 写入 restart intent，交给 supervisor 恢复

### Notes

- 用户级 API key 当前按仓库约定直接明文存 SQLite，不做额外加密层
- `PATCH /api/settings/llm` 不回显 API key 明文；留空输入框不会改动当前 key，如需清除自定义 key，前端会显式发送 `apiKey: null`
## 2026-04-09

### Changed

- Compose `web` 服务现在会显式注入 `WEB_ADMIN_EMAILS` 和 create bot 只读 runtime 配置（`FASTAGENT_DEFAULT_*`、`FASTAGENT_BASE_URL`、`FASTAGENT_API_TYPE`），保证 Next `standalone` 容器运行时不依赖宿主机根 `.env`
- bot 详情页状态卡片现在新增 `Sync Skills` / `同步 Skills` 按钮，只触发托管 skills 目录同步，不附带 restart 语义
- 新增 owner-scoped 手动同步接口：`POST /api/bots/[id]/skills/sync`
- 手动同步直接复用 shared managed skills 引擎；锁 busy 时返回结构化 `SYNC_IN_PROGRESS`，同步错误则以内联反馈呈现，不打断当前 Bot 运行
- `next-env.d.ts` 里的 routes 类型引用恢复为稳定的 `./.next/types/routes.d.ts`，不再提交本地 `next dev` 产生的 `./.next/dev/types/routes.d.ts` 漂移
- 新增 `next-env.d.ts` 回归测试，并用 `typecheck + next build` 重新验证 fresh checkout / CI 不再依赖先跑一次 `next dev`
- `resolveInstancesRoot()` 现在会读取工作区根 `.env` 里的 `INSTANCES_ROOT`，并复用 shared `resolveInstancesRootPath()`，确保 web 创建实例目录与 supervisor 启动 runtime 落在同一根目录
- bot SSE / 持续轮询现在统一使用 bot event `rowId` 作为增量 cursor，避免同毫秒 burst 事件因随机 id 排序而漏发

## 2026-04-08

### Changed

- workspace package scope 统一改为 `@weclaws/*`
- Web 外部品牌改为 `WeClaws`，并把仓库根目录提供的 `logo_black.png` 接入到 toolbar、侧栏与认证页品牌入口
- `/login` 与 `/register` 的共享 `AuthShell` 进一步重构为“左侧产品 hero + 右侧加宽表单卡片”，桌面端表单卡片宽度收敛到更平衡的 `max-w-[42rem]`，外层画布拉宽到 `max-w-[110rem]`，左侧内容宽度提高到 `max-w-[46rem]` 并把桌面主间距继续收紧；hero 隐藏的小屏场景下，认证卡片改成占满单列可用宽度
- 认证页左侧现在明确说明一个账号可以在云端启动和管理多个不同的 AI 助手，并把微信作为当前交互渠道、语音/图片/文件作为主要自动化任务类型写进产品文案
- 认证页 hero 标题行高略微放松，hero 区品牌 logo 缩小、`WeClaws` 字标放大，整体视觉重心更稳定
- 注册表单现在继续保持 `email -> password -> inviteCode` 顺序，但只有邮箱和密码显示必填 `*`；邀请码改为可选输入，用于正常邀请码注册或首个管理员自举注册
- 当系统里还没有任何用户时，`WEB_ADMIN_EMAILS` 白名单邮箱可以留空邀请码完成首个管理员注册；首个用户创建成功后，注册立刻恢复为必须邀请码
- 首个管理员自举注册不再依赖非原子的 `countAll() === 0` 读判断；web 现在会先申请一条带 TTL 的 bootstrap claim，再把 server-only token 带进 Better Auth hook 校验，失败时释放 claim
- `createBot()` 改为通过 shared `resolveBotInstancePaths()` 派生实例目录，只在运行时创建：
  - `data`
  - `workspace`
  - `logs`
- web 不再向数据库写入任何 bot/workspace 宿主机路径，也不再持久化 per-bot FastAgent binary 路径
- create bot 页不再硬编码前端 `provider/model` 默认值；运行配置改为只读展示服务端 env，并且创建请求只提交 bot 名称，持久化用的 `provider/model` 统一来自服务端 `FASTAGENT_DEFAULT_*`
- 登录后控制台壳层改为更明显的“左 rail 承载品牌、顶部 banner 只承载工具”分工：桌面顶栏移除 logo，`Invites`/主题切换/语言切换统一高度，左 rail 的 `WeClaws` 字标加大加粗，桌面与移动端账号卡都固定在导航底部；桌面端进一步收敛为“全局页面滚动 + 左 rail 固定常驻视口”结构，长页面保留全局滚动条
- create bot 表单现在会为用户需要填写的 `Bot Name` 显示可见必填 `*`；只读 runtime 配置字段继续不显示必填标记
- bot 详情页重排为“头部横向摘要 + 左控制列 + 右事件列”：`当前运行状态` 与 `技术元数据` 合并进头部一张 summary surface，`运行概览` 与二维码移动到左侧，`最近事件` 独占右侧并改成单行紧凑列表，前端按 10 条一页分页且新事件到达后自动回到第一页
- 邀请码管理页的 `创建人` 和 `使用账号` 现在统一展示邮箱；页面首屏数据和 `/api/admin/invites` 返回都不再直接暴露内部 user id 给管理台列表
- 左 rail 的 `Bots` 导航激活态从深色高亮收敛为淡色选中；`Create Bot` 继续保持唯一主按钮样式
- 左 rail 的 `Create Bot` 主按钮文案与图标改为左对齐，保持整列 CTA 但不再居中排版

### Notes

- bot 创建仍然保持“先准备实例目录，再写单事务 DB 记录，失败则清理整个 bot root”的收敛顺序
- 新机器上的 fresh 开发环境不会再因为 SQLite 里残留旧宿主机路径而起不来
- 手动同步当前只支持 `sync-all-managed`；请求体已预留 future operation shape，但不会修改 `workspace/.fastagent/skills`

## 2026-04-07

### Changed

- `getEnv()` 现在会在开发态缺少必填变量时自动回退到工作区根目录 `.env`，`pnpm dev:web` 不再要求额外在 `apps/web` 目录准备独立 `.env*`
- web 本地开发继续优先使用当前进程已注入的环境变量；只有 `DATABASE_URL` / `APP_BASE_URL` / `BETTER_AUTH_SECRET` 缺失时才回退加载工作区根 `.env`
- `apps/web` 的 `pnpm test` 现在固定通过根级 `vitest --root apps/web --run` 执行，避免包目录内过期的本地 `vitest` shim 把测试入口指向不存在的虚拟仓库路径

## 2026-04-02

### Added

- 新增邀请码注册闭环：
  - `POST /api/auth/register-with-invite`
  - 注册页邀请码输入框
  - 仅服务端校验/消费邀请码的注册流程
- 新增管理员邀请码后台：
  - `GET/POST /api/admin/invites`
  - `/admin/invites` 管理页
  - `WEB_ADMIN_EMAILS` 白名单权限判断
- 新增真实主题切换层：
  - `ThemeProvider`
  - `ThemeToggle`
  - `theme` cookie 驱动的 `light / dark` token 切换
- 新增基于 `@radix-ui/react-dropdown-menu` 的账号菜单：
  - 左侧底部账号卡 trigger
  - `Details / Settings / Logout` 菜单项
  - `Details / Settings` 的 `Coming Soon` 禁用占位
  - Better Auth client `signOut` 驱动的真实退出动作
- 新增登录后全局顶部工具条 `ConsoleToolbar`，承载 logo、主题切换、语言切换与管理员入口
- 新增回归测试：
  - 邀请码注册 API
  - 管理员邀请码 API
  - 主题切换
  - 顶部工具条
  - 账号菜单与移动端账号入口
  - 邀请码管理台

### Changed

- `/register` 不再直接从客户端调用 Better Auth 注册；前端统一走邀请码注册 API，只有邀请码有效且 Better Auth 注册成功后才消费邀请码
- 邀请码注册从“固定 bypass header + 事后消费”收紧为“先预占邀请码，再带 server-only reservation token 调 Better Auth，成功后 finalize”
- 邀请码注册路由现在只会在 Better Auth 建号前的失败路径释放 reservation；如果建号成功但 finalize 失败，会保留 reservation，避免把一次性邀请码重新放回可用池
- Better Auth 原始 `/api/auth/sign-up/email` 现在由自定义 hook 校验 live reservation token；没有有效 reservation 的请求会直接收到 `403 INVITE_REQUIRED`
- 邀请码注册成功后，web 路由会逐条透传 Better Auth 返回的所有 `Set-Cookie` 响应头，而不是压成单个 header
- `/bots` 与 `/admin/*` 登录后页面统一接入顶部 utility banner；顶部只保留全局工具，侧栏重新承载工作区导航与账号身份
- `AppShell` 现在接受管理员态，并在顶部 banner 内按权限显示 `Invites` 入口；`/admin` 子树复用同一套控制台外壳
- `RootLayout` 现在在服务端读取 `theme` cookie，把 `data-theme` 注入到 `<html>`，避免主题切换首屏闪烁
- Claude 风格暖中性色 token 扩展为双主题：深浅色都沿用同一套语义变量，不新增兼容层或新字体
- 登录/注册右侧表单面板显著加宽，保持现有信息结构但提升了桌面端填写效率
- 控制台顶部工具条不再展示账号邮箱；账号身份与退出操作现在统一收敛到左侧底部 `AccountMenu`
- 桌面端左 rail 与移动端导航 sheet 现在都在底部放置账号卡，`Logout` 为真实动作，`Details / Settings` 保持禁用占位
- 认证页与登录后控制台的背景 token、容器透明度、弱描边与阴影重新收敛为连续画布，去掉明显的壳层分界线

### Notes

- 管理员权限当前明确限定为邮箱白名单，不引入数据库 role / RBAC 体系
- 邮箱验证码/邮件发送能力本轮未实现；注册门槛只依赖一次性邀请码
- 邀请码预占带 TTL；只有建号前失败才会主动释放 reservation，建号后如果 finalize 异常则宁可保留预占态，也不允许邀请码立即复用

## 2026-04-01

### Added

- 新增 Tailwind v4 + shadcn 风格前端基础层：全局 token、Radix/utility primitives、共享 `PageHeader` / `SectionCard` / `EmptyState` / `AppShell` / `AuthShell`
- 新增 cookie 驱动的中英文切换层：`LocaleProvider`、`LanguageSwitcher`、双语 messages、runtime/desired state 展示映射
- 新增 bot console 交互组件：`BotsConsole`、`BotOverviewStats`、`BotFilterBar`、`BotDetailHeader`、`BotMetadataPanel`
- 新增前端回归测试：
  - locale / status presentation
  - auth 文案切换
  - bot 列表筛选
  - create bot 表单默认值、pending、error
  - 详情页状态卡片、事件列表、二维码面板

### Changed

- Web 控制台整体视觉语言精修为 Claude 风格控制台：暖中性色 token、分层阴影、统一圆角梯度、弱化边框噪音，并同步更新 `Button` / `Input` / `Card` / `Badge` / `Sheet` / `Select` 的基础表现
- `AppShell` 从“厚重双卡片”改为轻导航 rail + 主工作区；`PageHeader`、`SectionCard`、`EmptyState`、`LanguageSwitcher` 同步收敛到更安静的层级和更强的标题节奏
- `/login` 与 `/register` 进一步改成 Claude 风格双区认证页：左侧品牌说明、右侧轻量表单卡片，移动端保持单卡片；登录/注册错误现在通过统一 `ErrorNotice` 以 `role="alert"` 方式播报
- `/bots` 列表页精修为“页头 + 轻概览带 + 筛选条 + 主列表”，列表卡片弱化状态噪音，突出 bot 名称、关键信息与唯一主操作
- `/bots/new` 创建页改成 intro 卡片 + 分组表单 + 底部行动区；创建错误也统一走 `ErrorNotice` 的告警样式
- `/bots/[id]` 详情页重组为摘要头部 + 双栏工作台：主栏承载事件与二维码，侧栏承载运行摘要、操作按钮和技术元数据；新增可访问 landmark：`Live Activity` / `Bot Controls`
- `/login` 与 `/register` 改为共享的 AI-console 风格认证壳层，表单使用统一 Tailwind 组件并接入双语文案
- `/bots` 改为带统计卡、搜索框、runtime 状态筛选和空状态分支的控制台，而不是原始列表
- `/bots/new` 改为分组创建表单，继续保留 `anthropic` / `claude-opus-4-6` 默认值与原有 POST 语义
- `/bots/[id]` 改为由 `bot-detail-live-view.tsx` 持有单条 EventSource，并拆分成摘要头部、运行概览、二维码、最近事件、技术元数据卡片
- raw runtime / desired state 不再在页面里直接拼字符串，统一走 `bot-status-presentation.ts` 生成翻译标签和视觉 tone
- `/bots` 子路由现在统一走 `src/app/bots/layout.tsx` 的共享登录后壳层，移动端导航使用 sheet

### Notes

- 语言切换保持同一路由，不引入 URL locale 前缀；切换动作只写 cookie 并 refresh 当前路由
- 本轮只升级前端展示层和交互状态，不修改 bot API、SSE 事件名、数据库字段或 supervisor 协议
- 登录/注册页的真实浏览器截图已在本地用 headless Chrome 做过人工巡检；鉴权后的 Bots 页面继续通过组件级行为测试和类型检查保证重构未破坏既有交互

## 2026-03-31

### Changed

- `createBot()` 现在先创建实例目录，再把 workspace 与 bot instance 写入单个 SQLite 事务；任一步失败都会最佳努力清理 `storage/instances/<botId>`
- 新创建的 bot 不再固化 `/usr/local/bin/fastagent`，而是持久化 `fastagentBinaryPath=null`，交给 supervisor 的全局路径配置处理
- `toApiError()` 现在只信任 `ApiError`；未知异常统一映射成通用 `500 / INTERNAL_SERVER_ERROR`，不再把内部 message 暴露给客户端
- `QrCodePanel` 改为只信任 `https://liteapp.weixin.qq.com/q/...`；只有通过共享 validator 的 URL 才会渲染 SVG 预览和外链
- bot SSE 持续轮询改为基于事件 cursor 的增量拉取，不再每轮全量扫描历史并维护 `seenEventIds`

### Notes

- 详情页首屏事件加载语义保持不变，仍然是一次性全量历史读取；本轮只优化持续流式轮询

## 2026-03-30

### Added

- 新增 Next.js App Router 的 Web 控制台骨架：`/`, `/login`, `/register`, `/bots`, `/bots/new`, `/bots/[id]`
- 新增 Better Auth 接入，使用 `users/sessions/accounts/verifications` 表并通过 Drizzle SQLite adapter 挂载到 `/api/auth/[...all]`
- 新增 bot 管理 API：
  - `GET/POST /api/bots`
  - `GET /api/bots/[id]`
  - `GET /api/bots/[id]/events`
  - `POST /api/bots/[id]/start`
  - `POST /api/bots/[id]/stop`
  - `POST /api/bots/[id]/restart`
  - `GET /api/bots/[id]/stream`
- 新增 bot service、repository 聚合、API error 规范化与基于 DB 轮询的单 bot SSE
- 新增最小 UI 组件：
  - 登录/注册表单
  - bot 列表
  - 创建 bot 表单
  - bot 状态卡片
  - bot 事件列表
  - QR code 展示
  - bot 详情实时视图
- 新增 `bot-service` DTO 测试，锁定列表摘要与详情视图的不同返回形状

### Notes

- 页面鉴权采用服务端 session 检查，不使用统一 middleware 拦截
- `restart` 只写 `restart_requested_at` 与 `desired_state=running`，不在 web 侧触碰 runtime 字段
- bot 实例目录由 web API 创建在 `storage/instances/<botId>/{data,workspace,logs}`
- detail API / SSE 首帧现在会返回 runtime 详情字段：`processPid`、`processStartedAt`、`heartbeatAt`、`weixinAccountId`、`lastQrCode*`、`lastError*`
- 详情页状态卡片和二维码面板已对齐真实 FastAgent 样本：允许 `lastQrCodeId=null`、保留结构化 runtime 错误文本、时间字段按本地可读格式显示
- `QrCodePanel` 现在会区分“直出图片 URL”和 `liteapp.weixin.qq.com/q/...` 这类扫码页 URL；对于扫码页链接不再错误渲染 `<img>`，而是明确提示用户在新标签页打开扫码
- 新增同源 `GET /api/qrcode?value=...` SVG 路由；当 runtime 只返回微信扫码页 URL 时，详情页会把该 URL 重新编码成可直接显示和扫码的二维码图片
- Next.js 构建现在输出 `standalone` 产物，并把 monorepo tracing root 固定到仓库根目录，供 Compose web 镜像只携带运行产物
