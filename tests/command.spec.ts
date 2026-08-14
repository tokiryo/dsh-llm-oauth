import { describe, expect, it, beforeEach } from 'vitest'
import { handleOauthCommand, listLoginWatches, resetLoginWatches } from '../src/command.ts'
import type { OAuthPiAiAdapter } from '../src/adapter.ts'

function fakeAdapter(login: OAuthPiAiAdapter['login']): OAuthPiAiAdapter {
  return {
    authPath: () => '/tmp/pi-ai-oauth.json',
    routeIds: () => ['xai'],
    checkAuth: async () => undefined,
    logout: async () => undefined,
    login,
  } as unknown as OAuthPiAiAdapter
}

describe('/oauth login', () => {
  beforeEach(() => {
    resetLoginWatches()
  })

  it('returns the device-code URL without waiting for the browser', async () => {
    let finish!: (value: { type: 'oauth' }) => void
    const hung = new Promise<{ type: 'oauth' }>(resolve => {
      finish = resolve
    })
    const adapter = fakeAdapter(async (_provider, interaction) => {
      interaction.notify({
        type: 'device_code',
        verificationUri: 'https://auth.x.ai/device',
        userCode: 'ABCD-1234',
      })
      return hung
    })

    const result = await handleOauthCommand(adapter, 'login xai')
    expect(result.kind).toBe('success')
    expect(result.text).toContain('https://auth.x.ai/device')
    expect(result.text).toContain('ABCD-1234')
    expect(result.text).toContain('background')
    expect(listLoginWatches()).toMatchObject([{ provider: 'xai', status: 'waiting' }])
    finish({ type: 'oauth' })
    await hung
    await Promise.resolve()
    expect(listLoginWatches()[0]?.status).toBe('ok')
  })

  it('fails immediately when the provider never issues a URL', async () => {
    const adapter = fakeAdapter(async () => {
      throw new Error('xAI OAuth device authorization failed (HTTP 401)')
    })
    const result = await handleOauthCommand(adapter, 'login xai')
    expect(result).toEqual({
      kind: 'error',
      text: 'xAI OAuth device authorization failed (HTTP 401)',
    })
  })

  it('repeats the waiting notice if login is already in flight', async () => {
    const adapter = fakeAdapter(async (_provider, interaction) => {
      interaction.notify({
        type: 'device_code',
        verificationUri: 'https://auth.x.ai/device',
        userCode: 'WAIT-0001',
      })
      return new Promise(() => undefined)
    })
    await handleOauthCommand(adapter, 'login xai')
    const again = await handleOauthCommand(adapter, 'login xai')
    expect(again.text).toContain('WAIT-0001')
    expect(listLoginWatches()).toHaveLength(1)
  })
})
