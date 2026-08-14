/**
 * Cordis activation: register the OAuth adapter and optional `/oauth` command.
 * @module dsh-llm-oauth/runtime
 */

import type { Context } from '@deepseek-ai/cordis'
import { OAuthPiAiAdapter } from './adapter.ts'
import { handleOauthCommand } from './command.ts'
import { resolveConfig, type Config } from './config.ts'
import { defaultAuthPath } from './home.ts'
import { FileCredentialStore } from './store.ts'

/**
 * Apply the plugin to its Cordis context.
 * @param ctx - scoped plugin context; registrations are effects.
 * @param config - configuration resolved by Cordis from the exported schema.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const authPath = resolved.authPath ?? defaultAuthPath()
  const store = new FileCredentialStore(authPath)
  const adapter = new OAuthPiAiAdapter({
    authPath,
    store,
    providers: resolved.providers,
  })

  ctx.llm.registerAdapter(adapter.routeIds(), adapter)

  const commands = ctx.get('commands') as {
    register(definition: {
      name: string
      description: string
      input?: { hint: string }
      handler: (invocation: { rawInput: string }) => Promise<{ kind: string, text?: string }>
    }): void
  } | undefined
  if (commands !== undefined) {
    commands.register({
      name: 'oauth',
      description: 'log in / out of OAuth LLM providers (xai, github-copilot, openai-codex, …)',
      input: { hint: '[status|list|login <provider>|logout <provider>]' },
      handler: invocation => handleOauthCommand(adapter, invocation.rawInput),
    })
  }

  ctx.logger.info(
    `[llm-oauth] registered OAuth providers: ${adapter.routeIds().join(', ')} (auth: ${authPath})`,
  )
}
