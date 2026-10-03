# Yas / HAPI 首轮安全审查：对外数据发送

审查日期：2026-10-03。初始上游：`tiann/hapi@86c88df93baf5d1f738dd4b202078bdf6dec376e`。Yas 品牌基线：`31eb4e9b`。

## 结论

**存在多条对外发送数据的路径，不能把“自托管”或“推送加密”理解成“完全不向第三方发送数据”。**

1. 核心控制链路把会话、工具事件及机器信息同步到用户配置的 Hub；Hub 能读取这些内容。
2. 启用网络隧道后，使用上游中继和官方托管网页。生成的网页直达 URL 把长期 Hub 访问令牌放进查询参数；打开该链接会把令牌发给网页托管端。
3. 原生推送默认选择上游推送中继，实际发送需要注册设备和通知事件。正文有应用层加密，但设备推送令牌、平台等元数据仍对中继可见。私有 FCM 直推没有同样的正文加密。
4. 语音助手除音频外，还会发送会话上下文和权限请求参数；语音输入转写也会向选定供应商发送录音。
5. 外部图片、终端字体、可选 Telegram/Server酱通知、可选调试日志上传、构建下载和 GitHub AI 工作流也会产生外发。

在本次检查的一方源码中，未识别出独立接入的 Sentry、PostHog、Mixpanel、Amplitude、Google Analytics、Crashlytics 等通用统计 SDK，也未识别出一条无条件向作者服务器上传全部项目源码的路径。**这不是“无恶意代码”或“无外发”的证明**：Agent、MCP、扩展、依赖包、预编译二进制和远端服务没有被完整审计。

本轮只做品牌初始化和审查记录，**没有修改以下网络默认行为，也没有部署服务或启用真实通知**。README 中的关闭推送示例是运行建议，不是已经生效的运行时整改。

## 范围与方法

- 静态检查 `cli/`、`hub/`、`web/`、`relay/`、Android/iOS 的相关传输代码、`website/`、构建脚本和 `.github/workflows/`。
- 搜索 HTTP/WebSocket/Socket.IO 调用、硬编码域名、遥测/日志上传、推送、动态脚本、字体、依赖安装和发布路径；沿调用点核对条件与载荷，而非仅依赖域名命中。
- 运行相关既有单元测试，推送传输使用模拟 `fetch`，加密使用测试数据，没有向真实推送平台发送设备令牌或会话内容。
- 未抓取生产流量，未登录真实 Agent 执行任务，未审查用户已有会话、凭据或全局配置，未运行完整依赖漏洞扫描，未证明所有第三方依赖的实际联网行为。
- 下列评级是本轮针对数据外发的整改优先级，不是 CVSS，也不等于存在未认证远程漏洞。

## 外发清单

| 路径 | 接收方 | 触发条件 | 发送内容 | 默认与边界 |
| --- | --- | --- | --- | --- |
| CLI / Runner → Hub | `HAPI_API_URL`，默认 `http://localhost:3006` | 注册机器、启动/导入会话、运行任务 | 会话消息、工具调用/结果、审批、机器和项目元数据；按功能传输文件/终端内容 | 核心功能；远程 Hub 是可信数据处理方，不是只能看密文的转发器 |
| 网络隧道 | 默认 `relay.hapi.run`，以及 tunwg 使用的网络设施 | 显式 `hub --relay` | 密钥申请请求、连接元数据和隧道流量 | 隧道默认关闭；外部 tunwg 二进制的全部协议和加密实现不在本轮验证范围 |
| 官方网页直达链接 | 默认 `https://app.hapi.run` | 隧道就绪后，用户打开网页 QR/直达链接 | 首个 GET 的 `hub`、`token` 查询参数；运行中的网页 JS 可读取令牌和会话 | 高优先级；单纯隧道加密不能消除网页宿主的信任要求 |
| 原生推送中继 | 默认 `https://push.hapi.run/v1/push`，之后 APNs / FCM | 已注册兼容设备且产生通知 | 推送设备 token、平台、优先级、加密 envelope；iOS 另有含会话 ID 的 collapse ID | Android 默认 `auto`，无私有凭据时选 relay；iOS 默认 relay；无设备不发送 |
| 私有 Android FCM | `oauth2.googleapis.com`、`fcm.googleapis.com` | 配置匹配的 Firebase 服务账号并发送通知 | OAuth 凭据交换；设备 token、会话 ID/名称、正文、工具参数摘要或助手回复摘要 | HTTPS 传输，但通知正文未做与官方 relay 路径同样的应用层加密 |
| 直接 iOS APNs | `api.push.apple.com` / sandbox | 显式 APNs 模式、配置密钥并发送 | 加密通知 envelope、设备 token、collapse ID、优先级 | 可绕过 HAPI 推送中继；Apple 仍接收投递元数据 |
| Web Push | 浏览器订阅返回的推送 endpoint | 用户订阅且产生通知 | 通过 `web-push` 库交付的加密通知载荷及路由信息 | 不是只发给 Hub；未订阅不发送 |
| Telegram | Telegram Bot API；网页 `telegram.org/js/telegram-web-app.js` | 配置机器人；通知还要求绑定用户；SDK 在检测到 Telegram 环境时加载 | 会话/机器通知、权限信息、任务摘要、交互数据；SDK 请求元数据 | 普通浏览器启动不会无条件加载 Telegram SDK |
| Server酱 | `https://sctapi.ftqq.com/<sendKey>.send` | 配置 send key、启用对应通知并触发事件 | 会话名、Hub 会话 URL、问题或任务失败摘要 | 可选第三方明文处理，HTTPS 并非对接收方保密 |
| 语音助手 | ElevenLabs、Google Gemini、阿里云 DashScope，按所选后端 | 配置提供商并启动语音会话 | 音频、会话文本、项目路径/摘要、增量消息、权限请求参数等 | 超出单纯语音识别；数据范围见 F-04 |
| 语音转写 | OpenAI、ElevenLabs、Deepgram、Groq 或自定义转写地址 | 选择已配置的提供商并录音/转写 | 音频、转写模型/语言参数、认证或短期会话凭据 | 自定义地址也可以是本地服务；取决于配置 |
| 远程调试日志 | `HAPI_API_URL` 下的 `/logs-combined-from-cli-and-mobile-for-simple-ai-debugging` | 两个相关环境变量同时非空 | 时间、级别、日志消息及参数、平台 | 默认关闭，但字符串 `false` / `0` 仍会开启，见 F-05 |
| 终端字体 | `cdn.jsdmirror.com`，失败后 `cdn.jsdelivr.net` | 打开需要字体的终端且没有匹配的本地 Nerd Font | 固定字体请求、IP/请求元数据 | 不发送终端文本；不是纯本地资源 |
| Markdown 外链图片 | 消息中图片 URL 指定的主机 | 渲染含外链图片的消息 | 图片 URL 全部内容、IP/浏览器请求元数据，可能有受策略限制的 Referer | 无点击确认；URL 可携带文本编码的数据，见 F-06 |
| 独立营销站 | Google Fonts / `fonts.gstatic.com`、GitHub API | 访问 `website/` 的页面/版本组件 | 字体与最新发布版本请求、连接元数据 | 与 `web/` 控制台区别对待 |
| 构建、安装与发布 | npm registry、GitHub Releases/raw、Gradle/Maven 等 | 安装依赖或运行相应脚本 | 包名、平台、版本及连接元数据；发布工作流会上传构建产物 | tunwg 未锁定校验值；源码启动和 npm 上游二进制启动不同，见 F-07 |
| GitHub AI 自动化 | Codex Action 使用的 OpenAI 或自定义 API endpoint | 启用继承工作流、配置密钥并满足事件条件 | PR/Issue/评论及被读取的代码上下文 | 与本机运行时外发分开；本轮没有配置或启用这些服务 |
| Agent / MCP / 工具 | Agent 配置的模型服务和工具目标 | 运行相应任务或工具 | 由 Agent、权限、扩展及任务决定，可能包含源码 | 属于系统整体数据边界，不能由“Hub 自托管”消除 |

## 重点发现

### F-01 · 高 · 官方托管页面 URL 携带长期 Hub 访问令牌

证据：[Hub 生成直达链接](../../hub/src/startHub.ts#L337)、[前端读取并持久化 token](../../web/src/hooks/useAuthSource.ts#L88)、[relay 模式停用本地静态页面](../../hub/src/web/server.ts#L312)。

流程为：`--relay` → 生成 `https://app.hapi.run/?hub=...&token=...` → 用户打开链接 → 首次 HTTP 请求把查询参数送达官方页面的托管端 → 页面 JS 把长期 token 写入该网页 origin 的 localStorage。

这使托管端具备接收令牌的技术条件；实际是否记录在服务端日志中没有核实，不能断言作者已经收集或滥用了令牌。即便页面稍后清理 URL，也无法撤销首次请求。托管网页的后续 JS 更新同样属于需要信任的代码。

建议：Yas 使用自托管前端和 Hub；首次配对改用短期、一次性、设备限定的代码，兑换为可撤销设备凭据。不要把长期控制令牌放入第三方 URL。把令牌改到 fragment 只能避免 HTTP 查询泄露，不能阻止页面 JS 读取，不能作为完整修复。

### F-02 · 中 · 原生推送默认选择上游中继，元数据未隐藏

证据：[Android 默认路由](../../hub/src/fcm/androidPushConfig.ts#L15)、[iOS 默认路由](../../hub/src/push-ios/iosPushConfig.ts#L47)、[relay 请求字段](../../hub/src/push-native/relayClient.ts#L29)、[Android 逐设备加密](../../hub/src/fcm/androidRelayService.ts#L35)、[iOS collapse ID](../../hub/src/push-ios/iosPushService.ts#L94)、[AES-256-GCM](../../hub/src/push-native/envelope.ts#L66)。

通知正文使用设备密钥进行 AES-256-GCM 加密，这是有效的保护。但中继接收未加密的投递 token、平台和优先级；iOS 的 collapse ID 还暴露事件类型和会话标识。接收方可观察连接来源、时序、频率和大小。

**条件性默认**：选择 relay 不代表一启动就上传通知；需要先有兼容设备注册和通知事件。`--no-relay` 只关闭网络隧道，不关闭推送中继。上游注释中“leaks nothing”的表述不适用于元数据。

建议：Yas 原生推送默认设为 `off`，首次启用说明接收方；需要推送时选择自己的中继或直连供应商，并最小化可见标识。Android 改了 application ID 后，不能假定上游 Firebase 项目/官方 relay 可以投递 Yas 自建 APK，应配套自己的 Firebase 项目和传输配置。

### F-03 · 中 · 私有 FCM 直推会向 Google 提交通知正文

证据：[构造并发送 FCM data](../../hub/src/fcm/fcmService.ts#L168)、[正文来源](../../hub/src/notifications/nativeNotificationComposer.ts#L43)。

直推包含会话名称、标题、正文、会话/请求标识、可选摘要。权限通知会带工具参数摘要；任务完成时可带最近助手回复的片段。它通过 HTTPS 发送，但未经过 `encryptEnvelope`，因此 Google 作为接收服务可以处理正文。

建议：直推复用应用层 envelope 格式，或推送只包含不敏感的唤醒标识，App 打开后从 Hub 获取具体内容。不要把“所有 Android 通知都端到端加密”作为产品描述。

### F-04 · 中；敏感代码场景优先 · 语音助手会发送会话上下文

证据：[启动上下文与增量转发](../../web/src/realtime/hooks/voiceHooks.ts#L51)、[上下文计划](../../web/src/realtime/hooks/voiceContextPlan.ts#L78)、[默认转发选项](../../web/src/realtime/voiceConfig.ts#L4)、[权限参数序列化](../../web/src/realtime/hooks/contextFormatters.ts#L87)、[ElevenLabs 会话](../../web/src/realtime/RealtimeVoiceSession.tsx#L70)、[转写服务请求](../../hub/src/web/routes/voice.ts#L85)。

启动语音会话会把上下文交给选中的语音模型服务。默认允许消息转发，历史计划最多选取 50 条已加载消息，再按格式和字节预算裁剪；后续消息也能继续发送。不能把 50 条理解成整个会话生命周期的总外发上限。

虽然普通工具上下文设有 `LIMITED_TOOL_CALLS: true`，权限请求格式化函数仍直接 `JSON.stringify(toolArgs)`。项目路径、代码片段、命令参数或其他敏感内容如果进入这些字段，也可能交给语音供应商。输入转写和能操控 Agent 的语音助手应分开说明。

建议：将“仅转写”和“分享会话给语音助手”分开授权，默认不分享历史；按会话选择范围，过滤命令、路径和疑似凭据，并在启用前展示实际接收方。

### F-05 · 中；错误配置时可高 · 可选远程日志上传不脱敏

证据：[开启条件](../../cli/src/ui/logger.ts#L50)、[上传载荷](../../cli/src/ui/logger.ts#L180)、[每次日志触发](../../cli/src/ui/logger.ts#L202)。

`DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` 和 `HAPI_API_URL` 同时非空就开启。判断使用字符串真值，所以把前者设成 `false` 或 `0` **仍然开启**。接收地址取自配置的 Hub，并不是固定的作者域名。

日志参数会被序列化上传，未见此路径执行凭据脱敏或要求 HTTPS。日志可能包含消息、工具输出等调用方传入的数据；服务端即使返回 404，请求体也已经发送。`debugLargeJson` 在未设置 DEBUG 时记录“跳过检查”信息，却未提前 return；不能仅靠关闭 DEBUG 防止日志内容产生。

建议：删除该开发遗留路径，或要求严格显式开启、HTTPS、认证、脱敏及数据量限制。当前想关闭应 **unset** 该环境变量，而不是赋值 `false`。

### F-06 · 中 · 消息中的远程图片可触发未确认的外发请求

证据：[URL 过滤](../../web/src/components/assistant-ui/markdown-text.tsx#L254)、[直接渲染 img](../../web/src/components/assistant-ui/markdown-text.tsx#L876)。

HTTP(S) 图片地址可通过 URL 过滤并直接进入 `<img>`。渲染消息时，浏览器就会请求图片主机，无需用户点击链接。至少会暴露 IP 和所请求 URL；若 URL 已编码消息数据，数据也会随请求发出。此处没有证明存在实际恶意消息，也不能据此声称会自动读取任意本地文件。

建议：外链图片默认占位，点击后加载；设置 `referrerPolicy="no-referrer"`；优先仅允许 Hub 附件和已批准的来源。仅设置 Referrer 策略不能阻止 URL 本身携带数据。

### F-07 · 中 · 构建依赖未固定的 tunwg 预编译二进制

证据：[下载脚本](../../hub/scripts/download-tunwg.ts#L14)、[执行二进制](../../hub/src/tunnel/tunnelManager.ts#L138)、[上游 npm 二进制包装器](../../cli/bin/hapi.cjs#L42)、[构建入口](../../package.json#L22)。

单文件构建调用下载脚本，从 `tiann/tunwg/releases/latest/download/...` 下载可执行文件。脚本检查 HTTP 状态后写入并赋予可执行权限，未见固定版本、预期 SHA-256 或签名验证。首次构建结果可能随 latest 变化；缓存存在时直接跳过。

这证明存在供应链信任依赖，并不证明该二进制恶意或已外泄数据。其全部实际网络行为没有经过本轮反汇编或抓包审查。

CLI 的上游 npm 包装器还会执行 `@twsxtd/hapi-<platform>` 中的二进制，而不是 Yas 修改后的源码。Yas 当前应使用 README 的源码入口。新增 `private: true` 不能替代对独立发布脚本的审查。

建议：固定 tunwg 版本和校验值、记录来源，或从固定源码构建；分离不含隧道的构建；发布 Yas 前调整全部包名、二进制引用和发布目标。

### F-08 · 低 / 配置相关 · 第三方静态资源和继承的 CI 仍在

证据：[终端字体](../../web/src/lib/terminalFont.ts#L9)、[Telegram SDK](../../web/src/hooks/useTelegram.ts#L138)、[条件加载入口](../../web/src/main.tsx#L43)、[营销站字体](../../website/src/index.css#L1)、[版本查询](../../website/src/hooks/useLatestVersion.ts#L32)、[AI PR Review](../../.github/workflows/codex-pr-review.yml#L56)、[Pages CNAME](../../.github/workflows/webapp.yml#L32)。

终端缺少本地 Nerd Font 时访问公共 CDN；营销站有外部字体和 GitHub 版本查询。它们不等于上传会话，但意味着访问站点不保证零外连。

继承的 AI 工作流在满足事件和配置要求后，会将被读取的 Issue/PR/代码上下文交给所配置的模型 endpoint。发布/Pages 流程仍有 HAPI 的域名、包名或 Homebrew 目标。不要仅改显示名称后直接启用全部工作流。本轮没有提交密钥、启动发布流程或发布构建产物。

建议：静态资源本地打包；CI 采用显式启用清单；Yas 首次发布前修改目标域名、包名和签名配置。AI 审查自动化单独设置数据范围和凭据。

## 容易误判的部分

- `/api/voice/telemetry` 在本次看到的实现中接收事件并写 Hub 控制台日志；不是仅因名字含 telemetry 就认定它发送到作者服务器。证据：[处理函数](../../hub/src/web/routes/voice.ts#L790)。部署平台怎样采集这些日志属于额外边界。
- 核心 CLI 默认连 localhost，不默认连作者的云端 Hub。证据：[CLI 配置](../../cli/src/configuration.ts#L87)、[注册会话](../../cli/src/api/api.ts#L57)。但一旦配置远程 HTTP Hub，令牌和内容可能在该链路缺少 TLS 保护，应要求 HTTPS 或受保护的本地转发。
- Hub 是能读会话内容的服务器。SQLite 内容压缩是 JSON/zstd，不是加密；加密推送不等于数据库或 CLI→Hub→App 全链路对 Hub 不可见。证据：[存储编码](../../hub/src/store/contentCodec.ts#L72)。
- `push.hapi.run` 和 `relay.hapi.run` 是两条独立路径。关闭其中一个不会自动关闭另一个。
- Firebase 示例只有占位值；真实 `google-services.json` 被 gitignore 排除。自建 Yas APK 没有提供该文件时不启用 Firebase，但不能推断带 Firebase 配置的构建也完全离线。证据：[PushBinding](../../android/app/src/main/kotlin/app/hapi/companion/push/PushBinding.kt#L12)。
- HTTPS 保护传输，不阻止接收服务读取明文；加密 envelope 保护正文，不隐藏所有元数据。

## 建议的首轮整改顺序

1. **P0：** Yas 自托管前端；移除向官方网页发送长期令牌的流程；配对使用短期、一次性设备代码。
2. **P1：** 原生第三方推送默认关闭；语音上下文分享单独确认；删除或严格限制远程日志上传；外部图片点击加载。
3. **P1：** 为 Yas Android 配置独立 Firebase/签名及匹配传输；私有 FCM 也加密正文或只发送唤醒信息。
4. **P2：** 本地打包字体；固定 tunwg 校验值；整理上游发布渠道和工作流；完善 HTTPS、令牌撤销与日志脱敏。
5. **验证：** 隔离环境使用虚构会话和测试账户抓包，覆盖空启动、消息/审批、图片/终端、语音、推送、断线恢复与构建下载。按场景维护 egress allowlist，并审计子进程和 Agent/MCP 的网络。

整改前的保守运行方式：使用独立 `HAPI_HOME`、自托管网页、`--no-relay`、`HAPI_ANDROID_PUSH=off`、`HAPI_IOS_PUSH=off`，unset 远程日志开关；不配置 Telegram/Server酱/语音服务、不订阅 Web Push。**这仍不是离线保证**，因为外部图片、字体、Agent 及工具的联网需要另行控制。

## 已完成的验证

- 依赖：`bun install --frozen-lockfile --ignore-scripts`；没有执行依赖生命周期脚本，没有运行 tunwg 下载/执行脚本。
- 更名：Web 标题/PWA 既有测试 7 项通过；CLI entrypoint 既有测试 22 项通过；源码 `bun run yas --help`、`--version` 成功。内部版本输出仍沿用上游 `hapi version`。
- 网页：`bun run typecheck:web`、`bun run build:web` 成功；构建仍有上游字体路径、Browserslist 数据和大 bundle 警告。
- 静态产物：构建后的 HTML/PWA manifest 为 Yas；Android 中英文 XML、Firebase 示例与 application ID 一致；Android 辅助 shell 脚本语法检查通过。
- 安全相关：推送 envelope、relay 请求、Android/iOS 配置共 38 项既有测试通过；其中 iOS 主目录临时文件测试初次被沙箱拒绝，获准后该文件的 9 项测试全部通过。没有真实外部推送。
- 环境：本机 Bun 1.2.21、Node 24.8.0；低于上游要求的 Bun 1.4.0，以上结果仅覆盖所列检查，不能外推为完整运行时兼容。
- 未完成的覆盖：未构建 Android APK/iOS App，未运行完整仓库测试或真实多机端到端测试，未验证远程服务的存储/日志政策，也未完成传递依赖审计或生产网络抓包。

本报告中的源码链接对应上述基线；未来改动可能导致行号漂移。品牌变更不构成上述发现的修复。
