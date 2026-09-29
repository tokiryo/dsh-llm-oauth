window.__ModuleLoader__.load({
	id: "dsh-llm-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		const BASE = "/dsh-llm-oauth";
		function isStatusSnapshot(body) {
			return typeof body === "object" && body !== null && Array.isArray(body.providers);
		}
		async function request(path, init) {
			const response = await fetch(`${BASE}${path}`, {
				credentials: "same-origin",
				...init,
				headers: {
					accept: "application/json",
					...init?.body === void 0 ? {} : { "content-type": "application/json" },
					...init?.headers
				}
			});
			const text = await response.text();
			let body;
			try {
				body = text.length === 0 ? {} : JSON.parse(text);
			} catch {
				throw new Error(text || `HTTP ${String(response.status)}`);
			}
			if (!response.ok) {
				if (isStatusSnapshot(body)) return body;
				const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : `HTTP ${String(response.status)}`;
				throw new Error(message);
			}
			return body;
		}
		function fetchOauthStatus() {
			return request("/status");
		}
		function enableOauthProvider(provider) {
			return request("/enable", {
				method: "POST",
				body: JSON.stringify({ provider })
			});
		}
		function disableOauthProvider(provider) {
			return request("/disable", {
				method: "POST",
				body: JSON.stringify({ provider })
			});
		}
		function loginOauthProvider(provider) {
			return request("/login", {
				method: "POST",
				body: JSON.stringify({ provider })
			});
		}
		function logoutOauthProvider(provider) {
			return request("/logout", {
				method: "POST",
				body: JSON.stringify({ provider })
			});
		}
		async function fetchOauthPicker(provider) {
			const response = await fetch(`${BASE}/models?provider=${encodeURIComponent(provider)}`, {
				credentials: "same-origin",
				headers: { accept: "application/json" }
			});
			const text = await response.text();
			let body;
			try {
				body = text.length === 0 ? {} : JSON.parse(text);
			} catch {
				throw new Error(text || `HTTP ${String(response.status)}`);
			}
			if (!response.ok) {
				const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : `HTTP ${String(response.status)}`;
				throw new Error(message);
			}
			return body;
		}
		function saveOauthPicker(provider, patch) {
			return request("/models", {
				method: "POST",
				body: JSON.stringify({
					provider,
					...patch
				})
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/tokiryo/Documents/deepseek-harness/default-workspace/dsh-llm-oauth/src/client/OauthSection.module.css.mjs
		const css = ".k0G0HW_section{flex-direction:column;gap:12px;max-width:720px;padding:4px 0 24px;display:flex}.k0G0HW_title{color:var(--dsw-alias-text-primary,inherit);margin:0;font-size:18px;font-weight:600}.k0G0HW_intro{color:var(--dsw-alias-text-secondary,#666);margin:0;font-size:13px;line-height:1.5}.k0G0HW_meta{color:var(--dsw-alias-text-tertiary,#888);word-break:break-all;margin:0;font-size:12px}.k0G0HW_toolbar{flex-wrap:wrap;gap:8px;display:flex}.k0G0HW_rows{flex-direction:column;gap:10px;margin:0;padding:0;list-style:none;display:flex}.k0G0HW_rowCard{border:1px solid var(--dsw-alias-border-l2,#e5e5e5);background:var(--dsw-alias-bg-elevated,#fff);border-radius:10px;flex-direction:column;gap:10px;padding:12px 14px;display:flex}.k0G0HW_rowHead{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.k0G0HW_rowIdentity{flex-direction:column;gap:4px;min-width:0;display:flex}.k0G0HW_rowName{font-size:14px;font-weight:600}.k0G0HW_rowId{color:var(--dsw-alias-text-tertiary,#888);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}.k0G0HW_badges{flex-wrap:wrap;gap:6px;display:flex}.k0G0HW_badge{border:1px solid #0000;border-radius:999px;align-items:center;padding:2px 8px;font-size:11px;line-height:1.4;display:inline-flex}.k0G0HW_badgeOn{color:#15803d;background:#16a34a1f;border-color:#16a34a47}.k0G0HW_badgeOff{color:#475569;background:#64748b1f;border-color:#64748b3d}.k0G0HW_badgeOk{color:#1d4ed8;background:#2563eb1f;border-color:#2563eb47}.k0G0HW_badgeMissing{color:#b91c1c;background:#dc26261a;border-color:#dc26263d}.k0G0HW_badgeWarn{color:#b45309;background:#d977061f;border-color:#d9770647}.k0G0HW_rowActions{flex-wrap:wrap;gap:8px;display:flex}.k0G0HW_button,.k0G0HW_secondaryButton,.k0G0HW_dangerButton{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d4d4d4);background:var(--dsw-alias-bg-elevated,#fff);color:inherit;cursor:pointer;border-radius:8px;padding:6px 10px;font-size:13px}.k0G0HW_button:disabled,.k0G0HW_secondaryButton:disabled,.k0G0HW_dangerButton:disabled{opacity:.55;cursor:not-allowed}.k0G0HW_button{background:var(--dsw-alias-interactive-bg,#111);color:var(--dsw-alias-interactive-fg,#fff);border-color:#0000}.k0G0HW_dangerButton{color:#b91c1c;border-color:#dc262659}.k0G0HW_notice,.k0G0HW_error,.k0G0HW_command{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px;line-height:1.45}.k0G0HW_notice{color:var(--dsw-alias-text-secondary,#666)}.k0G0HW_error{color:#b91c1c}.k0G0HW_command{color:var(--dsw-alias-text-secondary,#555);background:var(--dsw-alias-bg-subtle,#f6f6f6);border-radius:8px;padding:8px 10px}.k0G0HW_codeBox{background:#2563eb14;border:1px solid #2563eb47;border-radius:10px;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 12px;display:flex}.k0G0HW_codeLabel{color:var(--dsw-alias-text-secondary,#555);font-size:12px}.k0G0HW_codeValue{letter-spacing:.06em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;font-weight:700}.k0G0HW_buttonLink{background:var(--dsw-alias-interactive-bg,#111);color:var(--dsw-alias-interactive-fg,#fff);border:1px solid #0000;border-radius:8px;align-items:center;padding:6px 12px;font-size:13px;text-decoration:none;display:inline-flex}.k0G0HW_buttonLink:hover{opacity:.92}.k0G0HW_picker{border-top:1px solid var(--dsw-alias-border-l2,#e5e5e5);flex-direction:column;gap:8px;padding-top:8px;display:flex}.k0G0HW_pickerHead{justify-content:space-between;align-items:baseline;gap:8px;display:flex}.k0G0HW_pickerTitle{font-size:13px}.k0G0HW_modelList{flex-direction:column;gap:6px;max-height:280px;margin:0;padding:0;list-style:none;display:flex;overflow:auto}.k0G0HW_modelRow{grid-template-columns:minmax(0,1fr) minmax(120px,180px);align-items:center;gap:8px;display:grid}.k0G0HW_modelLabel{align-items:flex-start;gap:8px;min-width:0;font-size:13px;display:flex}.k0G0HW_modelLabel span{flex-direction:column;min-width:0;display:flex}.k0G0HW_modelRename{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d4d4d4);background:var(--dsw-alias-bg-elevated,#fff);width:100%;color:inherit;border-radius:6px;padding:4px 8px;font-size:12px}";
		const tagId = "dsh-llm-oauth/OauthSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-llm-oauth";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var OauthSection_module_css_default = {
			"rows": "k0G0HW_rows",
			"toolbar": "k0G0HW_toolbar",
			"badgeMissing": "k0G0HW_badgeMissing",
			"button": "k0G0HW_button",
			"pickerHead": "k0G0HW_pickerHead",
			"badge": "k0G0HW_badge",
			"dangerButton": "k0G0HW_dangerButton",
			"modelLabel": "k0G0HW_modelLabel",
			"pickerTitle": "k0G0HW_pickerTitle",
			"rowIdentity": "k0G0HW_rowIdentity",
			"rowName": "k0G0HW_rowName",
			"badgeOn": "k0G0HW_badgeOn",
			"buttonLink": "k0G0HW_buttonLink",
			"title": "k0G0HW_title",
			"secondaryButton": "k0G0HW_secondaryButton",
			"rowActions": "k0G0HW_rowActions",
			"error": "k0G0HW_error",
			"meta": "k0G0HW_meta",
			"intro": "k0G0HW_intro",
			"picker": "k0G0HW_picker",
			"modelRename": "k0G0HW_modelRename",
			"badgeOk": "k0G0HW_badgeOk",
			"rowCard": "k0G0HW_rowCard",
			"section": "k0G0HW_section",
			"rowHead": "k0G0HW_rowHead",
			"rowId": "k0G0HW_rowId",
			"notice": "k0G0HW_notice",
			"modelRow": "k0G0HW_modelRow",
			"badgeWarn": "k0G0HW_badgeWarn",
			"badgeOff": "k0G0HW_badgeOff",
			"command": "k0G0HW_command",
			"modelList": "k0G0HW_modelList",
			"badges": "k0G0HW_badges",
			"codeBox": "k0G0HW_codeBox",
			"codeLabel": "k0G0HW_codeLabel",
			"codeValue": "k0G0HW_codeValue"
		};
		//#endregion
		//#region src/client/OauthSection.tsx
		/**
		* Settings → OAuth / 订阅: enable toggles + login status.
		* Talks to the host plugin over `/dsh-llm-oauth/*` (not Typert RPC).
		* On login, opens the authorization URL in a new window when the host returns one.
		*/
		/** Try to open the OAuth URL; returns false if the browser blocked the popup. */
		function tryOpenAuthWindow(url) {
			try {
				return window.open(url, "_blank", "noopener,noreferrer") !== null;
			} catch {
				return false;
			}
		}
		function extractHttpUrl(text) {
			if (text === void 0) return void 0;
			return text.match(/https?:\/\/[^\s]+/i)?.[0];
		}
		function OauthSection(props) {
			const { t } = props;
			if (t === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loaded, { t });
		}
		function Loaded({ t }) {
			const [status, setStatus] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(void 0);
			const [command, setCommand] = (0, react.useState)(void 0);
			const [popupBlocked, setPopupBlocked] = (0, react.useState)(false);
			const load = (0, react.useCallback)(async () => {
				setBusy({ action: "refresh" });
				setError(void 0);
				try {
					const next = await fetchOauthStatus();
					setStatus(next);
					setCommand(void 0);
					setPopupBlocked(false);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(void 0);
				}
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const applyLoginResult = (next) => {
				setStatus(next);
				const cmd = next.command;
				setCommand(cmd);
				if (cmd?.kind === "error" && cmd.text) setError(cmd.text);
				const url = cmd?.openUrl ?? extractHttpUrl(cmd?.text);
				if (url !== void 0 && cmd?.kind !== "error") {
					const opened = tryOpenAuthWindow(url);
					setPopupBlocked(!opened);
				} else setPopupBlocked(false);
			};
			const run = async (provider, action, fn) => {
				setBusy({
					id: provider,
					action
				});
				setError(void 0);
				if (action !== "login") {
					setCommand(void 0);
					setPopupBlocked(false);
				}
				try {
					const next = await fn(provider);
					if (action === "login") applyLoginResult(next);
					else {
						setStatus(next);
						setCommand(void 0);
						setPopupBlocked(false);
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(void 0);
				}
			};
			if (status === void 0 && error === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: OauthSection_module_css_default.section,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					className: OauthSection_module_css_default.title,
					children: t("title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: OauthSection_module_css_default.notice,
					children: t("loading")
				})]
			});
			if (status === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: OauthSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: OauthSection_module_css_default.title,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.error,
						children: `${t("loadFailed")}: ${error ?? ""}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OauthSection_module_css_default.toolbar,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: OauthSection_module_css_default.secondaryButton,
							onClick: () => {
								load();
							},
							children: t("retry")
						})
					})
				]
			});
			const globalBusy = busy?.action === "refresh";
			const authUrl = command?.openUrl ?? extractHttpUrl(command?.text);
			const userCode = command?.userCode;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: OauthSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: OauthSection_module_css_default.title,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.intro,
						children: t("intro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.meta,
						children: `${t("authFile")}: ${status.authPath}`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OauthSection_module_css_default.toolbar,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: OauthSection_module_css_default.secondaryButton,
							disabled: globalBusy,
							onClick: () => {
								load();
							},
							children: globalBusy ? t("busy") : t("refresh")
						})
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.error,
						children: error
					}) : null,
					popupBlocked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.error,
						children: t("popupBlocked")
					}) : null,
					userCode !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: OauthSection_module_css_default.codeBox,
						role: "status",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: OauthSection_module_css_default.codeLabel,
								children: t("userCodeLabel")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								className: OauthSection_module_css_default.codeValue,
								children: userCode
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: OauthSection_module_css_default.secondaryButton,
								onClick: () => {
									navigator.clipboard?.writeText(userCode);
								},
								children: t("copyCode")
							})
						]
					}) : null,
					authUrl !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OauthSection_module_css_default.toolbar,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							className: OauthSection_module_css_default.buttonLink,
							href: authUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							onClick: () => {
								setPopupBlocked(false);
							},
							children: t("openAuth")
						})
					}) : null,
					command?.text !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.command,
						role: "status",
						children: command.text
					}) : null,
					status.providers.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.notice,
						children: t("empty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: OauthSection_module_css_default.rows,
						children: status.providers.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderRow, {
							row,
							t,
							busy,
							onEnable: () => {
								run(row.id, "enable", enableOauthProvider);
							},
							onDisable: () => {
								run(row.id, "disable", disableOauthProvider);
							},
							onLogin: () => {
								run(row.id, "login", loginOauthProvider);
							},
							onLogout: () => {
								run(row.id, "logout", logoutOauthProvider);
							}
						}, row.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.notice,
						children: t("tipEnable")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.notice,
						children: t("tipLogin")
					})
				]
			});
		}
		function ProviderRow(props) {
			const { row, t, busy, onEnable, onDisable, onLogin, onLogout } = props;
			const rowBusy = busy?.id === row.id;
			const disabled = busy !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: OauthSection_module_css_default.rowCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OauthSection_module_css_default.rowHead,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: OauthSection_module_css_default.rowIdentity,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OauthSection_module_css_default.rowName,
									children: row.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OauthSection_module_css_default.rowId,
									children: row.id
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: OauthSection_module_css_default.badges,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${OauthSection_module_css_default.badge} ${row.enabled ? OauthSection_module_css_default.badgeOn : OauthSection_module_css_default.badgeOff}`,
											children: row.enabled ? t("enabled") : t("disabled")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${OauthSection_module_css_default.badge} ${row.loggedIn ? OauthSection_module_css_default.badgeOk : OauthSection_module_css_default.badgeMissing}`,
											children: row.loggedIn ? `${t("loggedIn")}${row.authType ? ` (${row.authType})` : ""}` : t("loggedOut")
										}),
										row.loginStatus === "waiting" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${OauthSection_module_css_default.badge} ${OauthSection_module_css_default.badgeWarn}`,
											children: t("loginWaiting")
										}) : null,
										row.loginStatus === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${OauthSection_module_css_default.badge} ${OauthSection_module_css_default.badgeMissing}`,
											children: t("loginError")
										}) : null
									]
								}),
								row.id === "openrouter" && !row.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: OauthSection_module_css_default.notice,
									children: t("openrouterWarn")
								}) : null,
								row.loginDetail !== void 0 && row.loginStatus === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: OauthSection_module_css_default.error,
									children: row.loginDetail
								}) : null
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: OauthSection_module_css_default.rowActions,
						children: [row.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: OauthSection_module_css_default.secondaryButton,
							disabled,
							onClick: onDisable,
							children: rowBusy && busy?.action === "disable" ? t("busy") : t("disable")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: OauthSection_module_css_default.button,
							disabled,
							onClick: onEnable,
							children: rowBusy && busy?.action === "enable" ? t("busy") : t("enable")
						}), row.loggedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: OauthSection_module_css_default.dangerButton,
							disabled,
							onClick: onLogout,
							children: rowBusy && busy?.action === "logout" ? t("busy") : t("logout")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: OauthSection_module_css_default.secondaryButton,
							disabled,
							onClick: onLogin,
							children: rowBusy && busy?.action === "login" ? t("busy") : t("login")
						})]
					}),
					row.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPicker, {
						provider: row.id,
						t,
						disabled
					}) : null
				]
			});
		}
		function ModelPicker(props) {
			const { provider, t, disabled } = props;
			const [picker, setPicker] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [saving, setSaving] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [labels, setLabels] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				let cancelled = false;
				setError(void 0);
				fetchOauthPicker(provider).then((next) => {
					if (cancelled) return;
					setPicker(next);
					setDraft(new Set(next.models.filter((model) => model.listed).map((model) => model.id)));
					const nextLabels = {};
					for (const model of next.models) if (model.label !== model.name) nextLabels[model.id] = model.label;
					setLabels(nextLabels);
				}).catch((err) => {
					if (!cancelled) setError(err instanceof Error ? err.message : String(err));
				});
				return () => {
					cancelled = true;
				};
			}, [provider]);
			const persist = async (models, modelNames) => {
				setSaving(true);
				setError(void 0);
				try {
					const snapshot = (await saveOauthPicker(provider, {
						models,
						...modelNames === void 0 ? {} : { modelNames }
					})).picker ?? await fetchOauthPicker(provider);
					setPicker(snapshot);
					setDraft(new Set(snapshot.models.filter((model) => model.listed).map((model) => model.id)));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};
			const toggle = (id, listed) => {
				const next = new Set(draft);
				if (listed) next.add(id);
				else next.delete(id);
				setDraft(next);
			};
			if (error !== void 0 && picker === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: OauthSection_module_css_default.error,
				children: `${t("modelsLoadFailed")}: ${error}`
			});
			if (picker === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: OauthSection_module_css_default.notice,
				children: t("loading")
			});
			if (picker.models.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: OauthSection_module_css_default.notice,
				children: t("modelsEmpty")
			});
			const listedCount = draft.size;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: OauthSection_module_css_default.picker,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: OauthSection_module_css_default.pickerHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
							className: OauthSection_module_css_default.pickerTitle,
							children: t("modelsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: OauthSection_module_css_default.meta,
							children: `${String(listedCount)} / ${String(picker.models.length)} ${t("modelsListed")}`
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.notice,
						children: t("modelsIntro")
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: OauthSection_module_css_default.error,
						children: error
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: OauthSection_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: OauthSection_module_css_default.secondaryButton,
								disabled: disabled || saving,
								onClick: () => {
									persist(null, Object.keys(labels).length === 0 ? null : labels);
								},
								children: t("modelsAll")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: OauthSection_module_css_default.secondaryButton,
								disabled: disabled || saving,
								onClick: () => {
									persist([], Object.keys(labels).length === 0 ? null : labels);
								},
								children: t("modelsNone")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: OauthSection_module_css_default.button,
								disabled: disabled || saving,
								onClick: () => {
									const names = Object.fromEntries(Object.entries(labels).filter(([, label]) => label.trim().length > 0));
									persist([...draft], Object.keys(names).length === 0 ? null : names);
								},
								children: saving ? t("busy") : t("modelsSave")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: OauthSection_module_css_default.modelList,
						children: picker.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: OauthSection_module_css_default.modelRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: OauthSection_module_css_default.modelLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: draft.has(model.id),
									disabled: disabled || saving,
									onChange: (event) => {
										toggle(model.id, event.target.checked);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OauthSection_module_css_default.rowName,
									children: model.label
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OauthSection_module_css_default.rowId,
									children: model.id
								})] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: OauthSection_module_css_default.modelRename,
								type: "text",
								"aria-label": t("modelsRename"),
								placeholder: model.name,
								value: labels[model.id] ?? "",
								disabled: disabled || saving,
								onChange: (event) => {
									const value = event.target.value;
									setLabels((current) => {
										const next = { ...current };
										if (value.trim().length === 0) delete next[model.id];
										else next[model.id] = value;
										return next;
									});
								}
							})]
						}, model.id))
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** OAuth settings section copy (standalone Settings nav entry). */
		const zh = {
			nav: "OAuth / 订阅",
			title: "OAuth / 订阅套餐",
			intro: "在此开启订阅提供方、登录或退出。只有「已开启」的提供方会出现在模型选择器；API Key 仍在设置 → 模型。也可在聊天中使用 /oauth 管理订阅提供方。",
			authFile: "凭据文件",
			refresh: "刷新状态",
			loading: "加载中…",
			loadFailed: "无法加载 OAuth 状态",
			retry: "重试",
			empty: "当前 catalog 为空。",
			enabled: "已开启",
			disabled: "未开启",
			loggedIn: "已登录",
			loggedOut: "未登录",
			loginWaiting: "浏览器登录进行中…",
			loginError: "最近一次登录失败",
			enable: "开启",
			disable: "关闭",
			login: "登录",
			logout: "退出登录",
			busy: "处理中…",
			tipEnable: "开启后，该提供方会出现在模型选择器（需已登录才能对话）。",
			tipLogin: "登录会写入订阅 token，并自动开启该提供方。浏览器会尽量自动打开授权页；若被拦截请点下方链接。",
			openAuth: "打开授权页",
			userCodeLabel: "设备码",
			copyCode: "复制设备码",
			popupBlocked: "浏览器拦截了弹窗，请点「打开授权页」或允许本站弹窗后重试登录。",
			openrouterWarn: "OpenRouter catalog 很大；确认需要后再开启。",
			modelsTitle: "模型选择器",
			modelsIntro: "勾选会出现在聊天模型选择器中的模型。不勾选则隐藏；清空选择后该提供方仍保持开启但列表为空。",
			modelsAll: "显示全部目录模型",
			modelsNone: "全部隐藏",
			modelsSave: "保存选择",
			modelsLoadFailed: "无法加载模型目录",
			modelsEmpty: "该提供方目录为空。",
			modelsListed: "已显示",
			modelsHidden: "已隐藏",
			modelsRename: "显示名"
		};
		const en = {
			nav: "OAuth / Subscriptions",
			title: "OAuth / subscription plans",
			intro: "Enable subscription providers and sign in or out here. Only enabled providers appear in the model picker; API keys stay under Settings → Models. You can also manage subscription providers with /oauth in chat.",
			authFile: "Credential file",
			refresh: "Refresh",
			loading: "Loading…",
			loadFailed: "Could not load OAuth status",
			retry: "Retry",
			empty: "Catalog is empty.",
			enabled: "Enabled",
			disabled: "Disabled",
			loggedIn: "Signed in",
			loggedOut: "Not signed in",
			loginWaiting: "Browser login in progress…",
			loginError: "Last login failed",
			enable: "Enable",
			disable: "Disable",
			login: "Sign in",
			logout: "Sign out",
			busy: "Working…",
			tipEnable: "When enabled, this provider appears in the model picker (sign-in still required to chat).",
			tipLogin: "Sign-in stores the subscription token and auto-enables the provider. The auth page opens automatically when possible; use the link if a popup was blocked.",
			openAuth: "Open authorization page",
			userCodeLabel: "Device code",
			copyCode: "Copy code",
			popupBlocked: "The browser blocked the popup. Click “Open authorization page” or allow popups for this site and try again.",
			openrouterWarn: "OpenRouter’s catalog is large; enable only if you need it.",
			modelsTitle: "Model picker",
			modelsIntro: "Tick models that should appear in the chat picker. Unticked models stay hidden. Clearing every tick keeps the provider enabled but lists nothing.",
			modelsAll: "Show full catalog",
			modelsNone: "Hide all",
			modelsSave: "Save selection",
			modelsLoadFailed: "Could not load model catalog",
			modelsEmpty: "This provider’s catalog is empty.",
			modelsListed: "Shown",
			modelsHidden: "Hidden",
			modelsRename: "Label"
		};
		//#endregion
		//#region src/client/index.ts
		const NS = "settings.oauth";
		/** Required client services. */
		const inject = ["slots", "locale"];
		/**
		* Register a standalone OAuth settings section next to Models / Plugins.
		* @param ctx - browser Cordis context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-llm-oauth: dictionaries");
			const t = ctx.locale.bind(NS);
			const injected = () => ({ t });
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "oauth",
				order: 12,
				label: () => t("nav"),
				inject: injected
			}, OauthSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map