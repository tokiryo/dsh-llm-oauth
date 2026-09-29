/**
 * Browser client for the host `/dsh-llm-oauth` HTTP API.
 */

export interface OAuthProviderStatus {
  id: string
  name: string
  enabled: boolean
  loggedIn: boolean
  authType?: 'api_key' | 'oauth'
  authSource?: string
  loginStatus?: 'waiting' | 'ok' | 'error'
  loginDetail?: string
}

export interface OAuthLoginCommand {
  kind: string
  text?: string
  /** URL the UI should open in a new window/tab. */
  openUrl?: string
  /** Device code to show prominently, when the flow uses one. */
  userCode?: string
}

export interface OAuthCatalogModel {
  id: string
  name: string
  listed: boolean
  label: string
}

export interface OAuthPickerSnapshot {
  provider: string
  allowlist: boolean
  models: OAuthCatalogModel[]
}

export interface OAuthStatusSnapshot {
  authPath: string
  catalog: string[]
  enabled: string[]
  providers: OAuthProviderStatus[]
  command?: OAuthLoginCommand
  picker?: OAuthPickerSnapshot
}

const BASE = '/dsh-llm-oauth'

function isStatusSnapshot(body: unknown): body is OAuthStatusSnapshot {
  return typeof body === 'object'
    && body !== null
    && Array.isArray((body as OAuthStatusSnapshot).providers)
}

async function request(
  path: string,
  init?: RequestInit,
): Promise<OAuthStatusSnapshot> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...init?.headers,
    },
  })
  const text = await response.text()
  let body: unknown
  try {
    body = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    throw new Error(text || `HTTP ${String(response.status)}`)
  }
  // Login may return 400 with a full status + command payload (prompt errors).
  if (!response.ok) {
    if (isStatusSnapshot(body)) return body
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? String((body as { error: unknown }).error)
      : `HTTP ${String(response.status)}`
    throw new Error(message)
  }
  return body as OAuthStatusSnapshot
}

export function fetchOauthStatus(): Promise<OAuthStatusSnapshot> {
  return request('/status')
}

export function enableOauthProvider(provider: string): Promise<OAuthStatusSnapshot> {
  return request('/enable', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  })
}

export function disableOauthProvider(provider: string): Promise<OAuthStatusSnapshot> {
  return request('/disable', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  })
}

export function loginOauthProvider(provider: string): Promise<OAuthStatusSnapshot> {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  })
}

export function logoutOauthProvider(provider: string): Promise<OAuthStatusSnapshot> {
  return request('/logout', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  })
}

export async function fetchOauthPicker(provider: string): Promise<OAuthPickerSnapshot> {
  const response = await fetch(`${BASE}/models?provider=${encodeURIComponent(provider)}`, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
  const text = await response.text()
  let body: unknown
  try {
    body = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    throw new Error(text || `HTTP ${String(response.status)}`)
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? String((body as { error: unknown }).error)
      : `HTTP ${String(response.status)}`
    throw new Error(message)
  }
  return body as OAuthPickerSnapshot
}

export function saveOauthPicker(
  provider: string,
  patch: {
    models?: string[] | null
    modelNames?: Record<string, string> | null
  },
): Promise<OAuthStatusSnapshot> {
  return request('/models', {
    method: 'POST',
    body: JSON.stringify({ provider, ...patch }),
  })
}
