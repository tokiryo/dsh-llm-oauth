import z from "@deepseek-ai/schemastery";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { CallId, LlmAdapter, LlmError, attributionHeaders, contentHasImage } from "@deepseek-ai/dsh-llm";
import { createModels, getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
//#region src/catalog.ts
/**
* Resolve OAuth-capable pi-ai catalog providers.
*/
/** Default subscription / OAuth catalog ids this plugin ships. */
const DEFAULT_PROVIDERS = [
	"xai",
	"github-copilot",
	"openai-codex",
	"anthropic",
	"openrouter",
	"kimi-coding"
];
/**
* Every installed catalog provider that declares an OAuth method.
*/
function oauthCatalogProviders() {
	return builtinProviders().filter((provider) => provider.auth.oauth !== void 0);
}
/**
* Resolve configured route ids against the installed catalog.
* @param requested - provider ids from plugin config.
* @returns catalog providers in config order.
*/
function resolveOAuthProviders(requested) {
	const catalog = new Map(builtinProviders().map((provider) => [provider.id, provider]));
	const resolved = [];
	for (const id of requested) {
		const provider = catalog.get(id);
		if (provider === void 0) throw new Error(`dsh-llm-oauth: unknown pi-ai catalog provider "${id}"`);
		if (provider.auth.oauth === void 0) throw new Error(`dsh-llm-oauth: provider "${id}" has no OAuth method (openai is API-key only; use openai-codex for ChatGPT / Codex subscription OAuth, xai for Grok)`);
		resolved.push(provider);
	}
	if (resolved.length === 0) throw new Error("dsh-llm-oauth: providers must list at least one OAuth-capable catalog id");
	return resolved;
}
//#endregion
//#region src/config.ts
/**
* Serializable configuration and defaults.
* @module dsh-llm-oauth/config
*/
/** Loader-visible configuration schema. */
const Config = z.object({
	providers: z.array(z.string()).default([...DEFAULT_PROVIDERS]),
	authPath: z.string()
});
/**
* Resolve the same defaults for direct callers that bypass Cordis Loader.
* @param config - Partial serialized configuration.
*/
function resolveConfig(config = {}) {
	return {
		providers: config.providers ?? [...DEFAULT_PROVIDERS],
		...config.authPath === void 0 ? {} : { authPath: config.authPath }
	};
}
//#endregion
//#region src/context.ts
/**
* Minimal harness → pi-ai context conversion (text + tools).
* Image content is refused; use first-party dsh-llm-pi-ai for vision.
*/
function flattenText(message) {
	return message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
}
function toolResultText(blocks) {
	return blocks.map((block) => {
		if (block.type === "text") return block.text;
		if (block.type === "tool-result") return toolResultText(block.content);
		return "";
	}).join("");
}
function parseArguments(raw) {
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
	} catch {}
	return {};
}
function emptyUsage() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			total: 0
		}
	};
}
function toAssistant(message) {
	const content = [];
	for (const block of message.content) if (block.type === "text") content.push({
		type: "text",
		text: block.text
	});
	else if (block.type === "reasoning") content.push({
		type: "thinking",
		thinking: block.text
	});
	else if (block.type === "tool-call") content.push({
		type: "toolCall",
		id: String(block.id),
		name: block.name,
		arguments: parseArguments(block.arguments)
	});
	return {
		role: "assistant",
		content,
		api: "openai-completions",
		provider: message.source.provider,
		model: message.source.model,
		usage: emptyUsage(),
		stopReason: "stop",
		timestamp: 0
	};
}
/**
* Convert one assembled harness request into pi-ai's context envelope.
* @param options - fully assembled model request.
*/
function toPiContext(options) {
	if (options.messages.some((message) => contentHasImage(message.content))) throw new LlmError("dsh-llm-oauth does not support image content; use dsh-llm-pi-ai for vision models", "UNSUPPORTED_CONTENT");
	const toolNames = /* @__PURE__ */ new Map();
	const messages = [];
	for (const message of options.messages) {
		if (message.role === "system") {
			messages.push({
				role: "user",
				content: flattenText(message),
				timestamp: 0
			});
			continue;
		}
		if (message.role === "assistant") {
			const assistant = toAssistant(message);
			for (const block of assistant.content) if (block.type === "toolCall") toolNames.set(block.id, block.name);
			messages.push(assistant);
			continue;
		}
		const text = flattenText(message);
		const results = message.content.filter((block) => block.type === "tool-result");
		if (text.length > 0 || results.length === 0) messages.push({
			role: "user",
			content: text,
			timestamp: 0
		});
		for (const result of results) messages.push({
			role: "toolResult",
			toolCallId: String(result.toolCallId),
			toolName: toolNames.get(String(result.toolCallId)) ?? "unknown",
			content: [{
				type: "text",
				text: toolResultText(result.content) || "(no output)"
			}],
			isError: result.isError === true,
			timestamp: 0
		});
	}
	const tools = options.tools?.map((tool) => ({
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters
	}));
	return {
		...options.system !== void 0 ? { systemPrompt: options.system } : {},
		messages,
		...tools !== void 0 && tools.length > 0 ? { tools } : {}
	};
}
//#endregion
//#region src/stream.ts
/**
* pi-ai assistant event → harness StreamChunk translation.
*/
function mapUsage(usage) {
	return {
		inputTokens: usage.input,
		outputTokens: usage.output,
		...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
		...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {}
	};
}
function mapStopReason(message) {
	switch (message.stopReason) {
		case "stop":
			if (message.content.length === 0) return {
				kind: "error",
				failure: {
					message: `model "${message.model}" returned a completed response with no content`,
					code: "EMPTY_RESPONSE"
				}
			};
			return { kind: "stop" };
		case "length": return { kind: "max-tokens" };
		case "toolUse": return { kind: "tool-calls" };
		case "aborted": return {
			kind: "aborted",
			failure: {
				message: message.errorMessage ?? "pi-ai stream aborted",
				code: "ABORTED"
			}
		};
		case "error": return {
			kind: "error",
			failure: {
				message: message.errorMessage ?? "pi-ai stream error",
				code: "PI_AI_ERROR"
			}
		};
	}
}
/**
* Translate one pi-ai event stream into harness StreamChunks.
* @param events - one assistant turn's pi-ai event stream.
*/
async function* toStreamChunks(events) {
	const toolIds = /* @__PURE__ */ new Map();
	for await (const event of events) switch (event.type) {
		case "start": break;
		case "text_start":
			yield {
				type: "block-start",
				index: event.contentIndex,
				blockType: "text"
			};
			break;
		case "text_delta":
			yield {
				type: "text-delta",
				index: event.contentIndex,
				text: event.delta
			};
			break;
		case "text_end":
			yield {
				type: "block-end",
				index: event.contentIndex,
				block: {
					type: "text",
					text: event.content
				}
			};
			break;
		case "thinking_start":
			yield {
				type: "block-start",
				index: event.contentIndex,
				blockType: "reasoning"
			};
			break;
		case "thinking_delta":
			yield {
				type: "reasoning-delta",
				index: event.contentIndex,
				text: event.delta
			};
			break;
		case "thinking_end":
			yield {
				type: "block-end",
				index: event.contentIndex,
				block: {
					type: "reasoning",
					text: event.content
				}
			};
			break;
		case "toolcall_start": {
			const partial = event.partial.content[event.contentIndex];
			const id = partial?.type === "toolCall" ? partial.id : "";
			const name = partial?.type === "toolCall" ? partial.name : "";
			toolIds.set(event.contentIndex, {
				id,
				name
			});
			yield {
				type: "block-start",
				index: event.contentIndex,
				blockType: "tool-call"
			};
			break;
		}
		case "toolcall_delta": {
			const known = toolIds.get(event.contentIndex);
			yield {
				type: "tool-call-delta",
				index: event.contentIndex,
				id: CallId(known?.id ?? ""),
				...known?.name ? { name: known.name } : {},
				argumentsDelta: event.delta
			};
			break;
		}
		case "toolcall_end":
			yield {
				type: "block-end",
				index: event.contentIndex,
				block: {
					type: "tool-call",
					id: CallId(event.toolCall.id),
					name: event.toolCall.name,
					arguments: JSON.stringify(event.toolCall.arguments)
				}
			};
			break;
		case "done":
			yield {
				type: "usage",
				usage: mapUsage(event.message.usage)
			};
			yield {
				type: "finish",
				reason: mapStopReason(event.message)
			};
			return;
		case "error":
			yield {
				type: "usage",
				usage: mapUsage(event.error.usage)
			};
			yield {
				type: "finish",
				reason: mapStopReason(event.error)
			};
			return;
	}
	throw new LlmError("pi-ai event stream ended without done/error", "STREAM_CLOSED");
}
//#endregion
//#region src/adapter.ts
/**
* OAuth-aware pi-ai LlmAdapter.
*
* Unlike first-party dsh-llm-pi-ai, Models is constructed with a CredentialStore
* so streamSimple can refresh subscription tokens under the store lock.
*/
/** OAuth-backed multi-provider adapter. */
var OAuthPiAiAdapter = class extends LlmAdapter {
	options;
	providers;
	models;
	byId;
	constructor(options) {
		super();
		this.options = options;
		this.providers = resolveOAuthProviders(options.providers);
		const mutable = createModels({ credentials: options.store });
		for (const provider of this.providers) mutable.setProvider(provider);
		this.models = mutable;
		this.byId = new Map(this.providers.map((provider) => [provider.id, provider]));
	}
	/** Provider route ids this adapter registered. */
	routeIds() {
		return this.providers.map((provider) => provider.id);
	}
	/** Shared Models collection (login/logout/status). */
	modelsApi() {
		return this.models;
	}
	/** Durable auth file path. */
	authPath() {
		return this.options.authPath;
	}
	providerInfo(provider) {
		const entry = this.byId.get(provider);
		if (entry === void 0) return {
			id: provider,
			name: provider
		};
		return {
			id: entry.id,
			name: entry.name
		};
	}
	listModels(provider) {
		return Promise.resolve().then(() => {
			this.requireProvider(provider);
			return this.models.getModels(provider).map((model) => ({
				provider,
				id: model.id,
				name: model.name,
				inputModalities: [...model.input]
			}));
		});
	}
	resolveModel(provider, model, _signal) {
		return Promise.resolve().then(() => {
			const resolved = this.requireModel(provider, model);
			const levels = getSupportedThinkingLevels(resolved);
			const reasoning = levels.length > 0 && !(levels.length === 1 && levels[0] === "off") ? { efforts: levels.map((level) => ({
				id: level,
				name: level
			})) } : void 0;
			return {
				provider,
				id: model,
				name: resolved.name,
				inputModalities: [...resolved.input],
				context: { contextWindow: resolved.contextWindow },
				...reasoning === void 0 ? {} : { reasoning }
			};
		});
	}
	/**
	* Run an interactive OAuth login and persist the credential.
	* @param provider - catalog provider id.
	* @param interaction - prompt/notify callbacks.
	*/
	login(provider, interaction) {
		this.requireProvider(provider);
		return this.models.login(provider, "oauth", interaction);
	}
	/** Drop the stored credential for one provider. */
	logout(provider) {
		this.requireProvider(provider);
		return this.models.logout(provider);
	}
	/** Whether the provider currently has complete auth configuration. */
	checkAuth(provider) {
		this.requireProvider(provider);
		return this.models.checkAuth(provider);
	}
	async *stream(options) {
		if (options.stop !== void 0) throw new LlmError("dsh-llm-oauth does not support GenerateOptions.stop", "UNSUPPORTED_OPTION");
		const model = this.requireModel(options.provider, options.model);
		if (await this.models.checkAuth(options.provider) === void 0) throw new LlmError(`dsh-llm-oauth: provider "${options.provider}" is not logged in; run \`npx dsh-llm-oauth-login ${options.provider}\` or \`/oauth login ${options.provider}\``, "MISSING_CREDENTIAL");
		const context = toPiContext(options);
		yield* toStreamChunks(this.models.streamSimple(model, context, {
			maxRetries: 0,
			...options.temperature === void 0 ? {} : { temperature: options.temperature },
			...options.maxTokens === void 0 ? {} : { maxTokens: options.maxTokens },
			...options.sessionId === void 0 ? {} : { sessionId: String(options.sessionId) },
			...options.signal === void 0 ? {} : { signal: options.signal },
			headers: attributionHeaders()
		}));
	}
	requireProvider(provider) {
		const entry = this.byId.get(provider);
		if (entry === void 0) throw new LlmError(`dsh-llm-oauth does not own provider "${provider}"`, "NO_ADAPTER");
		return entry;
	}
	requireModel(provider, model) {
		this.requireProvider(provider);
		const resolved = this.models.getModel(provider, model);
		if (resolved === void 0) throw new LlmError(`dsh-llm-oauth provider "${provider}" has no catalog model "${model}"`, "UNKNOWN_MODEL");
		return resolved;
	}
};
//#endregion
//#region src/command.ts
const watches = /* @__PURE__ */ new Map();
function usageText(authPath) {
	return [
		"Usage:",
		"  /oauth status",
		"  /oauth list",
		"  /oauth login <provider>",
		"  /oauth logout <provider>",
		"",
		`Auth file: ${authPath}`,
		"",
		"Notes:",
		"  - openai (API) is not OAuth; use openai-codex for ChatGPT / Codex subscription.",
		"  - Grok is provider id \"xai\".",
		"  - Do not also configure the same provider id under llm-pi-ai (DUPLICATE_ADAPTER)."
	].join("\n");
}
function formatEvent(event) {
	switch (event.type) {
		case "auth_url": return [`Open this URL:\n${event.url ?? ""}`, ...event.instructions ? [event.instructions] : []];
		case "device_code": return [`Open this URL:\n${event.verificationUri ?? ""}`, `Enter code: ${event.userCode ?? ""}`];
		case "info":
		case "progress": return event.message ? [event.message] : [];
		default: return [];
	}
}
function isLoginNotice(type) {
	return type === "device_code" || type === "auth_url";
}
function waitingText(watch) {
	return [
		...watch.lines,
		"",
		`Finish signing in to ${watch.provider} in the browser.`,
		"This command has returned so the UI is not stuck; the login continues in the background.",
		"When you are done, run /oauth status."
	].join("\n");
}
/**
* Start OAuth and return as soon as the user has something to open.
* The device-code poll is not bound to the command AbortSignal — the Web
* request ends when this handler returns, and aborting it would cancel login.
*/
async function startLogin(adapter, provider, signal) {
	const existing = watches.get(provider);
	if (existing?.status === "waiting") return {
		kind: "success",
		text: waitingText(existing)
	};
	const lines = [];
	const watch = {
		provider,
		status: "waiting",
		lines
	};
	watches.set(provider, watch);
	let released = false;
	let release;
	const firstNotice = new Promise((resolve, reject) => {
		release = (error) => {
			if (released) return;
			released = true;
			if (error === void 0) resolve();
			else reject(error);
		};
	});
	const onAbort = () => {
		release(/* @__PURE__ */ new Error("oauth login cancelled before the provider returned a URL"));
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	adapter.login(provider, {
		prompt: async (prompt) => {
			throw new Error(`Interactive prompt required (${prompt.type}: ${prompt.message}${prompt.placeholder ? ` / ${prompt.placeholder}` : ""}). This provider cannot finish from /oauth; run: node <profile>/node_modules/dsh-llm-oauth/bin/login.mjs ${provider}`);
		},
		notify: (event) => {
			lines.push(...formatEvent(event));
			if (isLoginNotice(event.type)) release();
		}
	}).then(() => {
		watch.status = "ok";
		watch.detail = `Logged in to ${provider}. Tokens stored in ${adapter.authPath()}.`;
	}, (error) => {
		watch.status = "error";
		watch.detail = error instanceof Error ? error.message : String(error);
		release(error instanceof Error ? error : new Error(watch.detail));
	});
	try {
		await firstNotice;
	} catch (error) {
		signal?.removeEventListener("abort", onAbort);
		return {
			kind: "error",
			text: [watch.detail ?? (error instanceof Error ? error.message : String(error)), ...lines].join("\n")
		};
	}
	signal?.removeEventListener("abort", onAbort);
	if (watch.status === "ok") return {
		kind: "success",
		text: watch.detail ?? `Logged in to ${provider}.`
	};
	return {
		kind: "success",
		text: waitingText(watch)
	};
}
/**
* Execute `/oauth` against the live adapter.
* @param adapter - registered OAuth adapter.
* @param rawInput - text after the command name.
* @param signal - UI request cancellation; only aborts waiting for the first URL.
*/
async function handleOauthCommand(adapter, rawInput, signal) {
	const parts = rawInput.trim().split(/\s+/).filter(Boolean);
	const action = (parts[0] ?? "status").toLowerCase();
	const target = parts[1];
	if (action === "help" || action === "-h" || action === "--help") return {
		kind: "success",
		text: usageText(adapter.authPath())
	};
	if (action === "list") {
		const rows = ["OAuth providers owned by this adapter:"];
		for (const id of adapter.routeIds()) {
			const auth = await adapter.checkAuth(id);
			rows.push(`  ${id.padEnd(20)} ${auth === void 0 ? "not logged in" : `${auth.type}${auth.source ? ` (${auth.source})` : ""}`}`);
		}
		return {
			kind: "success",
			text: rows.join("\n")
		};
	}
	if (action === "status") {
		const rows = [`Auth file: ${adapter.authPath()}`, ""];
		for (const id of adapter.routeIds()) {
			const auth = await adapter.checkAuth(id);
			const watch = watches.get(id);
			const login = auth === void 0 ? "not logged in" : `ok (${auth.type}${auth.source ? `, ${auth.source}` : ""})`;
			const extra = watch === void 0 ? "" : watch.status === "waiting" ? " — browser login in progress" : watch.status === "error" ? ` — last login error: ${watch.detail ?? "failed"}` : " — last login finished";
			rows.push(`${id}: ${login}${extra}`);
		}
		return {
			kind: "success",
			text: rows.join("\n")
		};
	}
	if (action === "logout") {
		if (target === void 0) return {
			kind: "error",
			text: "Usage: /oauth logout <provider>"
		};
		try {
			watches.delete(target);
			await adapter.logout(target);
			return {
				kind: "success",
				text: `Logged out ${target}.`
			};
		} catch (error) {
			return {
				kind: "error",
				text: error instanceof Error ? error.message : String(error)
			};
		}
	}
	if (action === "login") {
		if (target === void 0) return {
			kind: "error",
			text: "Usage: /oauth login <provider>"
		};
		return startLogin(adapter, target, signal);
	}
	return {
		kind: "error",
		text: `Unknown action "${action}".\n\n${usageText(adapter.authPath())}`
	};
}
/** Environment override for the Harness home. */
const DSH_HOME_ENV = "DSH_HOME";
/**
* Expand `~` / `~/` prefixes.
* @param path - configured path that may begin with a tilde.
*/
function expandHomePath(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
	return path;
}
/**
* Resolve the Harness home.
* Precedence: explicit path, `$DSH_HOME`, then `~/.dsh`.
* @param configured - explicit override.
* @param env - environment mapping.
*/
function resolveDshHome(configured, env = process.env) {
	const fromEnv = env[DSH_HOME_ENV];
	const selected = configured ?? (fromEnv !== void 0 && fromEnv.trim().length > 0 ? fromEnv : join(homedir(), ".dsh"));
	return resolve(expandHomePath(selected));
}
/**
* Default path of the durable OAuth credential file.
* @param configuredHome - optional explicit Harness home.
*/
function defaultAuthPath(configuredHome) {
	return join(resolveDshHome(configuredHome), "pi-ai-oauth.json");
}
//#endregion
//#region src/store.ts
/**
* Durable pi-ai CredentialStore under the Harness home.
* One credential per provider id; writes are serialized per provider so a
* refresh and a concurrent login cannot clobber each other.
*/
/** File-backed credential store compatible with pi-ai Models OAuth refresh. */
var FileCredentialStore = class {
	path;
	chains = /* @__PURE__ */ new Map();
	cache;
	/**
	* @param path - absolute path of the JSON credential document.
	*/
	constructor(path = defaultAuthPath()) {
		this.path = path;
	}
	async load() {
		if (this.cache !== void 0) return this.cache;
		try {
			const raw = await readFile(this.path, "utf8");
			const parsed = JSON.parse(raw);
			this.cache = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
			this.cache = {};
		}
		return this.cache;
	}
	async save(next) {
		this.cache = next;
		await mkdir(dirname(this.path), { recursive: true });
		await writeFile(this.path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	}
	enqueue(providerId, task) {
		const run = (this.chains.get(providerId) ?? Promise.resolve()).catch(() => void 0).then(task);
		this.chains.set(providerId, run.then(() => void 0, () => void 0));
		return run;
	}
	async read(providerId) {
		return (await this.load())[providerId];
	}
	async list() {
		const file = await this.load();
		return Object.entries(file).map(([providerId, credential]) => ({
			providerId,
			type: credential.type
		}));
	}
	modify(providerId, fn) {
		return this.enqueue(providerId, async () => {
			const file = { ...await this.load() };
			const next = await fn(file[providerId]);
			if (next === void 0) return file[providerId];
			file[providerId] = next;
			await this.save(file);
			return next;
		});
	}
	delete(providerId) {
		return this.enqueue(providerId, async () => {
			const file = { ...await this.load() };
			if (file[providerId] === void 0) return;
			delete file[providerId];
			await this.save(file);
		});
	}
};
//#endregion
//#region src/runtime.ts
/**
* Apply the plugin to its Cordis context.
* @param ctx - scoped plugin context; registrations are effects.
* @param config - configuration resolved by Cordis from the exported schema.
*/
function apply(ctx, config) {
	const resolved = resolveConfig(config);
	const authPath = resolved.authPath ?? defaultAuthPath();
	const adapter = new OAuthPiAiAdapter({
		authPath,
		store: new FileCredentialStore(authPath),
		providers: resolved.providers
	});
	ctx.llm.registerAdapter(adapter.routeIds(), adapter);
	const commands = ctx.get("commands");
	if (commands !== void 0) commands.register({
		name: "oauth",
		description: "log in / out of OAuth LLM providers (xai, github-copilot, openai-codex, …)",
		input: { hint: "[status|list|login <provider>|logout <provider>]" },
		handler: (invocation) => handleOauthCommand(adapter, invocation.rawInput, invocation.signal)
	});
	ctx.logger.info(`[llm-oauth] registered OAuth providers: ${adapter.routeIds().join(", ")} (auth: ${authPath})`);
}
//#endregion
//#region src/index.ts
/**
* Standalone OAuth LLM plugin for DeepSeek Harness.
*
* Install with `dsh plugin --profile <name> add github:<user>/dsh-llm-oauth`.
* Do not add a default export: Cordis Loader unwraps `exports.default ?? exports`.
*
* @module dsh-llm-oauth
*/
/** Cordis plugin name; keep this stable after publishing. */
const name = "llm-oauth";
/** Services that must exist before the plugin is applied. */
const inject = ["llm"];
//#endregion
export { Config, DEFAULT_PROVIDERS, FileCredentialStore, OAuthPiAiAdapter, apply, defaultAuthPath, inject, name, oauthCatalogProviders, resolveConfig, resolveOAuthProviders };
