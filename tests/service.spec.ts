import { describe, expect, it, beforeEach } from 'vitest'
import { OAuthController, type OAuthControllerHooks } from '../src/service.ts'
import type { OAuthProviderProfile } from '../src/config.ts'
import { resetLoginWatches } from '../src/command.ts'
import type { OAuthPiAiAdapter } from '../src/adapter.ts'

function fakeAdapter(): OAuthPiAiAdapter {
  const auth = new Map<string, { type: 'oauth' } | undefined>([
    ['xai', { type: 'oauth' }],
    ['openrouter', undefined],
  ])
  return {
    authPath: () => '/tmp/pi-ai-oauth.json',
    catalogIds: () => ['xai', 'openrouter'],
    routeIds: () => ['xai', 'openrouter'],
    displayName: (id: string) => id === 'xai' ? 'xAI' : id,
    checkAuth: async (id: string) => auth.get(id),
    logout: async (id: string) => { auth.set(id, undefined) },
    login: async () => ({ type: 'oauth' }),
    catalogModels: (id: string) => id === 'xai'
      ? [{ id: 'grok-4.6', name: 'Grok 4.6' }, { id: 'grok-4', name: 'Grok 4' }]
      : [{ id: 'openrouter/auto', name: 'Auto' }],
  } as unknown as OAuthPiAiAdapter
}

function hooks(enabled: Set<string>, profiles: Record<string, OAuthProviderProfile> = {}): OAuthControllerHooks {
  return {
    listEnabled: () => [...enabled],
    enable: async (id: string) => { enabled.add(id) },
    disable: async (id: string) => { enabled.delete(id) },
    setPicker: async (id, patch) => {
      enabled.add(id)
      const next: OAuthProviderProfile = { ...profiles[id] }
      if (patch.models === null) delete next.models
      else if (patch.models !== undefined) next.models = patch.models
      profiles[id] = next
    },
    profileOf: (id: string) => profiles[id],
  }
}

describe('OAuthController', () => {
  beforeEach(() => {
    resetLoginWatches()
  })

  it('reports enabled and login state per catalog row', async () => {
    const enabled = new Set<string>(['xai'])
    const controller = new OAuthController(fakeAdapter(), hooks(enabled))

    const snap = await controller.status()
    expect(snap.authPath).toBe('/tmp/pi-ai-oauth.json')
    expect(snap.enabled).toEqual(['xai'])
    expect(snap.providers).toEqual([
      expect.objectContaining({ id: 'xai', name: 'xAI', enabled: true, loggedIn: true, authType: 'oauth' }),
      expect.objectContaining({ id: 'openrouter', enabled: false, loggedIn: false }),
    ])
  })

  it('enable/disable go through hooks', async () => {
    const enabled = new Set<string>()
    const controller = new OAuthController(fakeAdapter(), hooks(enabled))
    await controller.enable('openrouter')
    expect(enabled.has('openrouter')).toBe(true)
    await controller.disable('openrouter')
    expect(enabled.has('openrouter')).toBe(false)
  })

  it('refuses unknown catalog ids', async () => {
    const controller = new OAuthController(fakeAdapter(), hooks(new Set()))
    await expect(controller.enable('nope')).rejects.toThrow(/unknown catalog/)
  })

  it('reports picker allowlist against the full catalog', async () => {
    const enabled = new Set(['xai'])
    const controller = new OAuthController(fakeAdapter(), hooks(enabled, {
      xai: { models: ['grok-4.6'], modelNames: { 'grok-4.6': 'Grok' } },
    }))
    expect(controller.picker('xai')).toEqual({
      provider: 'xai',
      allowlist: true,
      models: [
        { id: 'grok-4.6', name: 'Grok 4.6', listed: true, label: 'Grok' },
        { id: 'grok-4', name: 'Grok 4', listed: false, label: 'Grok 4' },
      ],
    })
  })
})
