import { describe, expect, it } from 'vitest'
import { Config, applyPickerPatch, enabledProviderIds, resolveConfig, unwrapMaybeVolatile } from '../src/config.ts'

describe('Config schema', () => {
  it('marks providers volatile so Settings can mutate enablement', () => {
    expect(Config.dict?.providers?.meta?.volatile).toBe(true)
  })
})

describe('resolveConfig', () => {
  it('keeps a dormant providers dict by default', () => {
    expect(resolveConfig()).toMatchObject({ providers: {} })
    expect(enabledProviderIds({})).toEqual([])
  })

  it('unwraps a Cordis-style volatile cell', () => {
    // Same shape as cosmokit's createVolatile: a frozen plain object.
    const cell = Object.freeze({
      get: () => ({ xai: { models: ['grok-4.6'] } }),
      [Symbol.for('cosmokit.volatile.write')]: () => undefined,
    })
    expect(resolveConfig({ providers: cell }).providers).toEqual({
      xai: { models: ['grok-4.6'] },
    })
    expect(unwrapMaybeVolatile(cell)).toEqual({ xai: { models: ['grok-4.6'] } })
  })

  it('keeps an empty profile free of an allowlist after schema parsing', () => {
    const parsed = Config({ providers: { xai: {}, anthropic: { models: [] } } })
    const providers = resolveConfig(parsed).providers
    expect(providers.xai?.models).toBeUndefined()
    expect(providers.anthropic?.models).toEqual([])
  })

  it('does not mistake a provider dict for a volatile cell', () => {
    expect(resolveConfig({ providers: { xai: {}, anthropic: {} } }).providers).toEqual({
      xai: {},
      anthropic: {},
    })
  })

  it('treats a legacy providers array as catalog-only, not enabled routes', () => {
    expect(resolveConfig({ providers: ['xai', 'anthropic'] }).providers).toEqual({})
    expect(resolveConfig({ providers: ['xai'] }).catalog).toEqual(['xai'])
  })
})

describe('applyPickerPatch', () => {
  it('merges an allowlist without dropping other knobs', () => {
    expect(applyPickerPatch(
      { displayName: 'Grok', models: ['grok-4'] },
      { models: ['grok-4.6'] },
    )).toEqual({ displayName: 'Grok', models: ['grok-4.6'] })
  })

  it('clears fields when the patch sends null', () => {
    expect(applyPickerPatch(
      { displayName: 'Grok', models: ['grok-4'], modelNames: { 'grok-4': 'G' } },
      { models: null, modelNames: null, displayName: null },
    )).toEqual({})
  })
})
