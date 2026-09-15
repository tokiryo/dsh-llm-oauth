import { describe, expect, it, vi } from 'vitest'
import type { AssistantMessage, AssistantMessageEvent } from '@earendil-works/pi-ai'

// Exercise the current Harness export contract even with older local host builds.
vi.mock('@deepseek-ai/dsh-llm', async importOriginal => {
  const host = await importOriginal<Record<string, unknown>>()
  return { ...host, CallId: undefined, ToolCallId: (id: string) => id }
})
import { toStreamChunks } from '../src/stream.ts'

const message: AssistantMessage = {
  role: 'assistant', api: 'openai-responses', provider: 'openai-codex', model: 'fixture',
  content: [{ type: 'text', text: 'Hello' }], timestamp: 0, stopReason: 'stop',
  usage: { input: 10, output: 2, cacheRead: 5, cacheWrite: 0, totalTokens: 17,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
}
async function collect(events: AssistantMessageEvent[]) {
  const chunks = []
  for await (const chunk of toStreamChunks((async function* () { yield* events })())) chunks.push(chunk)
  return chunks
}

describe('stream compatibility', () => {
  it('uses the renamed ToolCallId constructor', async () => {
    const toolCall = { type: 'toolCall' as const, id: 'call-1', name: 'read', arguments: { path: 'a' } }
    const chunks = await collect([
      { type: 'toolcall_end', contentIndex: 0, toolCall, partial: message },
      { type: 'done', reason: 'stop', message },
    ])
    expect(chunks[0]).toMatchObject({ type: 'block-end', block: { id: 'call-1', name: 'read', arguments: '{"path":"a"}' } })
    expect(chunks[1]).toEqual({ type: 'usage', usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 5, totalTokens: 17 } })
  })
  it('reports deferred responses as explicit failures', async () => {
    const chunks = await collect([{ type: 'done', reason: 'deferred', message: { ...message, stopReason: 'deferred' } }])
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'error', failure: { code: 'PI_AI_ERROR' } } })
  })
})
