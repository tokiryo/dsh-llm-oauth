import { describe, expect, it } from 'vitest'
import {
  ToolCallId,
  createAssistantMessage,
  createDeveloperMessage,
  createSystemMessage,
  createToolResultMessage,
  createUserMessage,
} from '@deepseek-ai/dsh-llm'
import { toPiContext } from '../src/context.ts'

const system = createSystemMessage('Instructions')
const user = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Hello' }] })
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

describe('tool round trip', () => {
  const callId = ToolCallId('call_1')
  const assistant = createAssistantMessage({
    source: { provider: 'xai', model: 'grok-4.6' },
    content: [{ type: 'tool-call', id: callId, name: 'bash', arguments: '{"cmd":"ls"}' }],
  })

  it('maps tool-role messages to pi-ai toolResult answering the call', () => {
    const result = createToolResultMessage({ callId, content: [{ type: 'text', text: 'a.txt' }], isError: false })
    const context = toPiContext({ ...options, messages: [system, user, assistant, result] })
    expect(context.messages.at(-1)).toMatchObject({
      role: 'toolResult',
      toolCallId: 'call_1',
      toolName: 'bash',
      content: [{ type: 'text', text: 'a.txt' }],
      isError: false,
    })
  })

  it('keeps the error flag and substitutes empty output', () => {
    const result = createToolResultMessage({ callId, content: [], isError: true })
    const context = toPiContext({ ...options, messages: [user, assistant, result] })
    expect(context.messages.at(-1)).toMatchObject({
      role: 'toolResult',
      content: [{ type: 'text', text: '(no output)' }],
      isError: true,
    })
  })

  it('drops text-less developer tool-change messages', () => {
    const developer = createDeveloperMessage({
      source: { kind: 'user' },
      content: [{ type: 'tool-removal', toolName: 'bash' } as never],
    })
    const context = toPiContext({ ...options, messages: [system, user, developer] })
    expect(context.messages.map(m => m.role)).toEqual(['user'])
  })
})
