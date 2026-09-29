import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createVolatile, updateVolatile } from '@deepseek-ai/cosmokit'
import { LlmRuntime } from '@deepseek-ai/dsh-llm'
import * as plugin from '../src/index.ts'

// Harness 0.1.7+: `providers` is a volatile reference parsed by Cordis from the
// exported Config. Settings edits commit into that reference in place and the
// loader announces them with `loader/volatile-update` (no remount).

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

/** Commit new providers the way the loader does for a volatile-only edit. */
function commitProviders(ctx: Context, consumer: { config: unknown }, providers: Record<string, unknown>) {
  const ref = (consumer.config as { providers: Parameters<typeof updateVolatile>[0] }).providers
  updateVolatile(ref, createVolatile(providers as never))
  ;(ctx as unknown as { emit(name: string, paths: string[][]): void }).emit('loader/volatile-update', [['providers']])
}

describe('volatile settings integration', () => {
  it('parses providers into a live volatile reference', async () => {
    const { consumer } = await boot({ providers: { xai: {} } })
    const providers = (consumer.config as { providers: { get(): unknown } }).providers
    expect(providers.get()).toEqual({ xai: {} })
  })

  it('loads dormant, then follows volatile updates without remounting', async () => {
    const { ctx, consumer } = await boot()
    expect(routes(ctx)).toEqual([])

    commitProviders(ctx, consumer, { xai: {} })
    await vi.waitFor(() => expect(routes(ctx)).toEqual(['xai']))

    commitProviders(ctx, consumer, { 'openai-codex': {}, xai: {} })
    await vi.waitFor(() => expect(routes(ctx)).toEqual(['openai-codex', 'xai']))

    commitProviders(ctx, consumer, { 'openai-codex': {} })
    await vi.waitFor(() => expect(routes(ctx)).toEqual(['openai-codex']))

    commitProviders(ctx, consumer, {})
    await vi.waitFor(() => expect(routes(ctx)).toEqual([]))
  })

  it('keeps composition providers and drops routes when the plugin unloads', async () => {
    const { ctx, consumer } = await boot({ providers: { xai: {}, anthropic: {} } })
    expect(routes(ctx)).toEqual(['anthropic', 'xai'])
    await consumer.dispose()
    await vi.waitFor(() => expect(routes(ctx)).toEqual([]))
  })

  it('lists every catalog model for an enabled provider without an allowlist', async () => {
    const { ctx } = await boot({ providers: { xai: {} } })
    const models = await ctx.llm.listModels('xai')
    expect(models.length).toBeGreaterThan(0)
  })
})
