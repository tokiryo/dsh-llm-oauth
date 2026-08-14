/**
 * `/oauth` slash command: status / list / login / logout.
 */

import type { OAuthPiAiAdapter } from './adapter.ts'

export interface CommandResult {
  readonly kind: 'success' | 'error'
  readonly text: string
}

function usageText(authPath: string): string {
  return [
    'Usage:',
    '  /oauth status',
    '  /oauth list',
    '  /oauth login <provider>',
    '  /oauth logout <provider>',
    '',
    'Interactive device-code / browser flows work best from a terminal:',
    '  npx dsh-llm-oauth-login <provider>',
    '',
    `Auth file: ${authPath}`,
    '',
    'Notes:',
    '  - openai (API) is not OAuth; use openai-codex for ChatGPT / Codex subscription.',
    '  - Grok is provider id "xai".',
    '  - Do not also configure the same provider id under llm-pi-ai (DUPLICATE_ADAPTER).',
  ].join('\n')
}

function commandInteraction(lines: string[]) {
  return {
    prompt: async (prompt: { type: string, message: string, placeholder?: string }): Promise<string> => {
      throw new Error(
        `Interactive prompt required (${prompt.type}: ${prompt.message}`
        + `${prompt.placeholder ? ` / ${prompt.placeholder}` : ''}). `
        + 'Use the CLI: npx dsh-llm-oauth-login <provider>',
      )
    },
    notify: (event: {
      type: string
      message?: string
      url?: string
      instructions?: string
      verificationUri?: string
      userCode?: string
    }): void => {
      switch (event.type) {
        case 'auth_url':
          lines.push(`Open this URL:\n${event.url ?? ''}`)
          if (event.instructions) lines.push(event.instructions)
          break
        case 'device_code':
          lines.push(`Open this URL:\n${event.verificationUri ?? ''}`)
          lines.push(`Enter code: ${event.userCode ?? ''}`)
          break
        case 'info':
        case 'progress':
          if (event.message) lines.push(event.message)
          break
      }
    },
  }
}

/**
 * Execute `/oauth` against the live adapter.
 * @param adapter - registered OAuth adapter.
 * @param rawInput - text after the command name.
 */
export async function handleOauthCommand(
  adapter: OAuthPiAiAdapter,
  rawInput: string,
): Promise<CommandResult> {
  const parts = rawInput.trim().split(/\s+/).filter(Boolean)
  const action = (parts[0] ?? 'status').toLowerCase()
  const target = parts[1]

  if (action === 'help' || action === '-h' || action === '--help') {
    return { kind: 'success', text: usageText(adapter.authPath()) }
  }

  if (action === 'list') {
    const lines = ['OAuth providers owned by this adapter:']
    for (const id of adapter.routeIds()) {
      const auth = await adapter.checkAuth(id)
      lines.push(`  ${id.padEnd(20)} ${auth === undefined ? 'not logged in' : `${auth.type}${auth.source ? ` (${auth.source})` : ''}`}`)
    }
    return { kind: 'success', text: lines.join('\n') }
  }

  if (action === 'status') {
    const lines = [`Auth file: ${adapter.authPath()}`, '']
    for (const id of adapter.routeIds()) {
      const auth = await adapter.checkAuth(id)
      lines.push(`${id}: ${auth === undefined ? 'not logged in' : `ok (${auth.type}${auth.source ? `, ${auth.source}` : ''})`}`)
    }
    return { kind: 'success', text: lines.join('\n') }
  }

  if (action === 'logout') {
    if (target === undefined) return { kind: 'error', text: 'Usage: /oauth logout <provider>' }
    try {
      await adapter.logout(target)
      return { kind: 'success', text: `Logged out ${target}.` }
    } catch (error) {
      return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
    }
  }

  if (action === 'login') {
    if (target === undefined) {
      return {
        kind: 'error',
        text: 'Usage: /oauth login <provider>\nPrefer CLI for interactive flows: npx dsh-llm-oauth-login <provider>',
      }
    }
    const lines: string[] = []
    const interaction = commandInteraction(lines)
    try {
      await adapter.login(target, interaction)
      lines.push(`Logged in to ${target}. Tokens stored in ${adapter.authPath()}.`)
      return { kind: 'success', text: lines.join('\n') }
    } catch (error) {
      lines.push(error instanceof Error ? error.message : String(error))
      return { kind: 'error', text: lines.join('\n') }
    }
  }

  return { kind: 'error', text: `Unknown action "${action}".\n\n${usageText(adapter.authPath())}` }
}
