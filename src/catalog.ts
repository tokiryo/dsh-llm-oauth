/**
 * Resolve OAuth-capable pi-ai catalog providers.
 */

import { builtinProviders } from '@earendil-works/pi-ai/providers/all'
import type { Provider } from '@earendil-works/pi-ai'

/** Default subscription / OAuth catalog ids this plugin ships. */
export const DEFAULT_PROVIDERS = [
  'xai',
  'github-copilot',
  'openai-codex',
  'anthropic',
  'openrouter',
  'kimi-coding',
] as const

/**
 * Every installed catalog provider that declares an OAuth method.
 */
export function oauthCatalogProviders(): Provider[] {
  return builtinProviders().filter(provider => provider.auth.oauth !== undefined)
}

/**
 * Resolve configured route ids against the installed catalog.
 * @param requested - provider ids from plugin config.
 * @returns catalog providers in config order.
 */
export function resolveOAuthProviders(requested: readonly string[]): Provider[] {
  const catalog = new Map(builtinProviders().map(provider => [provider.id, provider]))
  const resolved: Provider[] = []
  for (const id of requested) {
    const provider = catalog.get(id)
    if (provider === undefined) {
      throw new Error(`dsh-llm-oauth: unknown pi-ai catalog provider "${id}"`)
    }
    if (provider.auth.oauth === undefined) {
      throw new Error(
        `dsh-llm-oauth: provider "${id}" has no OAuth method `
        + '(openai is API-key only; use openai-codex for ChatGPT / Codex subscription OAuth, xai for Grok)',
      )
    }
    resolved.push(provider)
  }
  if (resolved.length === 0) {
    throw new Error('dsh-llm-oauth: providers must list at least one OAuth-capable catalog id')
  }
  return resolved
}
