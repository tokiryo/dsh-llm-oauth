import { describe, expect, it } from 'vitest'
import { DEFAULT_PROVIDERS, oauthCatalogProviders, resolveOAuthProviders } from '../src/catalog.ts'

describe('oauth catalog', () => {
  it('ships only ids that exist and declare OAuth', () => {
    const resolved = resolveOAuthProviders(DEFAULT_PROVIDERS)
    expect(resolved.map(provider => provider.id)).toEqual([...DEFAULT_PROVIDERS])
    for (const provider of resolved) {
      expect(provider.auth.oauth).toBeDefined()
    }
  })

  it('lists every installed OAuth catalog provider', () => {
    const ids = oauthCatalogProviders().map(provider => provider.id)
    expect(ids).toEqual(expect.arrayContaining([...DEFAULT_PROVIDERS]))
    expect(ids).toContain('xai')
    expect(ids).toContain('github-copilot')
    expect(ids).toContain('openai-codex')
  })

  it('refuses the OpenAI API-key catalog id', () => {
    expect(() => resolveOAuthProviders(['openai'])).toThrow(/no OAuth method/)
  })

  it('refuses an unknown catalog id', () => {
    expect(() => resolveOAuthProviders(['not-a-provider'])).toThrow(/unknown pi-ai catalog provider/)
  })

  it('refuses an empty list', () => {
    expect(() => resolveOAuthProviders([])).toThrow(/at least one/)
  })
})
