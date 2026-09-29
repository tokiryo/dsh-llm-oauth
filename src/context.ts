/**
 * Minimal harness → pi-ai context conversion (text + tools).
 * Image content is refused; use first-party dsh-llm-pi-ai for vision.
 */

import { contentHasImage, LlmError } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, RequestMessage } from '@deepseek-ai/dsh-llm'
import type {
  AssistantMessage,
  Context as PiContext,
  JsonObject,
  Message as PiMessage,
  TextContent,
  ThinkingContent,
  Tool as PiTool,
  ToolCall,
} from '@earendil-works/pi-ai'

function flattenText(message: { readonly content: readonly ContentBlock[] }): string {
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

function parseArguments(raw: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as JsonObject
    }
  } catch {
    // tolerate malformed historical arguments
  }
  return {}
}

function emptyUsage(): AssistantMessage['usage'] {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

function toAssistant(message: RequestMessage): AssistantMessage {
  if (message.role !== 'assistant' || message.source.kind !== 'model') {
    throw new LlmError('Assistant message is missing model provenance', 'UNSUPPORTED_CONTENT')
  }
  const content: Array<TextContent | ThinkingContent | ToolCall> = []
  for (const block of message.content) {
    if (block.type === 'text') content.push({ type: 'text', text: block.text })
    else if (block.type === 'reasoning') content.push({ type: 'thinking', thinking: block.text })
    else if (block.type === 'tool-call') {
      content.push({
        type: 'toolCall',
        id: String(block.id),
        name: block.name,
        arguments: parseArguments(block.arguments),
      })
    }
  }
  return {
    role: 'assistant',
    content,
    api: 'openai-completions',
    provider: message.source.provider,
    model: message.source.model,
    usage: emptyUsage(),
    stopReason: 'stop',
    timestamp: 0,
  }
}

/**
 * Convert one assembled harness request into pi-ai's context envelope.
 * @param options - fully assembled model request.
 */
export function toPiContext(options: GenerateOptions): PiContext {
  if (options.messages.some(message => contentHasImage(message.content))) {
    throw new LlmError(
      'dsh-llm-oauth does not support image content; use dsh-llm-pi-ai for vision models',
      'UNSUPPORTED_CONTENT',
    )
  }

  const toolNames = new Map<string, string>()
  const messages: PiMessage[] = []
  const leading = options.messages[0]
  const systemPrompt = options.system ?? (leading?.role === 'system' ? flattenText(leading) || undefined : undefined)
  const history = options.system === undefined && leading?.role === 'system'
    ? options.messages.slice(1) : options.messages

  for (const message of history) {
    if (message.role === 'system') {
      messages.push({ role: 'user', content: flattenText(message), timestamp: 0 })
      continue
    }
    if (message.role === 'assistant') {
      const assistant = toAssistant(message)
      for (const block of assistant.content) {
        if (block.type === 'toolCall') toolNames.set(block.id, block.name)
      }
      messages.push(assistant)
      continue
    }

    // Tool results are first-class `tool` messages answering one call id.
    if (message.role === 'tool') {
      const callId = String(message.toolCallId)
      messages.push({
        role: 'toolResult',
        toolCallId: callId,
        toolName: toolNames.get(callId) ?? 'unknown',
        content: [{ type: 'text', text: flattenText(message) || '(no output)' }],
        isError: message.isError === true,
        timestamp: 0,
      })
      continue
    }

    const text = flattenText(message)
    // Developer messages carry tool additions/removals; tools are sent separately.
    if (message.role === 'developer' && text.length === 0) continue
    messages.push({ role: 'user', content: text, timestamp: 0 })
  }

  const tools: PiTool[] | undefined = options.tools?.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))

  return {
    ...systemPrompt !== undefined ? { systemPrompt } : {},
    messages,
    ...tools !== undefined && tools.length > 0 ? { tools } : {},
  }
}
