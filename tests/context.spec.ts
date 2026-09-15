import { describe, expect, it } from 'vitest'
import { createMessage } from '@deepseek-ai/dsh-llm'
import { toPiContext } from '../src/context.ts'

const system = createMessage({ role: 'system', source: { kind: 'plugin', plugin: 'test' }, content: [{ type: 'text', text: 'Instructions' }] })
const user = createMessage({ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Hello' }] })
const options = { provider: 'openai-codex', model: 'unused', messages: [system, user] }

describe('Harness system prompt', () => {
  it('extracts the leading system message from current loop requests', () => {
    const context = toPiContext(options)
    expect(context.systemPrompt).toBe('Instructions')
    expect(context.messages.map(m => m.content)).toEqual(['Hello'])
  })
  it('preserves explicit system override and historical message order', () => {
    const context = toPiContext({ ...options, system: 'Override' })
    expect(context.systemPrompt).toBe('Override')
    expect(context.messages.map(m => m.content)).toEqual(['Instructions', 'Hello'])
  })
  it('keeps mid-conversation system updates in their original position', () => {
    const context = toPiContext({ ...options, messages: [user, system] })
    expect(context.systemPrompt).toBeUndefined()
    expect(context.messages.map(m => m.content)).toEqual(['Hello', 'Instructions'])
  })
})
