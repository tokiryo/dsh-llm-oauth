/**
 * Serializable configuration and defaults.
 *
 * Composition and the optional `llm-oauth` settings section share this shape:
 * - `catalog` — OAuth-capable pi-ai ids this plugin may offer
 * - `providers` — enabled profiles (key present ⇒ route registered / models listed)
 *
 * Default `providers` is empty so installing the plugin does not dump every
 * catalog model into the picker. Enable via Settings → OAuth / 订阅, or by
 * writing a profile under `llm-oauth.providers.<id>`, or automatically on a
 * successful `/oauth login`.
 *
 * `providers` is **volatile** so Settings / `/oauth enable` can mutate it at
 * runtime. Harness 0.1.7+ refuses `settings.mutate` unless the field is marked
 * volatile. Cordis then wraps the live value in a `.get()` cell — unwrap it
 * before treating the dict as plain JSON.
 *
 * @module dsh-llm-oauth/config
 */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_PROVIDERS } from './catalog.ts'

/** One enabled OAuth provider profile. */
export interface OAuthProviderProfile {
  /** Optional display override; defaults to the pi-ai catalog name. */
  displayName?: string
  /**
   * Model ids advertised in the picker. Omitted / undefined ⇒ every catalog
   * model. Empty array ⇒ the provider is enabled but lists nothing.
   */
  models?: string[]
  /** Optional picker labels keyed by catalog model id. */
  modelNames?: Record<string, string>
}

/** Plugin configuration supplied by the profile composition / settings section. */
export interface Config {
  /**
   * pi-ai catalog provider ids that declare OAuth and may be enabled.
   * Defaults: xai, github-copilot, openai-codex, anthropic, openrouter, kimi-coding.
   */
  catalog?: string[]
  /**
   * Enabled OAuth routes. Presence of a key under `providers` turns that
   * catalog id on (registers the adapter route and lists its models).
   *
   * Legacy (v0.1) accepted a string array here meaning “always-on catalog”;
   * that form is still accepted and normalized to `catalog` + empty enablement
   * so upgrades stop flooding the model picker.
   *
   * At runtime this field may be a Cordis volatile cell (`.get()`).
   */
  providers?: Record<string, OAuthProviderProfile> | string[] | { get(): unknown }
  /** Override path for the durable OAuth credential file. */
  authPath?: string
}

/** Configuration after defaults. */
export interface ResolvedConfig {
  catalog: string[]
  providers: Record<string, OAuthProviderProfile>
  authPath?: string
}

/** Empty enabled-profile object accepted by the settings form. */
const ProviderProfileSchema: z<OAuthProviderProfile> = z.object({
  displayName: z.string(),
  // schemastery gives arrays / dicts an implicit `[]` / `{}` default; that
  // would turn `xai: {}` into an empty allowlist that hides every model.
  models: z.array(z.string()).default(undefined as never),
  modelNames: z.dict(z.string()).default(undefined as never),
})

/**
 * Loader-visible configuration schema.
 * Shared by composition entry config and the `llm-oauth` settings section.
 *
 * `providers` must be volatile: otherwise Settings → Enable throws
 * `Plugin entry "llm-oauth" has no volatile fields` on Harness 0.1.7+.
 */
// Cast: the interface also admits the runtime volatile cell, which the
// schema's inferred input type cannot express.
export const Config = z.object({
  catalog: z.array(z.string()).default([...DEFAULT_PROVIDERS]),
  // Dict = enabled profiles. Array = legacy v0.1 “always register these ids”.
  providers: z.union([
    z.dict(ProviderProfileSchema),
    z.array(z.string()),
  ]).default({}).volatile(),
  authPath: z.string(),
}) as unknown as z<Config>

/** Brand cosmokit puts on every volatile reference (shared across ESM/CJS copies). */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/**
 * Cordis volatile cells are frozen *plain* objects `{ get, [VOLATILE_WRITE] }`.
 * Detect them the way cosmokit's `isVolatile` does, without importing cosmokit
 * (optional peer). A bare `{ get() }` with no other keys is accepted as well.
 */
function isVolatileCell(value: unknown): value is { get(): unknown } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const getter = (value as { get?: unknown }).get
  if (typeof getter !== 'function') return false
  if (VOLATILE_WRITE in value) return true
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === 'get'
}

/**
 * Unwrap a Cordis volatile cell (and nested cells) to a plain snapshot.
 * @param value - live config field, cell, or already-plain JSON.
 */
export function unwrapMaybeVolatile<T>(value: T): T {
  let current: unknown = value
  for (let depth = 0; depth < 4; depth++) {
    if (!isVolatileCell(current)) return current as T
    current = current.get()
  }
  return current as T
}

function asProviderDict(value: unknown): Record<string, OAuthProviderProfile> {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, OAuthProviderProfile> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === undefined || raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      out[id] = {}
      continue
    }
    const entry = raw as Record<string, unknown>
    const profile: OAuthProviderProfile = {}
    if (typeof entry.displayName === 'string') profile.displayName = entry.displayName
    if (Array.isArray(entry.models) && entry.models.every(item => typeof item === 'string')) {
      profile.models = [...entry.models]
    }
    if (entry.modelNames !== undefined && entry.modelNames !== null
      && typeof entry.modelNames === 'object' && !Array.isArray(entry.modelNames)) {
      const names: Record<string, string> = {}
      for (const [modelId, label] of Object.entries(entry.modelNames as Record<string, unknown>)) {
        if (typeof label === 'string' && label.trim().length > 0) names[modelId] = label
      }
      if (Object.keys(names).length > 0) profile.modelNames = names
    }
    out[id] = profile
  }
  return out
}

/**
 * Normalize composition/settings input: legacy `providers: string[]` becomes
 * the catalog with nothing enabled (dormant), matching the v0.2 default.
 * @param config - partial or legacy configuration, possibly with volatile cells.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  const rawProviders = unwrapMaybeVolatile(config.providers)
  const legacyList = Array.isArray(rawProviders) ? rawProviders.filter(id => typeof id === 'string') : undefined
  const catalog = config.catalog
    ?? (legacyList !== undefined && legacyList.length > 0 ? [...legacyList] : [...DEFAULT_PROVIDERS])
  const providers = legacyList !== undefined ? {} : asProviderDict(rawProviders)
  return {
    catalog,
    providers,
    ...config.authPath === undefined ? {} : { authPath: config.authPath },
  }
}

/** Sorted list of enabled provider route ids. */
export function enabledProviderIds(config: Config | ResolvedConfig): string[] {
  const providers = resolveConfig(config).providers
  return Object.keys(providers).sort((a, b) => a.localeCompare(b))
}

/**
 * Merge a picker patch onto one provider profile without dropping other knobs.
 * `models: null` / `modelNames: null` clears that field (show all / catalog names).
 */
export function applyPickerPatch(
  previous: OAuthProviderProfile | undefined,
  patch: {
    displayName?: string | null
    models?: string[] | null
    modelNames?: Record<string, string> | null
  },
): OAuthProviderProfile {
  const next: OAuthProviderProfile = { ...previous }
  if ('displayName' in patch) {
    if (patch.displayName === null || patch.displayName.trim() === '') delete next.displayName
    else next.displayName = patch.displayName.trim()
  }
  if ('models' in patch) {
    if (patch.models === null) delete next.models
    else next.models = [...new Set(patch.models)]
  }
  if ('modelNames' in patch) {
    if (patch.modelNames === null) delete next.modelNames
    else {
      const names: Record<string, string> = {}
      for (const [id, label] of Object.entries(patch.modelNames)) {
        if (label.trim().length > 0) names[id] = label.trim()
      }
      if (Object.keys(names).length === 0) delete next.modelNames
      else next.modelNames = names
    }
  }
  return next
}
