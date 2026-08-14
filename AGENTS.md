# AGENTS.md

Standalone DeepSeek Harness plugin (`dsh-llm-oauth`). It is **not** part of the `deepseek-ai/deepseek-harness` monorepo.

## Contract

- Function plugin: export `name`, `inject`, `Config`, `apply`. **No `export default`.**
- Bundle: `package.json` `dsh.bundle.patch` → `cordis.patch.yml`.
- Git installs must build with `scripts/prepare.mjs` (tsdown only; do not typecheck DSH peers).
- `@deepseek-ai/*` are peers from the host profile. `@earendil-works/pi-ai` is this package's dependency.
- Registrations go through `ctx.llm.registerAdapter` / `ctx.commands.register` (when present).

## Commands

```sh
pnpm install
pnpm test
pnpm run build
node bin/login.mjs --list
```
