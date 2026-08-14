/**
 * Serializable configuration and defaults.
 * @module dsh-llm-oauth/config
 */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_PROVIDERS } from './catalog.ts'

/** Plugin configuration supplied by the profile composition. */
export interface Config {
  /**
   * pi-ai catalog provider ids that declare OAuth.
   * Defaults: xai, github-copilot, openai-codex, anthropic, openrouter, kimi-coding.
   */
  providers?: string[]
  /** Override path for the durable OAuth credential file. */
  authPath?: string
}

/** Configuration after defaults. */
export interface ResolvedConfig {
  providers: string[]
  authPath?: string
}

/** Loader-visible configuration schema. */
export const Config: z<Config> = z.object({
  providers: z.array(z.string()).default([...DEFAULT_PROVIDERS]),
  authPath: z.string(),
})

/**
 * Resolve the same defaults for direct callers that bypass Cordis Loader.
 * @param config - Partial serialized configuration.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  return {
    providers: config.providers ?? [...DEFAULT_PROVIDERS],
    ...config.authPath === undefined ? {} : { authPath: config.authPath },
  }
}
