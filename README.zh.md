# dsh-llm-oauth

[English](README.md) | 中文

DeepSeek Harness 的**独立 OAuth / 订阅套餐** LLM 插件。用 `dsh plugin add` 装进自己的 profile，即可登录并使用：

| 你想用的订阅 | 插件里的 provider id |
|---|---|
| Grok（SuperGrok / X Premium） | `xai` |
| GitHub Copilot | `github-copilot` |
| ChatGPT / Codex 订阅 | `openai-codex`（**不是** `openai` API Key） |
| Anthropic 订阅 | `anthropic` |
| OpenRouter | `openrouter` |
| Kimi For Coding | `kimi-coding` |

这是独立仓库，**不改** DeepSeek Harness 本体。官方 `dsh-llm-pi-ai` 只走 API Key，没有 OAuth 登录/刷新；本插件把 pi-ai 的 `CredentialStore` 接进去，请求时会自动刷新 token。

仓库形态对齐社区插件约定（参考 [omdsh-dev/plugin-template](https://github.com/omdsh-dev/plugin-template)、[HsiangNianian/dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue)、[create-dsh-plugin](https://github.com/kaijia323/create-dsh-plugin)）：

- `package.json` → `dsh.bundle.patch`
- `cordis.patch.yml` 插入一行插件
- `prepare` 在 git 安装时把 `src/` 打成 `lib/`
- 无 `export default`（Cordis Loader 会 unwrap）

## 安装

```sh
dsh plugin --profile web add github:ziyou979/dsh-llm-oauth
```

本地 checkout：

```sh
dsh plugin --profile web add ./dsh-llm-oauth
# 或
dsh plugin --profile web add link:E:/ProjectCollection/TSProjects/dsh-llm-oauth
```

验证层已挂上：

```sh
dsh --profile web --dump-config
```

首次从 Git 安装若提示不允许跑 `prepare`，按 CLI 提示在该 profile 的 `pnpm-workspace.yaml` 里放行：

```yaml
allowBuilds:
  dsh-llm-oauth: true
```

然后重新 `add`。也可以直接用已构建的 `lib/`（本仓库提交了构建产物时可跳过）。

## 登录（订阅套餐）

启动 Web 后在输入框：

```
/oauth login xai
```

命令会马上返回授权链接和验证码（不会一直转圈）。浏览器里完成登录后再执行 `/oauth status`。

凭据写到 `$DSH_HOME/pi-ai-oauth.json`（默认 `~/.dsh/pi-ai-oauth.json`）。

若 Web 命令不可用，用已安装包里的脚本（不要 `npx dsh-llm-oauth-login`，npm 上没有这个包）：

```sh
node %USERPROFILE%\.dsh\profiles\web\node_modules\dsh-llm-oauth\bin\login.mjs xai
```

登录后在模型选择器里选对应 provider（如 `xai`）和 catalog 模型即可对话。过期 token 由 pi-ai 在请求路径上刷新。

## 不要和 llm-pi-ai 抢同一条路由

`dsh-base` 会挂载休眠的 `dsh-llm-pi-ai`。如果你又在 settings 的 `llm-pi-ai:` 里配置了 `xai` / `github-copilot` 等**相同** provider id，会 `DUPLICATE_ADAPTER`。

- 订阅 / OAuth → 只用本插件
- API Key（DeepSeek、官方 OpenAI API）→ 继续用 `llm-deepseek` / `llm-pi-ai`

## 开发

```sh
pnpm install
pnpm test
pnpm run build
node bin/login.mjs --list
```

`@deepseek-ai/*` 是 peer：类型检查需要本机已安装 DSH 的 profile；单元测试（catalog / store）只依赖 `@earendil-works/pi-ai`。

## 限制

- 无图片 / vision（请用官方 `dsh-llm-pi-ai`）
- 无完整 native replay 签名
- Web 端没有独立 OAuth 回调服务器（device code / 打开 URL）
- 普通 OpenAI API、DeepSeek 官方仍走 API Key

## License

MIT
