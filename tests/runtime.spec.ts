import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import * as plugin from '../src/index.ts'

// Real service implementation: registration, validation and watchers are owned
// by the installed Harness, while only durable storage is replaced in memory.
class MemorySettings extends SettingsProvider {
  readonly writable = true
  private doc: Record<string, unknown>

  constructor(ctx: Context, doc: Record<string, unknown> = {}) {
    super(ctx)
    this.doc = structuredClone(doc)
  }

  protected async load(): Promise<Record<string, unknown>> {
    return structuredClone(this.doc)
  }

  protected async persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
  }
}

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

async function boot(config: plugin.Config = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  const consumer = ctx.plugin(plugin, config)
  await consumer
  return { ctx, consumer }
}

function routes(ctx: Context) {
  return ctx.llm.listProviders().map(provider => provider.id).sort()
}

describe('SettingsProvider integration', () => {
  it('loads dormant, attaches stored settings, applies mutations, and falls back on detach', async () => {
    const { ctx } = await boot()
    expect(routes(ctx)).toEqual([])
    const settings = ctx.plugin(MemorySettings, { 'llm-oauth': { providers: { xai: {} } } })
    await settings
    await vi.waitFor(() => expect(routes(ctx)).toEqual(['xai']))
    expect(ctx.settings.describe().map(section => section.ns)).toContain('llm-oauth')

    await ctx.settings.mutate('llm-oauth', [{ op: 'set', path: ['providers', 'openai-codex'], value: {} }])
    await vi.waitFor(() => expect(routes(ctx)).toEqual(['openai-codex', 'xai']))
    await ctx.settings.mutate('llm-oauth', [{ op: 'unset', path: ['providers', 'xai'] }])
    await vi.waitFor(() => expect(routes(ctx)).toEqual(['openai-codex']))

    await expect(ctx.settings.mutate('llm-oauth', [
      { op: 'set', path: ['providers', 'not-a-provider'], value: {} },
    ])).rejects.toThrow(/not in catalog/)
    expect(routes(ctx)).toEqual(['openai-codex'])

    await settings.dispose()
    await vi.waitFor(() => expect(routes(ctx)).toEqual([]))
  })

  it('preserves composition settings and removes the section when the plugin unloads', async () => {
    const { ctx, consumer } = await boot({ providers: { xai: {} } })
    expect(routes(ctx)).toEqual(['xai'])
    await ctx.plugin(MemorySettings)
    await vi.waitFor(() => expect(ctx.settings.describe().map(section => section.ns)).toContain('llm-oauth'))
    expect(routes(ctx)).toEqual(['xai'])
    await consumer.dispose()
    await vi.waitFor(() => {
      expect(routes(ctx)).toEqual([])
      expect(ctx.settings.describe().map(section => section.ns)).not.toContain('llm-oauth')
    })
  })
})
