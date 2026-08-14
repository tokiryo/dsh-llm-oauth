import { describe, expect, it, beforeEach } from 'vitest'
import { handleOauthCommand, listLoginWatches, resetLoginWatches } from '../src/command.ts'
import type { OAuthPiAiAdapter } from '../src/adapter.ts'

function fakeAdapter(login: OAuthPiAiAdapter['login']): OAuthPiAiAdapter {
  return {
    authPath: () => '/tmp/pi-ai-oauth.json',
    catalogIds: () => ['xai'],
    routeIds: () => ['xai'],
    displayName: () => 'xAI',
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

  it('auto-answers openai-codex select prompts with device_code', async () => {
    let chosen: string | undefined
    const adapter = {
      authPath: () => '/tmp/pi-ai-oauth.json',
      catalogIds: () => ['openai-codex'],
      routeIds: () => ['openai-codex'],
      displayName: () => 'OpenAI Codex',
      checkAuth: async () => undefined,
      logout: async () => undefined,
      login: async (_provider, interaction) => {
        chosen = await interaction.prompt({
          type: 'select',
          message: 'Select OpenAI Codex login method:',
          options: [
            { id: 'browser', label: 'Browser login (default)' },
            { id: 'device_code', label: 'Device code login (headless)' },
          ],
        })
        interaction.notify({
          type: 'device_code',
          verificationUri: 'https://auth.openai.com/codex/device',
          userCode: 'CODEX-99',
        })
        return new Promise(() => undefined)
      },
    } as unknown as OAuthPiAiAdapter

    const result = await handleOauthCommand(adapter, 'login openai-codex')
    expect(chosen).toBe('device_code')
    expect(result.kind).toBe('success')
    expect(result.text).toContain('CODEX-99')
    expect(result.text).toContain('device_code')
    expect(result.openUrl).toBe('https://auth.openai.com/codex/device')
    expect(result.userCode).toBe('CODEX-99')
  })

  it('auto-answers github-copilot enterprise prompt with blank (github.com)', async () => {
    let enterprise: string | undefined
    const adapter = {
      authPath: () => '/tmp/pi-ai-oauth.json',
      catalogIds: () => ['github-copilot'],
      routeIds: () => ['github-copilot'],
      displayName: () => 'GitHub Copilot',
      checkAuth: async () => undefined,
      logout: async () => undefined,
      login: async (_provider, interaction) => {
        enterprise = await interaction.prompt({
          type: 'text',
          message: 'GitHub Enterprise URL/domain (blank for github.com)',
          placeholder: 'company.ghe.com',
        })
        interaction.notify({
          type: 'device_code',
          verificationUri: 'https://github.com/login/device',
          userCode: 'GH-1234',
        })
        return new Promise(() => undefined)
      },
    } as unknown as OAuthPiAiAdapter

    const result = await handleOauthCommand(adapter, 'login github-copilot')
    expect(enterprise).toBe('')
    expect(result.kind).toBe('success')
    expect(result.openUrl).toBe('https://github.com/login/device')
    expect(result.userCode).toBe('GH-1234')
  })
})
