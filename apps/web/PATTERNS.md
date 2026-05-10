# PATTERNS

## Frontend Foundation

- Web UI 现在统一使用 Tailwind v4 + 复制到仓库内的 shadcn/Radix primitives，基础组件集中在 [`src/components/ui`](./src/components/ui)
- [`src/lib/env.ts`](./src/lib/env.ts) 在开发态会优先使用当前进程已有环境变量；`getEnv()` 需要的 web env（当前包括 `DATABASE_URL` / `APP_BASE_URL` / `BETTER_AUTH_SECRET` / `WEB_ADMIN_EMAILS` / `WEB_USER_BOT_LIMIT`）或 SRT 默认池 env 只要有缺项，就要回退加载工作区根目录 `.env`，但不能覆盖已经显式注入的同名值
- `resolveInstancesRoot()` 必须和 supervisor 共用 shared `resolveInstancesRootPath()` 语义；开发态需要先尝试从工作区根 `.env` 读取 `INSTANCES_ROOT`
- `apps/web` 的测试入口必须继续通过根级 `vitest --root apps/web` 执行；不要重新依赖 `apps/web/node_modules/.bin/vitest` 这类会把 pnpm 虚拟仓库路径写死到 shim 的包级可执行文件
- `apps/web/next-env.d.ts` 必须继续引用稳定的 `./.next/types/routes.d.ts`；不要提交本地 `next dev` 生成的 `./.next/dev/types/routes.d.ts` 漂移，否则 fresh checkout / CI 的 typecheck 和 build 会变成依赖开发态预热
- 需要弹出式操作菜单时，优先复用 [`src/components/ui/dropdown-menu.tsx`](./src/components/ui/dropdown-menu.tsx) 的 Radix primitive，而不是在业务组件里直接拼 menu 行为
- Claude 风格 refinement 继续沿用现有技术栈，不新增字体或兼容层；视觉统一通过全局 token、组件 class 重写和页面骨架重组完成
- 主题系统现在也是基础层的一部分：[`src/app/layout.tsx`](./src/app/layout.tsx) 在服务端读取 `theme` cookie，[`src/components/providers/theme-provider.tsx`](./src/components/providers/theme-provider.tsx) 在客户端负责切换 `html[data-theme]`
- 外部品牌锁定组件统一收敛到 [`src/components/layout/brand-lockup.tsx`](./src/components/layout/brand-lockup.tsx)，静态资源放在 `public/brand/*`，不要在 toolbar / rail / auth shell 各自重复拼 logo 样式
- 页面级共享外壳集中在：
  - 登录/注册：[`src/components/layout/auth-shell.tsx`](./src/components/layout/auth-shell.tsx)
  - 用户 Bot 控制台：[`src/app/bots/layout.tsx`](./src/app/bots/layout.tsx) + [`src/components/layout/app-shell.tsx`](./src/components/layout/app-shell.tsx)
  - 管理台：[`src/app/admin/layout.tsx`](./src/app/admin/layout.tsx) + [`src/components/layout/admin-shell.tsx`](./src/components/layout/admin-shell.tsx)
- [`src/components/layout/auth-shell.tsx`](./src/components/layout/auth-shell.tsx) 继续作为 `/login` 和 `/register` 的唯一共享外壳；桌面端左侧必须保留简洁的产品 hero，右侧表单卡片继续维持更平衡的宽度上限（当前为 `lg:max-w-[42rem]`），外层 grid 继续保持更开的画布（当前 `max-w-[110rem]`），左侧 hero 内容宽度也可以放到更宽的上限（当前 `max-w-[46rem]`），并进一步收紧桌面主 gap；当 hero 在小屏隐藏时，认证卡片必须回到 `w-full max-w-none` 占满单列可用宽度
- 认证页左侧 hero 文案统一从 [`src/lib/messages.ts`](./src/lib/messages.ts) 读取，并明确覆盖三件事：一个账号可管理多个 AI 助手、当前交互渠道是微信、支持语音/图片/文件类自动化任务；不要在页面里散落硬编码版本
- 认证页 hero 品牌锁定继续复用 [`src/components/layout/brand-lockup.tsx`](./src/components/layout/brand-lockup.tsx) 的 `hero` variant；当前视觉比例是更小的 logo + 更大的 `WeClaws` 字标，不要在 auth shell 里单独手写一套品牌块
- [`src/components/auth/sign-up-form.tsx`](./src/components/auth/sign-up-form.tsx) 的注册字段顺序固定为 `email -> password -> inviteCode`；只有 `email` 和 `password` 显示可见的必填标识，`inviteCode` 保持可选输入，且不要让这个视觉标识破坏原始字段可访问名称
- 共享展示容器优先复用 [`src/components/layout/page-header.tsx`](./src/components/layout/page-header.tsx)、[`src/components/layout/section-card.tsx`](./src/components/layout/section-card.tsx) 和 [`src/components/layout/empty-state.tsx`](./src/components/layout/empty-state.tsx)，避免重新回到 inline-style 页面
- 全局 token 现在区分 `app-bg / app-panel / surface / surface-elevated / surface-muted`，页面层级优先靠留白、字重和弱对比表面建立，而不是靠厚重边框
- 认证页和登录后控制台必须共享同一张暖色背景画布；分层优先靠透明度、阴影和弱描边，不要再回到明显“外层背景 vs 内层大盒子”的割裂做法
- 真实深浅色切换只允许改语义 token，不允许在页面组件里堆 if/else 兼容 class

## Internationalization

- 当前只支持 `zh-CN` 和 `en`，文案集中在 [`src/lib/messages.ts`](./src/lib/messages.ts)
- 服务端页面通过 `getRequestLocale()` 读取 cookie 并拿到对应 messages；客户端交互通过 `LocaleProvider` 的 `t()` 读取文案
- 语言切换只写 cookie 并 `router.refresh()` 当前页面，不做 URL 改写或路由前缀拆分
- 页面里不要直接拼 raw runtime/status 英文字符串；状态相关文案统一走 [`src/lib/bot-status-presentation.ts`](./src/lib/bot-status-presentation.ts)

## Auth

- Better Auth 统一在 [`src/lib/auth.ts`](./src/lib/auth.ts) 初始化
- React 客户端只通过 [`src/lib/auth-client.ts`](./src/lib/auth-client.ts) 访问 auth API
- 服务端页面使用 `getServerSession()` / `requireServerSession()`
- Route Handlers 使用 `requireRequestSession()`
- 登录仍然直接使用 Better Auth client；注册改为走 [`src/app/api/auth/register-with-invite/route.ts`](./src/app/api/auth/register-with-invite/route.ts)
- 邀请码注册默认必须遵守固定顺序：先 `reserve()` 一条 live invitation reservation，再调用 Better Auth server API 创建用户，最后 `consumeReservation()` 完成邀请码
- 唯一例外是“数据库里还没有任何用户且邮箱命中 `WEB_ADMIN_EMAILS`”的首个管理员自举注册：这一次会先申请一条带 TTL 的 bootstrap claim，再把 server-only bootstrap token 带进 Better Auth hook；首个用户落库后立刻恢复为邀请码流程
- 注册表单必须显式保留 `inviteCode` 输入；它是正常邀请码注册的默认入口，不能退回“纯邮箱密码直注册”的 client-only 流程
- Better Auth 原始 `/sign-up/email` 必须被 [`src/lib/auth-invite.ts`](./src/lib/auth-invite.ts) 的 hook 拦住；默认只有携带 live `inviteReservationToken` 且与 `reservedByEmail`/TTL 匹配的服务端调用才能放行，唯一例外是携带 live bootstrap claim token 且用户表仍为空的首个白名单管理员自举注册
- [`src/app/api/auth/register-with-invite/route.ts`](./src/app/api/auth/register-with-invite/route.ts) 只允许在 Better Auth 建号前的失败路径调用 `releaseReservation()`；建号成功后的 finalize 异常不能把邀请码重新释放
- 邀请码或首个管理员自举注册成功后，web 必须调用 `userSandboxRuntimePools.ensureForUser()` 为新用户创建默认 SRT pool；这一步失败只能记日志，不能回滚已创建账号或重新释放邀请码
- bootstrap claim 统一走 `registrationBootstrapClaims.claim()/release()`；claim 必须在 SQLite `immediate` 事务里同时检查“当前无用户 + 旧 claim 不活跃”，避免并发下放宽成多个首批管理员
- 服务端包装 Better Auth `signUpEmail()`/`signInEmail()` 这类响应时，必须逐条 append 所有 `Set-Cookie` header，不能用单个 `headers.get('set-cookie')` 压平
- hook 只做 reservation 校验和清洗 body，不负责消费邀请码

## Authorization

- bot 所有权检查统一走 `requireOwnedBot(botId, userId)`
- API 返回 `401` 用于未登录，`403` 用于越权访问，`404` 用于 bot 不存在
- 页面侧对于 `403/404` 的 bot 详情统一降级成 `notFound()`
- 管理员权限当前统一走 [`src/lib/admin.ts`](./src/lib/admin.ts)：
  - `WEB_ADMIN_EMAILS` 环境变量邮箱白名单
  - API 用 `requireAdminRequestSession()`
  - 页面布局用 `isAdminEmail()` + redirect
- 普通用户不能看到管理台入口，也不能访问 `/admin/*`
- 管理员入口只放在 `AccountMenu` 的 `Admin Console` 项；用户 Bot 工作台的顶部 toolbar 不再混入 `Invites` 或其它 admin 导航

## API Envelope

- 所有 bot API 返回统一 envelope：
  - 成功：`{ data, error: null }`
  - 失败：`{ data: null, error: { code, message } }`
- 统一错误转换在 [`src/lib/api-error.ts`](./src/lib/api-error.ts)
- 只有 `ApiError` 会原样透传到客户端；未知异常统一折叠成通用 500，避免泄露底层 DB/文件系统消息
- `POST /api/bots/[id]/skills/sync` 的成功和 busy 路径都继续走统一 envelope；当前 `busy` 用 `409 + { data: { result }, error: null }`

## Bot Service

- Route Handlers 不直接操作 DB repository 细节，也不触发任何本地进程
- [`src/lib/repositories.ts`](./src/lib/repositories.ts) 只缓存 DB client，不缓存 repository 实例；`next dev` 热更新后必须重新拿当前 class 定义，避免全局旧实例缺少新增 repository 方法
- bot 创建、状态切换、restart marker 写入统一收敛在 [`src/lib/bot-service.ts`](./src/lib/bot-service.ts)
- bot 重出码 intent 也收敛在 [`src/lib/bot-service.ts`](./src/lib/bot-service.ts) 的 `requestBotQrReissue()`；web 只写 `qrReissueRequestedAt`，不直接碰实例目录或 FastAgent 登录态文件
- `createBot()` 负责同时创建实例目录、workspace 记录和 bot instance 记录
- `WEB_USER_BOT_LIMIT` 是可选的全局“每用户 Bot 数量上限”；空值或 `0` 表示不限，正整数表示 owner-scoped hard limit
- `createBot()` 在真正建目录/写库前可以先按 owner 统计当前 Bot 数量做快速失败，但最终的 `WEB_USER_BOT_LIMIT` 硬限制必须在同一个 SQLite `immediate` 事务里完成“owner 计数 + 限额判断 + 插入”，避免并发创建越过上限；达到上限时统一返回 `409 BOT_LIMIT_REACHED`
- `createBot()` 的 DB 写入必须落在单个事务里；目录副作用失败或 DB 任一步失败时，要最佳努力删除整个 bot root
- web 不得把任何宿主机绝对路径写入 `workspaces` / `bot_instances`；包括 FastAgent binary、workspace/data/log 目录
- 实例目录必须由 `resolveBotInstancePaths(resolveInstancesRoot(), botId)` 派生，并在写 DB 前创建好目录树
- `resolveInstancesRoot()` 的解析必须尊重显式 `INSTANCES_ROOT` override；不能再硬编码 `storage/instances`，否则会和 supervisor 漂移
- 手动 skills 同步不进 `bot-service`；route 直接调用 shared managed skills 引擎，因为它不写 bot 意图，也不触碰 runtime 生命周期
- Bot 名称编辑统一走 `PATCH /api/bots/[id]` + [`src/lib/bot-service.ts`](./src/lib/bot-service.ts) 的 owner-scoped `updateBotName()`；只允许更新展示名称，不触发 restart intent，不修改 profile 绑定，也不改 `provider / model` runtime 快照
- Bot 二维码分享统一走 [`src/lib/bot-qr-share-service.ts`](./src/lib/bot-qr-share-service.ts)；owner 侧持有当前公开链接，public 侧只允许用 token-hash 读最小二维码状态，不直接暴露 bot owner 或其它 runtime 细节；公开轮询 API 必须显式 `no-store`
- bot DTO 显式拆为：
  - `BotSummaryItem`：列表页最小字段
  - `BotDetailItem`：详情页、命令响应、SSE 快照/状态更新字段

## SSE

- 当前基线只支持单 bot SSE：`/api/bots/[id]/stream`
- SSE 初始帧发送 `bot.status.updated`
- 后续通过 DB 轮询发出：
  - `bot.status.updated`
  - `bot.qrcode.updated`
  - `bot.event.created`
  - `bot.error.updated`
  - `bot.stream.error`
- 持续轮询必须走 DB cursor 增量读取；只允许在初始对齐阶段读取一次全量事件来建立最新 cursor
- bot 事件 cursor 必须使用 DB 返回的稳定 `rowId`，不能依赖 `(createdAt, id)` 这种可能在同毫秒插入时乱序的组合键
- 详情页只建立一条 EventSource 连接，由 `bot-detail-live-view.tsx` 统一分发到状态卡片、二维码面板和事件列表
- SSE 只消费数据库已经收敛后的 runtime 详情，不直接订阅 supervisor 内存状态
- `bot.error.updated` 只承载 `lastErrorCode / lastErrorMessage` 这类 bot runtime 字段；流本身的脱敏失败提示必须走单独的 `bot.stream.error`，不能再把 transport-level 异常伪装成 `BotDetailItem` patch

## Console Composition

- `/bots` 页面保持服务端取数、客户端筛选的分层：
  - route page 只负责 session + `listBots()` + 顶部 header
  - [`src/components/bots/bots-console.tsx`](./src/components/bots/bots-console.tsx) 持有搜索词、runtime status filter 和空状态分支
  - [`src/components/bots/bot-list.tsx`](./src/components/bots/bot-list.tsx) 只负责结果渲染和 inline rename 交互，不再持有数据获取和筛选逻辑
- 列表页重命名是当前唯一的 Bot 名称编辑入口：点击名称进入 input，`Enter` 保存、`Escape` 取消；保存成功后由 `BotsConsole` 只更新本地目标 bot，不刷新整个列表；具体表单副作用收敛在 [`src/components/bots/bot-rename-control.tsx`](./src/components/bots/bot-rename-control.tsx)
- 登录后全局工具区统一收敛到 [`src/components/layout/console-toolbar.tsx`](./src/components/layout/console-toolbar.tsx)，只承载移动端菜单入口、主题切换和语言切换；桌面品牌展示收口到左 rail，不再在顶部重复放 logo
- 浏览器元数据、左 rail 与认证页都应显示 `WeClaws` 品牌；对内 package/import 名称统一使用 `weclaws` / `@weclaws/*`
- 顶部工具条只承载全局工具和管理员入口，不再渲染账号邮箱；账号身份与会话动作统一放在 [`src/components/layout/account-menu.tsx`](./src/components/layout/account-menu.tsx)
- 顶部工具条左侧现在允许展示只读环境信息；当前固定展示 `FastAgent CLI v...` 轻量 badge，版本号由服务端读取 `apps/supervisor/package.json` 里的 `@fastagent/cli` 依赖值，读取失败时静默隐藏
- 左 rail 是登录后控制台唯一的桌面品牌区：[`src/components/layout/brand-lockup.tsx`](./src/components/layout/brand-lockup.tsx) 的 `rail` variant 必须使用更大、更重的 `WeClaws` 字标；不要再在 toolbar 里重复渲染品牌块
- 顶部工具条里的深浅色切换和中英文切换必须保持同一视觉高度，toolbar 整体作为扁平 utility strip，而不是第二个品牌 header
- 桌面端 `AppShell` 必须保留全局文档滚动条；左 rail 通过固定定位常驻视口，右侧主内容继续走正常页面流，不要再切成独立的局部滚动容器
- 左 rail 的 `Bots` 导航激活态保持淡色选中，不要回到深色高亮；主 CTA 继续只保留 `Create Bot` 按钮承担强强调，按钮文案与图标保持左对齐
- 桌面端账号卡固定在左 rail 最底部；移动端账号卡放进导航 sheet 最底部，账号信息不回到顶部工具条
- `AccountMenu` 里只有 `Details` 继续保持禁用占位；`Settings` 必须跳转到真实的 `/settings` 页面，`Logout` 继续通过 Better Auth client `signOut` 成功后跳转 `/login`
- Claude 风格列表页保持“页头 + 概览带 + 筛选条 + 主列表”的层级；overview stats 是轻量 summary strip，不再做成与主内容同权重的重卡片
- runtime status filter 只按 `status` 字段工作；`desiredState` 在列表页仍然是展示信息，不参与筛选
- 当列表里出现未知 runtime 值时，filter UI 可以暴露 `unknown` 选项，但 overview stats 仍只统计已知 bucket
- create bot 页的 runtime 配置摘要来自当前选中的 LLM profile；浏览器提交必须显式携带 `name + llmProfileId`，`provider / model` 从 profile snapshot 写入 `bot_instances`
- `/bots` 和 `/bots/new` 都要展示当前 owner 的 Bot 已用数量；如果 `WEB_USER_BOT_LIMIT` 生效，还要展示总上限与剩余额度，并在创建页命中上限时禁用提交按钮
- `/settings` 页面和 `GET/POST /api/settings/llm-profiles`、`PATCH/DELETE /api/settings/llm-profiles/{profileId}` 是当前唯一的用户级 LLM profile 入口；profile 为 owner-scoped CRUD，API key 不回显明文，只返回 `hasApiKey`
- 设置页里的 `API Type` 必须使用固定选项的 `Select`，当前只允许：
  - `anthropic-messages`
  - `openai-completions`
  - `openai-responses`
  - `google-generative-ai`
  `POST /api/settings/llm-profiles` 必须显式提供其中一个值；`PATCH /api/settings/llm-profiles/{profileId}` 可以省略 `apiType` 表示保持现值，但不允许显式写回 `null`
- 设置页的 LLM profile 表单里，`Profile Name / Provider / Model / API Type` 必须显示可见必填 `*`；`API Key` 只在创建新 profile 时显示必填标识，编辑现有 profile 时保留“留空表示保持当前 key”的稀疏更新语义
- legacy `apiType=null` 的 profile 在编辑时必须要求用户显式选择 `API Type` 后才能保存；不要因为空 PATCH、普通编辑或 UI 默认值把它们静默改写成某个跨 provider 的协议值
- 设置页的 `Base URL` 保持可选，但字段旁必须明确提示“留空将使用 Provider 官方默认 URL”；空输入统一落库为 `null`
- 设置页的 `API Key` 输入必须提供显式显示/隐藏切换；只允许切换可见性，不回显已保存的明文 key
- profile create / update 如果撞上同 owner 的重名唯一约束，web 必须稳定返回 `409 LLM_PROFILE_NAME_CONFLICT`；不能把底层 SQLite 异常透传或折叠成泛化 500
- profile 更新只有在字段实际发生变化时，web 才能为当前 owner 名下绑定了该 profile 且 `desiredState=running` 的 bot 写入 restart intent；空 PATCH 或 no-op PATCH 必须返回 `restartRequestedBotCount=0`
- 删除 profile 时，如果仍有 bot 绑定它，接口必须返回 `409 LLM_PROFILE_IN_USE`
- 删除 profile 时，如果预检查之后又有 bot 并发绑定导致 FK 删除失败，web 也必须继续收口成同一个 `409 LLM_PROFILE_IN_USE`
- bot DTO 里的 `provider / model` 必须展示 bot 自己最近一次已应用/将应用的 runtime 快照；这份快照来自 `bot_instances`，由 create-bot 和 supervisor spawn 前刷新，不能直接跟随账号当前设置即时漂移
- bot DTO 里的 `llmConfigId / llmProfileName` 必须表示 bot 当前绑定的 LLM profile；详情页切换 profile 统一走 `PATCH /api/bots/{id}/llm-profile`，并在 `desiredState=running` 时写入 restart intent

## Admin Invites

- `/admin/invites` 页面走“server data + client action”分层：
  - route page 负责 session 校验和初始 `listRecent()`
  - [`src/components/admin/admin-invites-console.tsx`](./src/components/admin/admin-invites-console.tsx) 负责生成邀请码按钮、错误反馈和列表更新
- 管理台列表只展示邀请码状态与审计字段，不承担批量导出、筛选或复杂运营逻辑；审计展示必须优先显示创建人/使用账号邮箱，而不是内部 user id
- 新邀请码创建统一调用 `POST /api/admin/invites`，由服务端生成 code；前端不能自己拼邀请码
- 删除邀请码统一调用 `DELETE /api/admin/invites/{id}`；只有 `unused + unreserved` 的记录允许删除，`reserved/used` 必须返回 `409 INVITE_DELETE_NOT_ALLOWED`

## Admin Sandbox Runtime

- `/api/admin/sandbox-runtime/pools` 是 sandbox-runtime 管理台的数据入口；route 只做管理员鉴权和 API envelope，配置/status 合并逻辑收敛在 [`src/lib/sandbox-runtime-admin.ts`](./src/lib/sandbox-runtime-admin.ts)
- `/admin/sandbox-runtime` 是管理台默认入口，`/admin` 必须重定向到这里；邀请码管理继续放在 `/admin/invites`
- admin 子树必须使用独立 [`src/components/layout/admin-shell.tsx`](./src/components/layout/admin-shell.tsx)，不要再复用用户 Bot 工作台的 `AppShell`
- [`src/components/admin/admin-sandbox-runtime-console.tsx`](./src/components/admin/admin-sandbox-runtime-console.tsx) 负责 manager resource summary、紧凑的 per-user pool 列表，以及单 pool 的模态框编辑；服务端 page 只做初始数据读取
- sandbox-runtime 管理 API 只能返回 `apiKeyConfigured`，不能把 `user_sandbox_runtime_pools.api_key` 明文或局部掩码返回给浏览器
- sandbox-runtime 管理 API 在读写 `defaultDenyRead` 时必须净化 `/etc/mtab`；Linux remote sandbox 的 mount 信息降敏统一依赖标准化 `${WECLAWS_DATA_ROOT}` 和敏感 `/proc` 入口 deny，不能让管理台继续把这条历史坏配置写回数据库
- status 文件路径统一通过 `resolveSrtPoolStatusFile()` 解析；缺失 `srt-pool-status.json` 是允许状态，页面/API 仍应展示数据库里的 pool 配置
- 管理台列表在账号很多时必须优先展示紧凑摘要；列表级详细信息只保留并列展示的 `Port / CPU / 内存`，`重启 / 启停 / 保存配置` 与其他运行细节统一收进模态框，不要回到每个账号一整块展开编辑
- `workspaceBasePath` 属于 runtime 派生路径，不允许在浏览器里编辑，也不允许通过 admin PATCH 更新
- admin pool 表单至少要做本地正整数校验，以及 `minReadyProcesses <= poolSize`、`portRangeStart <= portRangeEnd` 这两条跨字段校验；无效输入不应发出 PATCH 请求
- PATCH pool 只允许更新显式配置字段；任何未知字段、`workspaceBasePath` 或 API key material 都必须返回 `400 SRT_POOL_INVALID_CONFIG`
- pool 配置不存在统一返回 `404 SRT_POOL_NOT_FOUND`，child port 冲突统一返回 `409 SRT_POOL_PORT_CONFLICT`，端口段冲突统一返回 `409 SRT_POOL_PORT_RANGE_CONFLICT`
- 管理台展示 owner 信息时优先显示用户邮箱；repository 层继续保持窄接口，不为 admin UI 写 join 型宽查询

## Detail Presentation

- [`src/components/bots/bot-detail-live-view.tsx`](./src/components/bots/bot-detail-live-view.tsx) 继续作为详情页唯一的 EventSource owner，子组件只消费 props，不自行开流
- 详情页头部现在先渲染 bot 身份摘要，再在同一张横向 summary surface 内并排呈现 `当前运行状态` 和 `技术元数据`；不要再把 metadata 作为独立正文卡片放回主工作区
- 详情页工作区现在固定为“双栏主次结构”：
  - 左栏是 `Bot Controls` complementary region，用于合并后的 `运行概览`、命令按钮和删除入口
  - 右栏是 `Live Activity` region，用于最近事件
- [`src/components/bots/bot-status-card.tsx`](./src/components/bots/bot-status-card.tsx) 保留 `Start` / `Stop` / `Restart` 三个按钮始终可见；只在请求进行中统一禁用，不做 runtime 乐观更新
- [`src/components/bots/bot-status-card.tsx`](./src/components/bots/bot-status-card.tsx) 现在承担 `Reissue QR` 入口：`Reissue QR` 只写 runtime intent；二维码分享开关和复制链接收敛到 [`src/components/bots/bot-qr-share-controls.tsx`](./src/components/bots/bot-qr-share-controls.tsx)，统一走 owner-scoped `/api/bots/[id]/qr-share`
- [`src/components/bots/bot-status-card.tsx`](./src/components/bots/bot-status-card.tsx) 现在额外提供 `Sync Skills` 按钮，只同步托管 `data/skills`，并以内联反馈展示成功 / busy / 非阻断错误
- [`src/components/bots/bot-status-card.tsx`](./src/components/bots/bot-status-card.tsx) 现在还承担 bot 删除入口；删除只允许在 `desiredState=stopped`、`status=stopped`、`processPid=null` 时启用，并且必须经过 inline `Delete Bot -> Confirm Delete` 两步确认，成功后返回 `/bots`
- 详情页二维码只在 `status=waiting_for_qr` 时展示；即使数据库里仍保留最近一次 `lastQrCode*`，bot 进入 `running` / `degraded` / `stopped` 后也不能继续把旧二维码展示给用户
- 公开二维码页统一走 [`src/components/bots/public-qr-share-view.tsx`](./src/components/bots/public-qr-share-view.tsx)；该页面不要求 WeClaws 登录态，只轮询公开 `GET /api/share/qr/[token]` 并渲染当前最新二维码
- `运行概览` 卡片不再重复渲染头部已经展示过的 `status / desiredState / heartbeat / process state / latest error` 等字段；二维码内容直接内嵌到卡片顶部，独立二维码卡片与额外小标题块都移除
- bot 详情页里的 `返回 Bots` 按钮保持右对齐
- 删除 bot 时，实例目录清理是 best-effort；如果 DB 级删除已经成功，目录清理失败只能记日志，不能把接口整体打成 `500`
- [`src/components/bots/qr-code-panel.tsx`](./src/components/bots/qr-code-panel.tsx) 仍然只接受 shared validator 信任过的二维码 URL，并继续走同源 `/api/qrcode?value=...` 预览
- [`src/components/bots/bot-events-list.tsx`](./src/components/bots/bot-events-list.tsx) 只展示当前顺序的事件，不在组件内二次排序；新事件插入顺序由 live view 控制，并且列表只做客户端 `10` 条一页的本地分页，新事件到达后重置回第一页
- 客户端组件里不要直接在 render 阶段输出 `Intl.DateTimeFormat(...).format(new Date(...))` 这类本地化时间文本；这会在 SSR 与浏览器时区不一致时触发 hydration mismatch。当前统一通过 [`src/components/ui/localized-date-time.tsx`](./src/components/ui/localized-date-time.tsx) 先渲稳定首屏文本，再在挂载后切到本地化时间

## Form and Feedback

- 认证表单、创建表单和 bot 命令失败提示统一走 [`src/components/ui/error-notice.tsx`](./src/components/ui/error-notice.tsx)
- 用户需要填写且 `required` 的表单字段必须显示可见 `*`；只读 runtime/env 展示字段不要误标成必填
- 所有这类内联错误都必须暴露 `role="alert"` 和 `aria-live="polite"`，保证视觉与无障碍语义同步
- 认证页保持桌面双区、移动单卡片；创建页保持 intro + grouped form + action footer，不回退到单一大卡片堆字段
- 邀请码注册错误和管理员邀请码生成错误也必须走同一套 `ErrorNotice`，不要混回原始红字或 toast-only 方案

## UI Scope

- 当前 UI 只覆盖最小可用闭环，不引入全局状态管理或 middleware 鉴权
- 登录/注册只保留邮箱 + 密码；显示名由邮箱前缀派生
- 详情页状态卡片展示 runtime 详情字段，但按钮依旧只发命令，不做进程级乐观更新
- `QrCodePanel` 不能假设 `lastQrCodeId` 一定存在；真实 runtime 允许只提供 `lastQrCodeUrl`
- `QrCodePanel` 只信任 shared validator 通过的 `liteapp.weixin.qq.com/q/...` URL；其他 scheme/host/path 一律按“无可用二维码”处理
- 可信扫码页 URL 统一走同源 `/api/qrcode?value=...` 重新编码成 SVG 预览，同时保留原始扫码页链接
- 状态卡片里的时间与错误字段直接消费 DB 已收敛后的 runtime 值，不再额外推断 mock 专用语义

## Deployment Packaging

- Web Docker 打包走 Next `standalone` 输出，`outputFileTracingRoot` 固定指向 monorepo 根，避免 workspace 包在镜像运行时丢失 traced 依赖
- 即使运行层只带 Next 产物，也必须保留仓库根的 `pnpm-workspace.yaml`，因为 `getWorkspaceRoot()` 会用它定位 `/app/storage/sqlite` 和 `/app/storage/instances`
- `web` 运行镜像还必须保留 `/app/apps/supervisor/package.json`：页头的 `FastAgent CLI v...` badge 由 [`src/lib/fastagent-cli-version.ts`](./src/lib/fastagent-cli-version.ts) 在运行时读取这份文件里的 `@fastagent/cli` 版本
- `web` 运行镜像还必须保留 `/app/resources` 与 `procps`：`POST /api/bots/[id]/skills/sync` 需要读取 `resources/skills/managed`，并通过 `ps` 支撑 managed-skills 锁的进程启动时间校验
- Compose 的 `web` 服务必须显式注入 `WEB_ADMIN_EMAILS`、`WEB_USER_BOT_LIMIT` 和核心 web env；Next `standalone` 运行层不能假设容器内还能读取宿主机根 `.env`
- Compose 部署时，`web` 与 `supervisor` 都必须挂同一个 `claws_instances` 卷；创建 bot 的实例目录不是 supervisor 独占写路径
