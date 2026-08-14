# AGENTS.md

Standalone DeepSeek Harness plugin (`dsh-llm-oauth`). It is **not** part of the `deepseek-ai/deepseek-harness` monorepo.

## Contract

- Function plugin: export `name`, `inject`, `Config`, `apply`. **No `export default`.**
- Bundle: `package.json` `dsh.bundle.patch` → `cordis.patch.yml`.
- Git installs must build with `scripts/prepare.mjs` (tsdown only; do not typecheck DSH peers).
- `@deepseek-ai/*` are peers from the host profile. `@earendil-works/pi-ai` is this package's dependency.
- Registrations go through `ctx.llm.registerAdapter` / `registerConfigurableProviders` / `ctx.commands.register` (when present).
- Settings namespace: `llm-oauth` (`catalog` + enabled `providers` dict). Default is dormant (`providers: {}`).
- Optional web client face: `dsh.client` → `lib/client.js` (Settings → OAuth / 订阅 via `settings.section`).
- Optional HTTP API under `/dsh-llm-oauth/*` when `webServer` is present (register with `ctx.inject(['webServer'], …)`).

## Commands

```sh
pnpm install
pnpm test
pnpm run build
node bin/login.mjs --list
```
