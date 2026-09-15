/**
 * pi-ai assistant event → harness StreamChunk translation.
 */

import * as llm from '@deepseek-ai/dsh-llm'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { FinishReason, StreamChunk, TokenUsage, ToolCallBlock } from '@deepseek-ai/dsh-llm'
import type { AssistantMessage, AssistantMessageEvent, Usage as PiUsage } from '@earendil-works/pi-ai'

// Harness renamed CallId to ToolCallId; accept both host generations.
const ids = llm as unknown as {
  ToolCallId?: (id: string) => ToolCallBlock['id']
  CallId?: (id: string) => ToolCallBlock['id']
}
const toolCallId = ids.ToolCallId ?? ids.CallId!

function mapUsage(usage: PiUsage): TokenUsage & { totalTokens: number } {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    ...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
    ...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {},
  }
}

function mapStopReason(message: AssistantMessage): FinishReason {
  switch (message.stopReason) {
    case 'stop':
      if (message.content.length === 0) {
        return {
          kind: 'error',
          failure: {
            message: `model "${message.model}" returned a completed response with no content`,
            code: 'EMPTY_RESPONSE',
          },
        }
      }
      return { kind: 'stop' }
    case 'length':
      return { kind: 'max-tokens' }
    case 'toolUse':
      return { kind: 'tool-calls' }
    case 'pending':
    case 'deferred':
      return {
        kind: 'error',
        failure: { message: `Unsupported terminal pi-ai state: ${message.stopReason}`, code: 'PI_AI_ERROR' },
      }
    case 'aborted':
      return {
        kind: 'aborted',
        failure: { message: message.errorMessage ?? 'pi-ai stream aborted', code: 'ABORTED' },
      }
    case 'error':
      return {
        kind: 'error',
        failure: {
          message: message.errorMessage ?? 'pi-ai stream error',
          code: 'PI_AI_ERROR',
        },
      }
  }
}

/**
 * Translate one pi-ai event stream into harness StreamChunks.
 * @param events - one assistant turn's pi-ai event stream.
 */
export async function* toStreamChunks(
  events: AsyncIterable<AssistantMessageEvent>,
): AsyncGenerator<StreamChunk> {
  const toolIds = new Map<number, { id: string, name: string }>()

  for await (const event of events) {
    switch (event.type) {
      case 'start':
        break
      case 'text_start':
        yield { type: 'block-start', index: event.contentIndex, blockType: 'text' }
        break
      case 'text_delta':
        yield { type: 'text-delta', index: event.contentIndex, text: event.delta }
        break
      case 'text_end':
        yield { type: 'block-end', index: event.contentIndex, block: { type: 'text', text: event.content } }
        break
      case 'thinking_start':
        yield { type: 'block-start', index: event.contentIndex, blockType: 'reasoning' }
        break
      case 'thinking_delta':
        yield { type: 'reasoning-delta', index: event.contentIndex, text: event.delta }
        break
      case 'thinking_end':
        yield { type: 'block-end', index: event.contentIndex, block: { type: 'reasoning', text: event.content } }
        break
      case 'toolcall_start': {
        const partial = event.partial.content[event.contentIndex]
        const id = partial?.type === 'toolCall' ? partial.id : ''
        const name = partial?.type === 'toolCall' ? partial.name : ''
        toolIds.set(event.contentIndex, { id, name })
        yield { type: 'block-start', index: event.contentIndex, blockType: 'tool-call' }
        break
      }
      case 'toolcall_delta': {
        const known = toolIds.get(event.contentIndex)
        yield {
          type: 'tool-call-delta',
          index: event.contentIndex,
          id: toolCallId(known?.id ?? ''),
          ...known?.name ? { name: known.name } : {},
          argumentsDelta: event.delta,
        }
        break
      }
      case 'toolcall_end':
        yield {
          type: 'block-end',
          index: event.contentIndex,
          block: {
            type: 'tool-call',
            id: toolCallId(event.toolCall.id),
            name: event.toolCall.name,
            arguments: JSON.stringify(event.toolCall.arguments),
          },
        }
        break
      case 'done':
        yield { type: 'usage', usage: mapUsage(event.message.usage) }
        yield { type: 'finish', reason: mapStopReason(event.message) }
        return
      case 'error':
        yield { type: 'usage', usage: mapUsage(event.error.usage) }
        yield { type: 'finish', reason: mapStopReason(event.error) }
        return
    }
  }
  throw new LlmError('pi-ai event stream ended without done/error', 'STREAM_CLOSED')
}
