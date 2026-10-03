# Yas

管理分布在多台电脑上的 Codex、Claude Code 和 Pi，通过网页与 Android 查看进度、发送指令、处理审批及恢复会话。

Yas 是 [HAPI](https://github.com/tiann/hapi) 的个人 fork，由 [abupeiyong](https://github.com/abupeiyong) 维护。保留上游 Git 历史、原作者署名和 AGPL-3.0 许可证。

## 当前状态

- 仓库、Web/PWA、中英文界面和 Android 应用显示名称改为 **Yas**。
- Android application ID 为 `com.github.abupeiyong.yas`，可与上游应用并存；Firebase 和签名配置必须使用自己的应用标识。
- 内部 workspace 包名、`HAPI_*` 环境变量、数据格式、配对协议、iOS 项目和发布工具暂时保留上游标识。它们不表示 Yas 已与上游服务隔离。
- 当前为源码开发版本，没有发布 Yas npm 包、APK、网站或托管服务。`npx @twsxtd/hapi` 运行的是上游发布版本，不是本仓库的 Yas。

## 从源码运行

上游要求 Bun 1.4.0。先检查依赖和安装脚本，再安装依赖；初次审查可跳过生命周期脚本：

```bash
git clone https://github.com/abupeiyong/Yas.git
cd Yas
bun install --frozen-lockfile --ignore-scripts
bun run build:web
export HAPI_HOME="$HOME/.yas"
export HAPI_ANDROID_PUSH=off
export HAPI_IOS_PUSH=off
bun run yas hub --no-relay
```

另开终端，在同一仓库目录设置相同的 `HAPI_HOME`，然后使用源码入口：

```bash
export HAPI_HOME="$HOME/.yas"
bun run yas --help
bun run yas runner start
bun run yas codex
```

`bun run yas` 调用本仓库 CLI 源码。CLI 内部和上游文档仍可能显示 `hapi` 命令；本阶段将其替换为 `bun run yas` 使用。不同 Agent 的本地/远程共享能力以[接入矩阵](docs/guide/agents.md)为准。

这些命令只关闭网络隧道和原生推送，并不是完整的离线模式。语音、通知、网页字体、Agent 本身及其工具仍可能联网。首次使用真实代码前应审查配置及外发路径。

## 开发与文档

- 网页开发：`bun run dev`。
- Android 构建：[Android README](android/README.md)，应用名称为 Yas；不附带 Firebase 凭据或签名密钥。
- 架构：[How it works](docs/guide/how-it-works.md)。
- Agent 接入：[Supported agents](docs/guide/agents.md)。
- Codex 双端共享：[Shared sessions](docs/guide/codex-shared-sessions.md)，上游要求 Codex 0.154.0+。
- 安全报告入口：[SECURITY.md](SECURITY.md)。
- 首轮外发审查：[2026-10-03 安全报告](docs/security/2026-10-03-outbound-review.md)。已确认推送、语音、日志和第三方网页等外发路径；安全整改尚未实施。

上游文档、营销网站、图标和发布流程仍含 HAPI 标识。不要直接运行继承的 npm/Homebrew/网站发布流程；Yas 发布渠道尚未配置。

## 来源与许可证

初始上游：`tiann/hapi@86c88df93baf5d1f738dd4b202078bdf6dec376e`。

感谢 HAPI、[Happy](https://github.com/slopus/happy) 及其贡献者。上游的版权、NOTICE 和 [LICENSE](LICENSE) 均保留。Yas 的修改继续遵循仓库中的 AGPL-3.0 许可证。
