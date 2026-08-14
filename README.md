# dsh-llm-oauth

English | [中文](README.zh.md)

Standalone **OAuth / subscription-plan** LLM plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Install it into your own profile with `dsh plugin add` — it does **not** patch the Harness repo.

| Subscription | Provider id in this plugin |
|---|---|
| Grok (SuperGrok / X Premium) | `xai` |
| GitHub Copilot | `github-copilot` |
| ChatGPT / Codex plan | `openai-codex` (**not** the `openai` API-key route) |
| Anthropic subscription | `anthropic` |
| OpenRouter | `openrouter` |
| Kimi For Coding | `kimi-coding` |

First-party `dsh-llm-pi-ai` authenticates with API keys only and never runs an OAuth login or refresh. This plugin constructs pi-ai `Models` with a durable `CredentialStore`, so access tokens refresh on the request path.

Layout follows community plugin conventions ([plugin-template](https://github.com/omdsh-dev/plugin-template), [dsh-auto-continue](https://github.com/HsiangNianian/dsh-auto-continue), [create-dsh-plugin](https://github.com/kaijia323/create-dsh-plugin)):

- `package.json` → `dsh.bundle.patch`
- `cordis.patch.yml` inserts one plugin row
- `prepare` bundles `src/` → `lib/` on git install
- no `export default` (Cordis Loader unwraps it)

## Install

```sh
dsh plugin --profile web add github:ziyou979/dsh-llm-oauth
```

From a local checkout:

```sh
dsh plugin --profile web add ./dsh-llm-oauth
```

Confirm the layer:

```sh
dsh --profile web --dump-config
```

A git install may ask you to allow `prepare` in the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-llm-oauth: true
```

## Login

Interactive device-code / browser flows need a real terminal:

```sh
npx dsh-llm-oauth-login xai
npx dsh-llm-oauth-login github-copilot
npx dsh-llm-oauth-login openai-codex
npx dsh-llm-oauth-login --list
```

Credentials are stored at `$DSH_HOME/pi-ai-oauth.json` (default `~/.dsh/pi-ai-oauth.json`).

In the Web UI:

```
/oauth status
/oauth list
/oauth login xai
/oauth logout xai
```

Use the CLI when a flow prompts for a secret or paste-back code.

Then pick the provider (e.g. `xai`) and a catalog model in the model selector.

## Do not collide with llm-pi-ai

`dsh-base` mounts dormant `dsh-llm-pi-ai`. Declaring the same provider id under an `llm-pi-ai:` settings section throws `DUPLICATE_ADAPTER`. Keep subscription routes here; keep API-key routes on `llm-pi-ai` / `llm-deepseek`.

## Develop

```sh
pnpm install
pnpm test
pnpm run build
node bin/login.mjs --list
```

`@deepseek-ai/*` packages are peers supplied by the DSH profile. Unit tests (catalog / store) only need `@earendil-works/pi-ai`.

## Limits

- No image / vision path
- No full native replay signatures
- No in-browser OAuth callback server
- Plain OpenAI API and DeepSeek official stay on API keys

## License

MIT
