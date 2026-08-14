/**
 * `/oauth` slash command: status / list / login / logout.
 *
 * Login cannot wait for the browser: DSH commands only render when the
 * handler returns, so a device-code poll looks like a hung `/oauth`. The
 * handler returns as soon as pi-ai notifies a URL or user code, and the
 * poll continues in the background.
 */

import type { OAuthPiAiAdapter } from './adapter.ts'

export interface CommandResult {
  readonly kind: 'success' | 'error'
  readonly text: string
}

/** In-flight or last-finished login, keyed by provider id. */
export interface LoginWatch {
  readonly provider: string
  status: 'waiting' | 'ok' | 'error'
  detail?: string
  readonly lines: string[]
}

const watches = new Map<string, LoginWatch>()

/** Test helper: drop every background login watch. */
export function resetLoginWatches(): void {
  watches.clear()
}

/** Snapshot of background login watches (for tests and `/oauth status`). */
export function listLoginWatches(): readonly LoginWatch[] {
  return [...watches.values()]
}

function usageText(authPath: string): string {
  return [
    'Usage:',
    '  /oauth status',
    '  /oauth list',
    '  /oauth login <provider>',
    '  /oauth logout <provider>',
    '',
    `Auth file: ${authPath}`,
    '',
    'Notes:',
    '  - openai (API) is not OAuth; use openai-codex for ChatGPT / Codex subscription.',
    '  - Grok is provider id "xai".',
    '  - Do not also configure the same provider id under llm-pi-ai (DUPLICATE_ADAPTER).',
  ].join('\n')
}

function formatEvent(event: {
  type: string
  message?: string
  url?: string
  instructions?: string
  verificationUri?: string
  userCode?: string
}): string[] {
  switch (event.type) {
    case 'auth_url':
      return [
        `Open this URL:\n${event.url ?? ''}`,
        ...event.instructions ? [event.instructions] : [],
      ]
    case 'device_code':
      return [
        `Open this URL:\n${event.verificationUri ?? ''}`,
        `Enter code: ${event.userCode ?? ''}`,
      ]
    case 'info':
    case 'progress':
      return event.message ? [event.message] : []
    default:
      return []
  }
}

function isLoginNotice(type: string): boolean {
  return type === 'device_code' || type === 'auth_url'
}

function waitingText(watch: LoginWatch): string {
  return [
    ...watch.lines,
    '',
    `Finish signing in to ${watch.provider} in the browser.`,
    'This command has returned so the UI is not stuck; the login continues in the background.',
    'When you are done, run /oauth status.',
  ].join('\n')
}

/**
 * Start OAuth and return as soon as the user has something to open.
 * The device-code poll is not bound to the command AbortSignal — the Web
 * request ends when this handler returns, and aborting it would cancel login.
 */
async function startLogin(
  adapter: OAuthPiAiAdapter,
  provider: string,
  signal?: AbortSignal,
): Promise<CommandResult> {
  const existing = watches.get(provider)
  if (existing?.status === 'waiting') {
    return { kind: 'success', text: waitingText(existing) }
  }

  const lines: string[] = []
  const watch: LoginWatch = { provider, status: 'waiting', lines }
  watches.set(provider, watch)

  let released = false
  let release!: (error?: Error) => void
  const firstNotice = new Promise<void>((resolve, reject) => {
    release = (error?: Error): void => {
      if (released) return
      released = true
      if (error === undefined) resolve()
      else reject(error)
    }
  })

  const onAbort = (): void => {
    release(new Error('oauth login cancelled before the provider returned a URL'))
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  const interaction = {
    prompt: async (prompt: { type: string, message: string, placeholder?: string }): Promise<string> => {
      throw new Error(
        `Interactive prompt required (${prompt.type}: ${prompt.message}`
        + `${prompt.placeholder ? ` / ${prompt.placeholder}` : ''}). `
        + `This provider cannot finish from /oauth; run: node <profile>/node_modules/dsh-llm-oauth/bin/login.mjs ${provider}`,
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
      lines.push(...formatEvent(event))
      if (isLoginNotice(event.type)) release()
    },
  }

  const finished = adapter.login(provider, interaction).then(
    () => {
      watch.status = 'ok'
      watch.detail = `Logged in to ${provider}. Tokens stored in ${adapter.authPath()}.`
    },
    (error: unknown) => {
      watch.status = 'error'
      watch.detail = error instanceof Error ? error.message : String(error)
      release(error instanceof Error ? error : new Error(watch.detail))
    },
  )

  try {
    await firstNotice
  } catch (error) {
    signal?.removeEventListener('abort', onAbort)
    return {
      kind: 'error',
      text: [watch.detail ?? (error instanceof Error ? error.message : String(error)), ...lines].join('\n'),
    }
  }
  signal?.removeEventListener('abort', onAbort)

  // Keep the poll alive after this command returns.
  void finished

  if (watch.status === 'ok') {
    return { kind: 'success', text: watch.detail ?? `Logged in to ${provider}.` }
  }
  return { kind: 'success', text: waitingText(watch) }
}

/**
 * Execute `/oauth` against the live adapter.
 * @param adapter - registered OAuth adapter.
 * @param rawInput - text after the command name.
 * @param signal - UI request cancellation; only aborts waiting for the first URL.
 */
export async function handleOauthCommand(
  adapter: OAuthPiAiAdapter,
  rawInput: string,
  signal?: AbortSignal,
): Promise<CommandResult> {
  const parts = rawInput.trim().split(/\s+/).filter(Boolean)
  const action = (parts[0] ?? 'status').toLowerCase()
  const target = parts[1]

  if (action === 'help' || action === '-h' || action === '--help') {
    return { kind: 'success', text: usageText(adapter.authPath()) }
  }

  if (action === 'list') {
    const rows = ['OAuth providers owned by this adapter:']
    for (const id of adapter.routeIds()) {
      const auth = await adapter.checkAuth(id)
      rows.push(`  ${id.padEnd(20)} ${auth === undefined ? 'not logged in' : `${auth.type}${auth.source ? ` (${auth.source})` : ''}`}`)
    }
    return { kind: 'success', text: rows.join('\n') }
  }

  if (action === 'status') {
    const rows = [`Auth file: ${adapter.authPath()}`, '']
    for (const id of adapter.routeIds()) {
      const auth = await adapter.checkAuth(id)
      const watch = watches.get(id)
      const login = auth === undefined ? 'not logged in' : `ok (${auth.type}${auth.source ? `, ${auth.source}` : ''})`
      const extra = watch === undefined
        ? ''
        : watch.status === 'waiting'
          ? ' — browser login in progress'
          : watch.status === 'error'
            ? ` — last login error: ${watch.detail ?? 'failed'}`
            : ' — last login finished'
      rows.push(`${id}: ${login}${extra}`)
    }
    return { kind: 'success', text: rows.join('\n') }
  }

  if (action === 'logout') {
    if (target === undefined) return { kind: 'error', text: 'Usage: /oauth logout <provider>' }
    try {
      watches.delete(target)
      await adapter.logout(target)
      return { kind: 'success', text: `Logged out ${target}.` }
    } catch (error) {
      return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
    }
  }

  if (action === 'login') {
    if (target === undefined) {
      return { kind: 'error', text: 'Usage: /oauth login <provider>' }
    }
    return startLogin(adapter, target, signal)
  }

  return { kind: 'error', text: `Unknown action "${action}".\n\n${usageText(adapter.authPath())}` }
}
