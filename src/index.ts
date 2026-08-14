/**
 * Standalone OAuth LLM plugin for DeepSeek Harness.
 *
 * Install with `dsh plugin --profile <name> add github:<user>/dsh-llm-oauth`.
 * Do not add a default export: Cordis Loader unwraps `exports.default ?? exports`.
 *
 * @module dsh-llm-oauth
 */

/** Cordis plugin name; keep this stable after publishing. */
export const name = 'llm-oauth'

/** Services that must exist before the plugin is applied. */
export const inject = ['llm']

export { Config, resolveConfig } from './config.ts'
export type { ResolvedConfig } from './config.ts'
export { apply } from './runtime.ts'
export { OAuthPiAiAdapter } from './adapter.ts'
export { FileCredentialStore } from './store.ts'
export { resolveOAuthProviders, oauthCatalogProviders, DEFAULT_PROVIDERS } from './catalog.ts'
export { defaultAuthPath } from './home.ts'
