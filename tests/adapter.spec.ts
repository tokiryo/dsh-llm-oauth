import { describe, expect, it, vi } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'
import { OAuthPiAiAdapter } from '../src/adapter.ts'
import { FileCredentialStore } from '../src/store.ts'

function adapter() {
  return new OAuthPiAiAdapter({ authPath: 'unused', store: new FileCredentialStore('unused'), catalog: ['openai-codex'] })
}

describe('Harness request options', () => {
  it('forwards the selected reasoning effort and advertises only supported input', async () => {
    const subject = adapter()
    const [model] = await subject.listModels('openai-codex')
    expect(model!.inputModalities).toEqual(['text'])
    const info = await subject.resolveModel('openai-codex', model!.id)
    const effort = info.reasoning!.efforts.find(e => e.id !== 'off')!.id
    vi.spyOn(subject.modelsApi(), 'checkAuth').mockResolvedValue({ type: 'oauth' })
    const events = createAssistantMessageEventStream()
    events.end()
    const stream = vi.spyOn(subject.modelsApi(), 'streamSimple').mockReturnValue(events)
    await expect(async () => {
      for await (const _ of subject.stream({ provider: 'openai-codex', model: model!.id, messages: [], reasoningEffort: effort })) {}
    }).rejects.toThrow(/without done/)
    expect(stream.mock.calls[0]![2]).toMatchObject({ reasoning: effort, maxRetries: 0 })
  })

  it('rejects unsupported effort before looking up credentials', async () => {
    const subject = adapter()
    const [model] = await subject.listModels('openai-codex')
    const auth = vi.spyOn(subject.modelsApi(), 'checkAuth')
    await expect(async () => {
      for await (const _ of subject.stream({ provider: 'openai-codex', model: model!.id, messages: [], reasoningEffort: ReasoningEffortId('invalid') })) {}
    }).rejects.toMatchObject({ code: 'UNSUPPORTED_REASONING_EFFORT' })
    expect(auth).not.toHaveBeenCalled()
  })
})
