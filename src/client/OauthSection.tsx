/**
 * Settings → OAuth / 订阅: enable toggles + login status.
 * Talks to the host plugin over `/dsh-llm-oauth/*` (not Typert RPC).
 * On login, opens the authorization URL in a new window when the host returns one.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  disableOauthProvider,
  enableOauthProvider,
  fetchOauthPicker,
  fetchOauthStatus,
  loginOauthProvider,
  logoutOauthProvider,
  saveOauthPicker,
  type OAuthLoginCommand,
  type OAuthPickerSnapshot,
  type OAuthProviderStatus,
  type OAuthStatusSnapshot,
} from './api.ts'
import type { OauthSettingsKey } from './locales.ts'
import styles from './OauthSection.module.css'

export interface OauthSectionInjected {
  t: (key: OauthSettingsKey) => string
}

export type OauthSectionProps = Partial<OauthSectionInjected>

type BusyAction = 'enable' | 'disable' | 'login' | 'logout' | 'refresh' | 'picker'

/** Try to open the OAuth URL; returns false if the browser blocked the popup. */
function tryOpenAuthWindow(url: string): boolean {
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    return win !== null
  } catch {
    return false
  }
}

function extractHttpUrl(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const match = text.match(/https?:\/\/[^\s]+/i)
  return match?.[0]
}

export function OauthSection(props: OauthSectionProps): ReactNode {
  const { t } = props
  if (t === undefined) return null
  return <Loaded t={t} />
}

function Loaded({ t }: { t: (key: OauthSettingsKey) => string }): ReactNode {
  const [status, setStatus] = useState<OAuthStatusSnapshot | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<{ id?: string, action: BusyAction } | undefined>(undefined)
  const [command, setCommand] = useState<OAuthLoginCommand | undefined>(undefined)
  const [popupBlocked, setPopupBlocked] = useState(false)

  const load = useCallback(async () => {
    setBusy({ action: 'refresh' })
    setError(undefined)
    try {
      const next = await fetchOauthStatus()
      setStatus(next)
      setCommand(undefined)
      setPopupBlocked(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(undefined)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const applyLoginResult = (next: OAuthStatusSnapshot): void => {
    setStatus(next)
    const cmd = next.command
    setCommand(cmd)
    if (cmd?.kind === 'error' && cmd.text) setError(cmd.text)
    const url = cmd?.openUrl ?? extractHttpUrl(cmd?.text)
    if (url !== undefined && cmd?.kind !== 'error') {
      const opened = tryOpenAuthWindow(url)
      setPopupBlocked(!opened)
    } else {
      setPopupBlocked(false)
    }
  }

  const run = async (
    provider: string,
    action: Exclude<BusyAction, 'refresh'>,
    fn: (id: string) => Promise<OAuthStatusSnapshot>,
  ): Promise<void> => {
    setBusy({ id: provider, action })
    setError(undefined)
    if (action !== 'login') {
      setCommand(undefined)
      setPopupBlocked(false)
    }
    try {
      const next = await fn(provider)
      if (action === 'login') applyLoginResult(next)
      else {
        setStatus(next)
        setCommand(undefined)
        setPopupBlocked(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(undefined)
    }
  }

  if (status === undefined && error === undefined) {
    return (
      <div className={styles.section}>
        <h2 className={styles.title}>{t('title')}</h2>
        <p className={styles.notice}>{t('loading')}</p>
      </div>
    )
  }

  if (status === undefined) {
    return (
      <div className={styles.section}>
        <h2 className={styles.title}>{t('title')}</h2>
        <p className={styles.error}>{`${t('loadFailed')}: ${error ?? ''}`}</p>
        <div className={styles.toolbar}>
          <button type="button" className={styles.secondaryButton} onClick={() => { void load() }}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const globalBusy = busy?.action === 'refresh'
  const authUrl = command?.openUrl ?? extractHttpUrl(command?.text)
  const userCode = command?.userCode

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>{t('title')}</h2>
      <p className={styles.intro}>{t('intro')}</p>
      <p className={styles.meta}>{`${t('authFile')}: ${status.authPath}`}</p>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={globalBusy}
          onClick={() => { void load() }}
        >
          {globalBusy ? t('busy') : t('refresh')}
        </button>
      </div>
      {error !== undefined ? <p className={styles.error}>{error}</p> : null}
      {popupBlocked ? <p className={styles.error}>{t('popupBlocked')}</p> : null}
      {userCode !== undefined
        ? (
          <div className={styles.codeBox} role="status">
            <span className={styles.codeLabel}>{t('userCodeLabel')}</span>
            <code className={styles.codeValue}>{userCode}</code>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => { void navigator.clipboard?.writeText(userCode) }}
            >
              {t('copyCode')}
            </button>
          </div>
        )
        : null}
      {authUrl !== undefined
        ? (
          <div className={styles.toolbar}>
            <a
              className={styles.buttonLink}
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { setPopupBlocked(false) }}
            >
              {t('openAuth')}
            </a>
          </div>
        )
        : null}
      {command?.text !== undefined ? <p className={styles.command} role="status">{command.text}</p> : null}
      {status.providers.length === 0
        ? <p className={styles.notice}>{t('empty')}</p>
        : (
          <ul className={styles.rows}>
            {status.providers.map(row => (
              <ProviderRow
                key={row.id}
                row={row}
                t={t}
                busy={busy}
                onEnable={() => { void run(row.id, 'enable', enableOauthProvider) }}
                onDisable={() => { void run(row.id, 'disable', disableOauthProvider) }}
                onLogin={() => { void run(row.id, 'login', loginOauthProvider) }}
                onLogout={() => { void run(row.id, 'logout', logoutOauthProvider) }}
              />
            ))}
          </ul>
        )}
      <p className={styles.notice}>{t('tipEnable')}</p>
      <p className={styles.notice}>{t('tipLogin')}</p>
    </div>
  )
}

function ProviderRow(props: {
  row: OAuthProviderStatus
  t: (key: OauthSettingsKey) => string
  busy: { id?: string, action: BusyAction } | undefined
  onEnable: () => void
  onDisable: () => void
  onLogin: () => void
  onLogout: () => void
}): ReactNode {
  const { row, t, busy, onEnable, onDisable, onLogin, onLogout } = props
  const rowBusy = busy?.id === row.id
  const disabled = busy !== undefined

  return (
    <li className={styles.rowCard}>
      <div className={styles.rowHead}>
        <div className={styles.rowIdentity}>
          <span className={styles.rowName}>{row.name}</span>
          <span className={styles.rowId}>{row.id}</span>
          <div className={styles.badges}>
            <span className={`${styles.badge} ${row.enabled ? styles.badgeOn : styles.badgeOff}`}>
              {row.enabled ? t('enabled') : t('disabled')}
            </span>
            <span className={`${styles.badge} ${row.loggedIn ? styles.badgeOk : styles.badgeMissing}`}>
              {row.loggedIn
                ? `${t('loggedIn')}${row.authType ? ` (${row.authType})` : ''}`
                : t('loggedOut')}
            </span>
            {row.loginStatus === 'waiting'
              ? <span className={`${styles.badge} ${styles.badgeWarn}`}>{t('loginWaiting')}</span>
              : null}
            {row.loginStatus === 'error'
              ? <span className={`${styles.badge} ${styles.badgeMissing}`}>{t('loginError')}</span>
              : null}
          </div>
          {row.id === 'openrouter' && !row.enabled
            ? <p className={styles.notice}>{t('openrouterWarn')}</p>
            : null}
          {row.loginDetail !== undefined && row.loginStatus === 'error'
            ? <p className={styles.error}>{row.loginDetail}</p>
            : null}
        </div>
      </div>
      <div className={styles.rowActions}>
        {row.enabled
          ? (
            <button type="button" className={styles.secondaryButton} disabled={disabled} onClick={onDisable}>
              {rowBusy && busy?.action === 'disable' ? t('busy') : t('disable')}
            </button>
          )
          : (
            <button type="button" className={styles.button} disabled={disabled} onClick={onEnable}>
              {rowBusy && busy?.action === 'enable' ? t('busy') : t('enable')}
            </button>
          )}
        {row.loggedIn
          ? (
            <button type="button" className={styles.dangerButton} disabled={disabled} onClick={onLogout}>
              {rowBusy && busy?.action === 'logout' ? t('busy') : t('logout')}
            </button>
          )
          : (
            <button type="button" className={styles.secondaryButton} disabled={disabled} onClick={onLogin}>
              {rowBusy && busy?.action === 'login' ? t('busy') : t('login')}
            </button>
          )}
      </div>
      {row.enabled ? <ModelPicker provider={row.id} t={t} disabled={disabled} /> : null}
    </li>
  )
}

function ModelPicker(props: {
  provider: string
  t: (key: OauthSettingsKey) => string
  disabled: boolean
}): ReactNode {
  const { provider, t, disabled } = props
  const [picker, setPicker] = useState<OAuthPickerSnapshot | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [labels, setLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setError(undefined)
    void fetchOauthPicker(provider).then((next) => {
      if (cancelled) return
      setPicker(next)
      setDraft(new Set(next.models.filter(model => model.listed).map(model => model.id)))
      const nextLabels: Record<string, string> = {}
      for (const model of next.models) {
        if (model.label !== model.name) nextLabels[model.id] = model.label
      }
      setLabels(nextLabels)
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      cancelled = true
    }
  }, [provider])

  const persist = async (models: string[] | null, modelNames?: Record<string, string> | null) => {
    setSaving(true)
    setError(undefined)
    try {
      const next = await saveOauthPicker(provider, { models, ...modelNames === undefined ? {} : { modelNames } })
      const snapshot = next.picker ?? await fetchOauthPicker(provider)
      setPicker(snapshot)
      setDraft(new Set(snapshot.models.filter(model => model.listed).map(model => model.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const toggle = (id: string, listed: boolean) => {
    const next = new Set(draft)
    if (listed) next.add(id)
    else next.delete(id)
    setDraft(next)
  }

  if (error !== undefined && picker === undefined) {
    return <p className={styles.error}>{`${t('modelsLoadFailed')}: ${error}`}</p>
  }
  if (picker === undefined) {
    return <p className={styles.notice}>{t('loading')}</p>
  }
  if (picker.models.length === 0) {
    return <p className={styles.notice}>{t('modelsEmpty')}</p>
  }

  const listedCount = draft.size
  return (
    <div className={styles.picker}>
      <div className={styles.pickerHead}>
        <strong className={styles.pickerTitle}>{t('modelsTitle')}</strong>
        <span className={styles.meta}>{`${String(listedCount)} / ${String(picker.models.length)} ${t('modelsListed')}`}</span>
      </div>
      <p className={styles.notice}>{t('modelsIntro')}</p>
      {error !== undefined ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={disabled || saving}
          onClick={() => { void persist(null, Object.keys(labels).length === 0 ? null : labels) }}
        >
          {t('modelsAll')}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={disabled || saving}
          onClick={() => { void persist([], Object.keys(labels).length === 0 ? null : labels) }}
        >
          {t('modelsNone')}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={disabled || saving}
          onClick={() => {
            const names = Object.fromEntries(Object.entries(labels).filter(([, label]) => label.trim().length > 0))
            void persist([...draft], Object.keys(names).length === 0 ? null : names)
          }}
        >
          {saving ? t('busy') : t('modelsSave')}
        </button>
      </div>
      <ul className={styles.modelList}>
        {picker.models.map(model => (
          <li key={model.id} className={styles.modelRow}>
            <label className={styles.modelLabel}>
              <input
                type="checkbox"
                checked={draft.has(model.id)}
                disabled={disabled || saving}
                onChange={event => { toggle(model.id, event.target.checked) }}
              />
              <span>
                <span className={styles.rowName}>{model.label}</span>
                <span className={styles.rowId}>{model.id}</span>
              </span>
            </label>
            <input
              className={styles.modelRename}
              type="text"
              aria-label={t('modelsRename')}
              placeholder={model.name}
              value={labels[model.id] ?? ''}
              disabled={disabled || saving}
              onChange={event => {
                const value = event.target.value
                setLabels((current) => {
                  const next = { ...current }
                  if (value.trim().length === 0) delete next[model.id]
                  else next[model.id] = value
                  return next
                })
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
