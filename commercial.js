(function (global) {
    'use strict';

    const CONFIG = global.OnvordCommercialConfig || {};

    // Core hosted service client contract. The legacy `commercial*` identifiers are
    // retained for compatibility with existing browser storage and API clients.
    // 0. POST /api/extension/bootstrap
    //    -> { session_token, entitlement, user }
    // 1. GET  /api/extension/entitlement
    //    -> { has_access, access_source, trial, subscription, checkout_url, portal_url, user }
    // 2. POST /api/extension/trial/start
    //    -> same entitlement payload after trial activation
    // 3. POST /api/extension/speech-session
    //    -> { provider: "aliyun", token, expires_at, region, model, language }
    // The extension never ships a permanent vendor API key in the package.

    const DAY_MS = 24 * 60 * 60 * 1000;
    const CACHE_TTL_MS = 60 * 1000;
    const RECORDING_ACCESS_TTL_MS = 15 * 1000;
    const BOOTSTRAP_RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
    const DEFAULT_API_BASE = normalizeUrl(CONFIG.apiBaseUrl || '');
    const DEFAULT_CHECKOUT_URL = normalizeUrl(CONFIG.checkoutUrl || '');
    const DEFAULT_PORTAL_URL = normalizeUrl(CONFIG.portalUrl || '');
    const AUTO_BOOTSTRAP = CONFIG.autoBootstrap !== false;
    const BOOTSTRAP_PATH = '/api/extension/bootstrap';
    const ENTITLEMENT_PATH = '/api/extension/entitlement';
    const START_TRIAL_PATH = '/api/extension/trial/start';
    const SPEECH_SESSION_PATH = '/api/extension/speech-session';
    const ACCOUNT_PATH = '/api/extension/account';
    const ACCOUNT_GOOGLE_PREPARE_PATH = '/api/extension/account/google/prepare';
    const ACCOUNT_GOOGLE_START_PATH = '/api/extension/account/google/start';
    const ACCOUNT_SUPABASE_LINK_PATH = '/api/extension/account/supabase/link';
    const BILLING_CHECKOUT_PATH = '/api/extension/billing/checkout';
    const BILLING_PORTAL_PATH = '/api/extension/billing/portal';

    const PROVIDER = {
        ALIYUN: 'aliyun'
    };

    const STORAGE_KEYS = [
        'commercialDeviceId',
        'commercialApiBaseUrl',
        'commercialSessionToken',
        'commercialCheckoutUrl',
        'commercialPortalUrl',
        'commercialLanguage',
        'commercialCachedEntitlement',
        'commercialCachedEntitlementAt',
        'commercialAccessValidatedAt',
        'commercialCachedUserEmail',
        'commercialLastSpeechProvider'
    ];

    const DEFAULTS = {
        commercialDeviceId: '',
        commercialApiBaseUrl: DEFAULT_API_BASE,
        commercialSessionToken: '',
        commercialCheckoutUrl: DEFAULT_CHECKOUT_URL,
        commercialPortalUrl: DEFAULT_PORTAL_URL,
        commercialLanguage: 'zh-CN',
        commercialCachedEntitlement: null,
        commercialCachedEntitlementAt: 0,
        commercialAccessValidatedAt: 0,
        commercialCachedUserEmail: '',
        commercialLastSpeechProvider: PROVIDER.ALIYUN
    };

    let bootstrapInFlight = null;
    let bootstrapRateLimitedUntil = 0;

    function normalizeUrl(url) {
        const normalized = String(url || '').trim().replace(/\/+$/, '');
        return /^https?:\/\//i.test(normalized) ? normalized : '';
    }

    function normalizeToken(token) {
        return String(token || '').trim();
    }

    function normalizeDeviceId(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 128);
    }

    function normalizeProvider(provider) {
        return PROVIDER.ALIYUN;
    }

    function normalizeLanguage(language) {
        return language === 'en-US' ? 'en-US' : 'zh-CN';
    }

    function normalizeTimestamp(value) {
        const ts = Number(value || 0);
        return Number.isFinite(ts) && ts > 0 ? ts : 0;
    }

    function normalizeTrial(raw) {
        const startAt = normalizeTimestamp(raw?.start_at || raw?.startAt);
        const endAt = normalizeTimestamp(raw?.end_at || raw?.endAt);
        const daysLeftRaw = Number(raw?.days_left ?? raw?.daysLeft ?? 0);
        const daysLeft = Number.isFinite(daysLeftRaw) ? Math.max(0, Math.floor(daysLeftRaw)) : 0;
        const active = Boolean(raw?.active) || (endAt > Date.now());
        return {
            started: Boolean(startAt),
            active,
            expired: Boolean(startAt) && !active,
            startAt,
            endAt,
            daysLeft
        };
    }

    function normalizeSubscription(raw) {
        const endAt = normalizeTimestamp(raw?.end_at || raw?.endAt);
        const status = String(raw?.status || '').trim() || 'inactive';
        const active = Boolean(raw?.active) || status === 'active' || status === 'scheduled_cancel';
        return {
            active,
            status,
            endAt
        };
    }

    function normalizeAccount(raw, settings) {
        const email = String(raw?.email || settings?.commercialCachedUserEmail || '').trim();
        return {
            id: String(raw?.id || '').trim(),
            email,
            displayName: String(raw?.display_name || raw?.displayName || '').trim(),
            avatarUrl: normalizeUrl(raw?.avatar_url || raw?.avatarUrl || ''),
            isAnonymous: Boolean(raw?.is_anonymous ?? raw?.isAnonymous)
                || (email ? email.endsWith('@devices.onvord.local') : false),
            authProvider: String(raw?.auth_provider || raw?.authProvider || '').trim(),
            linkedGoogle: Boolean(raw?.linked_google ?? raw?.linkedGoogle)
        };
    }

    function isLinkedAccount(account) {
        if (!account) return false;
        return Boolean(account.linkedGoogle) && !Boolean(account.isAnonymous);
    }

    function normalizeBilling(raw, settings, subscription) {
        const provider = String(raw?.provider || raw?.billing_provider || '').trim();
        const canCheckout = Boolean(raw?.can_checkout ?? raw?.canCheckout)
            || Boolean(settings.commercialCheckoutUrl);
        const canPortal = Boolean(raw?.can_portal ?? raw?.canPortal)
            || Boolean(settings.commercialPortalUrl)
            || Boolean(subscription?.active);
        return {
            provider,
            canCheckout,
            canPortal
        };
    }

    function mergeSettings(raw = {}) {
        const merged = { ...DEFAULTS, ...(raw || {}) };
        merged.commercialDeviceId = normalizeDeviceId(merged.commercialDeviceId);
        merged.commercialApiBaseUrl = normalizeUrl(merged.commercialApiBaseUrl);
        merged.commercialSessionToken = normalizeToken(merged.commercialSessionToken);
        merged.commercialCheckoutUrl = normalizeUrl(merged.commercialCheckoutUrl);
        merged.commercialPortalUrl = normalizeUrl(merged.commercialPortalUrl);
        merged.commercialLanguage = normalizeLanguage(merged.commercialLanguage);
        merged.commercialCachedEntitlementAt = normalizeTimestamp(merged.commercialCachedEntitlementAt);
        merged.commercialAccessValidatedAt = normalizeTimestamp(merged.commercialAccessValidatedAt);
        merged.commercialCachedUserEmail = String(merged.commercialCachedUserEmail || '').trim();
        merged.commercialLastSpeechProvider = normalizeProvider(merged.commercialLastSpeechProvider);
        return merged;
    }

    function buildHeaders(settings) {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.commercialSessionToken}`
        };
    }

    function hasBackendConfig(settings) {
        return Boolean(settings?.commercialApiBaseUrl);
    }

    function hasSessionToken(settings) {
        return Boolean(settings?.commercialSessionToken);
    }

    function buildApiUrl(settings, path) {
        return `${settings.commercialApiBaseUrl}${path}`;
    }

    function buildBootstrapPayload(settings) {
        const payload = {
            device_id: settings.commercialDeviceId || createDeviceId(),
            language: settings.commercialLanguage,
            client: 'onvord-commercial-extension'
        };

        try {
            payload.extension_version = chrome.runtime?.getManifest?.().version || '';
        } catch {
            payload.extension_version = '';
        }

        return payload;
    }

    function createDeviceId() {
        try {
            return normalizeDeviceId(crypto.randomUUID());
        } catch {
            const random = Math.random().toString(36).slice(2, 12);
            return normalizeDeviceId(`dev_${Date.now().toString(36)}_${random}`);
        }
    }

    function buildLocalEntitlement(settings, reason) {
        return {
            ok: false,
            reason,
            authenticated: Boolean(settings.commercialSessionToken),
            hasAccess: false,
            accessSource: 'none',
            userEmail: settings.commercialCachedUserEmail || '',
            trial: {
                started: false,
                active: false,
                expired: false,
                startAt: 0,
                endAt: 0,
                daysLeft: 0
            },
            subscription: {
                active: false,
                status: 'inactive',
                endAt: 0
            },
            checkoutUrl: settings.commercialCheckoutUrl,
            portalUrl: settings.commercialPortalUrl,
            billing: {
                provider: '',
                canCheckout: Boolean(settings.commercialCheckoutUrl),
                canPortal: Boolean(settings.commercialPortalUrl)
            }
        };
    }

    function normalizeEntitlement(raw, settings, ok = true, reason = 'ok') {
        const trial = normalizeTrial(raw?.trial);
        const subscription = normalizeSubscription(raw?.subscription);
        const billing = normalizeBilling(raw?.billing, settings, subscription);
        const accessSource = String(raw?.access_source || raw?.accessSource || '').trim() || 'none';
        const hasAccess = Boolean(raw?.has_access ?? raw?.hasAccess)
            || accessSource === 'trial-available'
            || trial.active
            || subscription.active;

        return {
            ok,
            reason,
            authenticated: raw?.authenticated !== false,
            hasAccess,
            accessSource,
            userEmail: String(raw?.user?.email || raw?.email || settings.commercialCachedUserEmail || '').trim(),
            userDisplayName: String(raw?.user?.display_name || raw?.user?.displayName || '').trim(),
            userAvatarUrl: normalizeUrl(raw?.user?.avatar_url || raw?.user?.avatarUrl || ''),
            userIsAnonymous: Boolean(raw?.user?.is_anonymous ?? raw?.user?.isAnonymous),
            userAuthProvider: String(raw?.user?.auth_provider || raw?.user?.authProvider || '').trim(),
            trial,
            subscription,
            checkoutUrl: normalizeUrl(raw?.checkout_url || raw?.checkoutUrl || settings.commercialCheckoutUrl),
            portalUrl: normalizeUrl(raw?.portal_url || raw?.portalUrl || settings.commercialPortalUrl),
            billing
        };
    }

    async function readSettings() {
        const raw = await new Promise((resolve) => chrome.storage.local.get(STORAGE_KEYS, resolve));
        return mergeSettings(raw);
    }

    async function writeEntitlementCache(entitlement) {
        const patch = {
            commercialCachedEntitlement: entitlement,
            commercialCachedEntitlementAt: Date.now(),
            commercialCachedUserEmail: entitlement.userEmail || ''
        };
        if (entitlement.checkoutUrl) patch.commercialCheckoutUrl = entitlement.checkoutUrl;
        if (entitlement.portalUrl) patch.commercialPortalUrl = entitlement.portalUrl;
        await chrome.storage.local.set(patch).catch(() => {});
    }

    function getCachedEntitlement(settings) {
        const cached = settings.commercialCachedEntitlement;
        const cachedAt = settings.commercialCachedEntitlementAt;
        if (!cached || !cachedAt) return null;
        if ((Date.now() - cachedAt) > CACHE_TTL_MS) return null;
        return normalizeEntitlement(cached, settings, true, 'cached');
    }

    async function writeSessionPatch(patch = {}) {
        const nextPatch = {};
        if (patch.commercialDeviceId) nextPatch.commercialDeviceId = normalizeDeviceId(patch.commercialDeviceId);
        if (patch.commercialSessionToken) nextPatch.commercialSessionToken = normalizeToken(patch.commercialSessionToken);
        if (patch.commercialCheckoutUrl) nextPatch.commercialCheckoutUrl = normalizeUrl(patch.commercialCheckoutUrl);
        if (patch.commercialPortalUrl) nextPatch.commercialPortalUrl = normalizeUrl(patch.commercialPortalUrl);
        if (!Object.keys(nextPatch).length) return;
        await chrome.storage.local.set(nextPatch).catch(() => {});
    }

    async function bootstrapSession(rawSettings, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { force = false } = options;

        if (!hasBackendConfig(settings)) {
            return { ok: false, reason: 'api-base-missing', settings };
        }

        if (hasSessionToken(settings) && !force) {
            return { ok: true, reason: 'existing-session', settings };
        }

        if (!AUTO_BOOTSTRAP) {
            return { ok: false, reason: 'session-missing', settings };
        }

        if (!force && bootstrapRateLimitedUntil > Date.now()) {
            return { ok: false, reason: 'bootstrap-429', settings };
        }

        if (!settings.commercialDeviceId) {
            const commercialDeviceId = createDeviceId();
            await writeSessionPatch({ commercialDeviceId });
            settings = mergeSettings({
                ...settings,
                commercialDeviceId
            });
        }

        const inFlightKey = `${settings.commercialApiBaseUrl}|${settings.commercialDeviceId}|${force ? 'force' : 'normal'}`;
        if (bootstrapInFlight?.key === inFlightKey) {
            return await bootstrapInFlight.promise;
        }

        const bootstrapPromise = (async () => {
            const latestSettings = await readSettings();
            if (!force && hasSessionToken(latestSettings)) {
                return { ok: true, reason: 'existing-session', settings: latestSettings };
            }

            const requestSettings = mergeSettings({
                ...latestSettings,
                ...settings,
                commercialDeviceId: settings.commercialDeviceId || latestSettings.commercialDeviceId
            });
            const payload = buildBootstrapPayload(requestSettings);

            try {
                const response = await fetch(buildApiUrl(requestSettings, BOOTSTRAP_PATH), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    if (response.status === 429) {
                        bootstrapRateLimitedUntil = Date.now() + BOOTSTRAP_RATE_LIMIT_COOLDOWN_MS;
                    }
                    return { ok: false, reason: `bootstrap-${response.status}`, settings: requestSettings };
                }

                bootstrapRateLimitedUntil = 0;

                const body = await response.json();
                const sessionToken = normalizeToken(body?.session_token || '');
                await writeSessionPatch({
                    commercialDeviceId: payload.device_id
                });

                if (!sessionToken) {
                    return { ok: false, reason: 'bootstrap-missing-session', settings: requestSettings };
                }

                const nextSettings = mergeSettings({
                    ...requestSettings,
                    commercialDeviceId: payload.device_id,
                    commercialSessionToken: sessionToken,
                    commercialCheckoutUrl: body?.entitlement?.checkout_url || body?.checkout_url || requestSettings.commercialCheckoutUrl,
                    commercialPortalUrl: body?.entitlement?.portal_url || body?.portal_url || requestSettings.commercialPortalUrl
                });

                await writeSessionPatch(nextSettings);

                if (body?.entitlement) {
                    const entitlement = normalizeEntitlement(body.entitlement, nextSettings, true, 'bootstrap');
                    await writeEntitlementCache(entitlement);
                    return {
                        ok: true,
                        reason: 'bootstrap',
                        settings: nextSettings,
                        entitlement
                    };
                }

                return {
                    ok: true,
                    reason: 'bootstrap',
                    settings: nextSettings
                };
            } catch {
                return { ok: false, reason: 'bootstrap-network', settings: requestSettings };
            }
        })();

        bootstrapInFlight = {
            key: inFlightKey,
            promise: bootstrapPromise
        };

        try {
            return await bootstrapPromise;
        } finally {
            if (bootstrapInFlight?.promise === bootstrapPromise) {
                bootstrapInFlight = null;
            }
        }
    }

    async function markRecordingAccessValidated() {
        await chrome.storage.local.set({
            commercialAccessValidatedAt: Date.now()
        }).catch(() => {});
    }

    function hasFreshRecordingAccessValidation(rawSettings) {
        const settings = rawSettings ? mergeSettings(rawSettings) : DEFAULTS;
        return Boolean(settings.commercialAccessValidatedAt)
            && (Date.now() - settings.commercialAccessValidatedAt) <= RECORDING_ACCESS_TTL_MS;
    }

    async function ensureSession(rawSettings, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        if (hasSessionToken(settings) && !options.force) {
            return { ok: true, settings };
        }
        const latestSettings = await readSettings();
        if (hasSessionToken(latestSettings) && !options.force) {
            return { ok: true, settings: latestSettings };
        }
        if (latestSettings.commercialDeviceId && !settings.commercialDeviceId) {
            settings = mergeSettings({
                ...settings,
                commercialDeviceId: latestSettings.commercialDeviceId
            });
        }
        return await bootstrapSession(settings, options);
    }

    async function fetchEntitlement(rawSettings, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { fresh = false, retrying = false } = options;

        if (!hasBackendConfig(settings)) {
            return buildLocalEntitlement(settings, 'api-base-missing');
        }
        if (!hasSessionToken(settings)) {
            const bootstrap = await ensureSession(settings);
            if (!bootstrap.ok) {
                return buildLocalEntitlement(settings, bootstrap.reason || 'session-missing');
            }
            settings = bootstrap.settings || settings;
            if (bootstrap.entitlement) {
                return bootstrap.entitlement;
            }
        }

        if (!fresh) {
            const cached = getCachedEntitlement(settings);
            if (cached) return cached;
        }

        try {
            const response = await fetch(buildApiUrl(settings, ENTITLEMENT_PATH), {
                method: 'GET',
                headers: buildHeaders(settings)
            });
            if (response.status === 401 || response.status === 403) {
                if (!retrying) {
                    const bootstrap = await ensureSession(settings, { force: true });
                    if (bootstrap.ok) {
                        return await fetchEntitlement(bootstrap.settings || settings, { fresh, retrying: true });
                    }
                }
                return buildLocalEntitlement(settings, 'session-invalid');
            }
            if (!response.ok) {
                const cached = getCachedEntitlement(settings);
                return cached || buildLocalEntitlement(settings, `server-${response.status}`);
            }
            const payload = await response.json();
            const entitlement = normalizeEntitlement(payload, settings, true, 'ok');
            await writeEntitlementCache(entitlement);
            return entitlement;
        } catch {
            const cached = getCachedEntitlement(settings);
            return cached || buildLocalEntitlement(settings, 'network-error');
        }
    }

    async function startTrial(rawSettings, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { retrying = false } = options;
        if (!hasBackendConfig(settings)) {
            return buildLocalEntitlement(settings, 'api-base-missing');
        }
        if (!hasSessionToken(settings)) {
            const bootstrap = await ensureSession(settings);
            if (!bootstrap.ok) {
                return buildLocalEntitlement(settings, bootstrap.reason || 'session-missing');
            }
            settings = bootstrap.settings || settings;
        }

        try {
            const response = await fetch(buildApiUrl(settings, START_TRIAL_PATH), {
                method: 'POST',
                headers: buildHeaders(settings),
                body: JSON.stringify({ language: settings.commercialLanguage })
            });
            if (response.status === 401 || response.status === 403) {
                const bootstrap = !retrying ? await ensureSession(settings, { force: true }) : { ok: false };
                if (bootstrap.ok) {
                    return await startTrial(bootstrap.settings || settings, { retrying: true });
                }
                return buildLocalEntitlement(settings, 'session-invalid');
            }
            if (!response.ok) {
                return buildLocalEntitlement(settings, `trial-start-${response.status}`);
            }
            const payload = await response.json();
            const entitlement = normalizeEntitlement(payload, settings, true, 'trial-started');
            await writeEntitlementCache(entitlement);
            return entitlement;
        } catch {
            return buildLocalEntitlement(settings, 'trial-start-network');
        }
    }

    async function ensureRecordingAccess(rawSettings) {
        const settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const entitlement = await fetchEntitlement(settings, { fresh: true });
        if (!entitlement.ok) return entitlement;
        if (entitlement.accessSource === 'trial-available') {
            const started = await startTrial(settings);
            if (started.ok && started.hasAccess) {
                await markRecordingAccessValidated();
            }
            return started;
        }
        if (entitlement.hasAccess) {
            await markRecordingAccessValidated();
        }
        return entitlement;
    }

    function extractSpeechConnection(payload, settings) {
        const connection = payload?.connection || {};
        const provider = normalizeProvider(payload?.provider || connection?.provider);

        if (provider === PROVIDER.ALIYUN) {
            const token = normalizeToken(
                connection?.token
                || payload?.token
                || connection?.api_key
                || connection?.apiKey
                || payload?.api_key
                || payload?.apiKey
            );
            return {
                ok: Boolean(token),
                provider,
                token,
                apiKey: token,
                expiresAt: normalizeTimestamp(connection?.expires_at || connection?.expiresAt || payload?.expires_at || payload?.expiresAt),
                credentialType: String(connection?.credential_type || connection?.credentialType || payload?.credential_type || payload?.credentialType || '').trim() || 'temporary_token',
                region: String(connection?.region || payload?.region || 'cn').trim() || 'cn',
                model: String(connection?.model || payload?.model || 'qwen3-asr-flash-realtime').trim() || 'qwen3-asr-flash-realtime',
                language: normalizeLanguage(connection?.language || payload?.language || settings.commercialLanguage),
                reason: token ? 'ok' : 'missing-aliyun-session'
            };
        }

        return {
            ok: false,
            provider: PROVIDER.ALIYUN,
            token: '',
            apiKey: '',
            expiresAt: 0,
            credentialType: '',
            region: String(connection?.region || payload?.region || 'cn').trim() || 'cn',
            model: String(connection?.model || payload?.model || 'qwen3-asr-flash-realtime').trim() || 'qwen3-asr-flash-realtime',
            language: normalizeLanguage(connection?.language || payload?.language || settings.commercialLanguage),
            reason: 'missing-aliyun-session'
        };
    }

    async function fetchSpeechSession(rawSettings, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { retrying = false } = options;
        if (!hasBackendConfig(settings)) {
            return { ok: false, reason: 'api-base-missing' };
        }
        if (!hasSessionToken(settings)) {
            const bootstrap = await ensureSession(settings);
            if (!bootstrap.ok) {
                return { ok: false, reason: bootstrap.reason || 'session-missing' };
            }
            settings = bootstrap.settings || settings;
        }

        try {
            const response = await fetch(buildApiUrl(settings, SPEECH_SESSION_PATH), {
                method: 'POST',
                headers: buildHeaders(settings),
                body: JSON.stringify({ language: settings.commercialLanguage })
            });
            if (response.status === 403) {
                let payload = null;
                try {
                    payload = await response.json();
                } catch {
                    payload = null;
                }
                if (String(payload?.error || '').trim() === 'google_login_required') {
                    if (payload?.entitlement) {
                        await writeEntitlementCache(normalizeEntitlement(payload.entitlement, settings, false, 'google-login-required'));
                    }
                    return { ok: false, reason: 'google-login-required' };
                }
                return { ok: false, reason: 'session-invalid' };
            }
            if (response.status === 401 || response.status === 403) {
                const bootstrap = !retrying ? await ensureSession(settings, { force: true }) : { ok: false };
                if (bootstrap.ok) {
                    return await fetchSpeechSession(bootstrap.settings || settings, { retrying: true });
                }
                return { ok: false, reason: 'session-invalid' };
            }
            if (response.status === 402) {
                return { ok: false, reason: 'subscription-required' };
            }
            if (!response.ok) {
                return { ok: false, reason: `speech-session-${response.status}` };
            }

            const payload = await response.json();
            const speechSession = extractSpeechConnection(payload, settings);
            if (!speechSession.ok) return speechSession;

            await chrome.storage.local.set({
                commercialLastSpeechProvider: speechSession.provider,
                commercialAccessValidatedAt: Date.now()
            }).catch(() => {});

            return speechSession;
        } catch {
            return { ok: false, reason: 'speech-session-network' };
        }
    }

    async function fetchAccount(rawSettings, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { retrying = false } = options;
        if (!hasBackendConfig(settings)) {
            return { ok: false, reason: 'api-base-missing' };
        }
        if (!hasSessionToken(settings)) {
            const bootstrap = await ensureSession(settings);
            if (!bootstrap.ok) {
                return { ok: false, reason: bootstrap.reason || 'session-missing' };
            }
            settings = bootstrap.settings || settings;
        }

        try {
            const response = await fetch(buildApiUrl(settings, ACCOUNT_PATH), {
                method: 'GET',
                headers: buildHeaders(settings)
            });
            if (response.status === 401 || response.status === 403) {
                const bootstrap = !retrying ? await ensureSession(settings, { force: true }) : { ok: false };
                if (bootstrap.ok) {
                    return await fetchAccount(bootstrap.settings || settings, { retrying: true });
                }
                return { ok: false, reason: 'session-invalid' };
            }
            if (!response.ok) {
                return { ok: false, reason: `account-${response.status}` };
            }

            const payload = await response.json();
            const account = normalizeAccount(payload?.account, settings);
            if (payload?.entitlement) {
                await writeEntitlementCache(normalizeEntitlement(payload.entitlement, settings, true, 'account'));
            }
            await chrome.storage.local.set({
                commercialCachedUserEmail: account.email || ''
            }).catch(() => {});
            return { ok: true, account, entitlement: payload?.entitlement ? normalizeEntitlement(payload.entitlement, settings, true, 'account') : null };
        } catch {
            return { ok: false, reason: 'account-network' };
        }
    }

    async function createGoogleAuthLink(rawSettings, redirectUrl, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { retrying = false } = options;
        if (!hasBackendConfig(settings)) {
            return { ok: false, reason: 'api-base-missing' };
        }
        if (!settings.commercialDeviceId) {
            const commercialDeviceId = createDeviceId();
            await writeSessionPatch({ commercialDeviceId });
            settings = mergeSettings({
                ...settings,
                commercialDeviceId
            });
        }

        try {
            const requestHeaders = hasSessionToken(settings)
                ? buildHeaders(settings)
                : { 'Content-Type': 'application/json' };
            const response = await fetch(buildApiUrl(settings, ACCOUNT_GOOGLE_PREPARE_PATH), {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify({
                    ...buildBootstrapPayload(settings),
                    redirect_url: redirectUrl
                })
            });
            if (response.status === 401 || response.status === 403) {
                const bootstrap = !retrying ? await ensureSession(settings, { force: true }) : { ok: false };
                if (bootstrap.ok) {
                    return await createGoogleAuthLink(bootstrap.settings || settings, redirectUrl, { retrying: true });
                }
                return { ok: false, reason: 'session-invalid' };
            }
            if (!response.ok) {
                return { ok: false, reason: `google-auth-${response.status}` };
            }
            const payload = await response.json();
            const nextSettings = mergeSettings({
                ...settings,
                commercialDeviceId: normalizeDeviceId(payload?.device_id || settings.commercialDeviceId),
                commercialSessionToken: normalizeToken(payload?.session_token || settings.commercialSessionToken),
                commercialCheckoutUrl: payload?.entitlement?.checkout_url || payload?.checkout_url || settings.commercialCheckoutUrl,
                commercialPortalUrl: payload?.entitlement?.portal_url || payload?.portal_url || settings.commercialPortalUrl
            });
            await writeSessionPatch(nextSettings);
            if (payload?.entitlement) {
                await writeEntitlementCache(normalizeEntitlement(payload.entitlement, nextSettings, true, 'google-auth-prepared'));
            }
            return {
                ok: true,
                url: normalizeUrl(payload?.auth_url || payload?.url || ''),
                redirectUrl: normalizeUrl(payload?.redirect_url || redirectUrl),
                settings: nextSettings
            };
        } catch {
            return { ok: false, reason: 'google-auth-network' };
        }
    }

    async function linkSupabaseAccount(rawSettings, accessToken, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { retrying = false } = options;
        if (!hasBackendConfig(settings)) {
            return { ok: false, reason: 'api-base-missing' };
        }
        if (!hasSessionToken(settings)) {
            const bootstrap = await ensureSession(settings);
            if (!bootstrap.ok) {
                return { ok: false, reason: bootstrap.reason || 'session-missing' };
            }
            settings = bootstrap.settings || settings;
        }

        try {
            const response = await fetch(buildApiUrl(settings, ACCOUNT_SUPABASE_LINK_PATH), {
                method: 'POST',
                headers: buildHeaders(settings),
                body: JSON.stringify({ access_token: accessToken })
            });
            if (response.status === 401 || response.status === 403) {
                const bootstrap = !retrying ? await ensureSession(settings, { force: true }) : { ok: false };
                if (bootstrap.ok) {
                    return await linkSupabaseAccount(bootstrap.settings || settings, accessToken, { retrying: true });
                }
                return { ok: false, reason: 'session-invalid' };
            }
            if (!response.ok) {
                return { ok: false, reason: `account-link-${response.status}` };
            }

            const payload = await response.json();
            const account = normalizeAccount(payload?.account, settings);
            const entitlement = payload?.entitlement
                ? normalizeEntitlement(payload.entitlement, settings, true, 'account-linked')
                : null;
            if (entitlement) {
                await writeEntitlementCache(entitlement);
            }
            await chrome.storage.local.set({
                commercialCachedUserEmail: account.email || ''
            }).catch(() => {});
            return { ok: true, account, entitlement, settings };
        } catch {
            return { ok: false, reason: 'account-link-network' };
        }
    }

    function parseAuthCallbackUrl(callbackUrl) {
        const url = new URL(callbackUrl);
        const hash = url.hash ? new URLSearchParams(url.hash.slice(1)) : new URLSearchParams();
        const query = url.search ? new URLSearchParams(url.search.slice(1)) : new URLSearchParams();
        return {
            accessToken: hash.get('access_token') || query.get('access_token') || '',
            error: hash.get('error') || query.get('error') || '',
            errorDescription: hash.get('error_description') || query.get('error_description') || ''
        };
    }

    async function signInWithGoogle(rawSettings) {
        if (!chrome.identity?.launchWebAuthFlow || !chrome.identity?.getRedirectURL) {
            return { ok: false, reason: 'identity-api-unavailable' };
        }

        const settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        // `launchWebAuthFlow()` must stay inside the browser-owned chromiumapp
        // redirect. Bridging through a website breaks Supabase's state cookie.
        const redirectUrl = chrome.identity.getRedirectURL('supabase-auth');
        const authLink = await createGoogleAuthLink(settings, redirectUrl);
        if (!authLink.ok || !authLink.url) {
            return { ok: false, reason: authLink.reason || 'google-auth-failed' };
        }

        // Keep using the refreshed session from the auth-link step so the
        // callback is linked back to the same device session.
        const authSettings = authLink.settings || settings;

        try {
            const callbackUrl = await chrome.identity.launchWebAuthFlow({
                url: authLink.url,
                interactive: true
            });

            if (!callbackUrl) {
                return { ok: false, reason: 'google-auth-cancelled' };
            }

            const result = parseAuthCallbackUrl(callbackUrl);
            if (result.error) {
                const cancelled = /access_denied|user_cancelled|cancel/i.test(result.error)
                    || /cancel/i.test(result.errorDescription);
                return { ok: false, reason: cancelled ? 'google-auth-cancelled' : 'google-auth-failed' };
            }
            if (!result.accessToken) {
                return { ok: false, reason: 'google-access-token-missing' };
            }

            const linked = await linkSupabaseAccount(authSettings, result.accessToken);
            if (!linked.ok) {
                return linked;
            }

            const latestSettings = linked.settings || await readSettings();
            const [accountResult, entitlementResult] = await Promise.all([
                fetchAccount(latestSettings),
                fetchEntitlement(latestSettings, { fresh: true })
            ]);

            return {
                ok: true,
                account: accountResult.ok ? accountResult.account : linked.account,
                entitlement: entitlementResult.ok ? entitlementResult : linked.entitlement,
                settings: latestSettings
            };
        } catch (error) {
            const message = String(error?.message || error || '');
            const cancelled = /The user did not approve|user did not approve|cancel/i.test(message);
            return { ok: false, reason: cancelled ? 'google-auth-cancelled' : 'google-auth-failed' };
        }
    }

    async function signOutLocalAccount() {
        const nextDeviceId = createDeviceId();
        await chrome.storage.local.set({
            commercialDeviceId: nextDeviceId,
            commercialSessionToken: '',
            commercialCheckoutUrl: DEFAULT_CHECKOUT_URL,
            commercialPortalUrl: DEFAULT_PORTAL_URL,
            commercialCachedEntitlement: null,
            commercialCachedEntitlementAt: 0,
            commercialAccessValidatedAt: 0,
            commercialCachedUserEmail: ''
        }).catch(() => {});
        return {
            ok: true,
            deviceId: nextDeviceId
        };
    }

    async function createBillingLink(rawSettings, kind, options = {}) {
        let settings = rawSettings ? mergeSettings(rawSettings) : await readSettings();
        const { retrying = false } = options;
        const path = kind === 'portal' ? BILLING_PORTAL_PATH : BILLING_CHECKOUT_PATH;
        const fallbackUrl = kind === 'portal' ? settings.commercialPortalUrl : settings.commercialCheckoutUrl;

        if (!hasBackendConfig(settings)) {
            return fallbackUrl
                ? { ok: true, url: fallbackUrl, kind, reason: 'fallback-url' }
                : { ok: false, reason: 'api-base-missing' };
        }

        if (!hasSessionToken(settings)) {
            const bootstrap = await ensureSession(settings);
            if (!bootstrap.ok) {
                return fallbackUrl
                    ? { ok: true, url: fallbackUrl, kind, reason: 'fallback-url' }
                    : { ok: false, reason: bootstrap.reason || 'session-missing' };
            }
            settings = bootstrap.settings || settings;
        }

        try {
            const response = await fetch(buildApiUrl(settings, path), {
                method: 'POST',
                headers: buildHeaders(settings),
                body: JSON.stringify({ device_id: settings.commercialDeviceId })
            });
            if (response.status === 401 || response.status === 403) {
                const bootstrap = !retrying ? await ensureSession(settings, { force: true }) : { ok: false };
                if (bootstrap.ok) {
                    return await createBillingLink(bootstrap.settings || settings, kind, { retrying: true });
                }
                return { ok: false, reason: 'session-invalid' };
            }
            if (!response.ok) {
                return fallbackUrl
                    ? { ok: true, url: fallbackUrl, kind, reason: 'fallback-url' }
                    : { ok: false, reason: `${kind}-${response.status}` };
            }

            const payload = await response.json();
            const url = normalizeUrl(payload?.billing_url || payload?.checkout_url || payload?.portal_url || payload?.url || '');
            if (!url) {
                return fallbackUrl
                    ? { ok: true, url: fallbackUrl, kind, reason: 'fallback-url' }
                    : { ok: false, reason: `${kind}-url-missing` };
            }

            return {
                ok: true,
                url,
                kind: String(payload?.kind || kind).trim() || kind
            };
        } catch {
            return fallbackUrl
                ? { ok: true, url: fallbackUrl, kind, reason: 'fallback-url' }
                : { ok: false, reason: `${kind}-network` };
        }
    }

    function canOpenBilling(kind, settings, entitlement = null) {
        const merged = mergeSettings(settings || {});
        const billing = entitlement?.billing || {};
        if (kind === 'portal') {
            return Boolean(merged.commercialPortalUrl || billing.canPortal || entitlement?.subscription?.active);
        }
        return Boolean(merged.commercialCheckoutUrl || billing.canCheckout || hasBackendConfig(merged));
    }

    function fixedCommercialSettings(raw = {}) {
        const settings = mergeSettings(raw);
        return {
            ...settings,
            isCommercial: true,
            planMode: 'commercial',
            speechMode: 'managed',
            sttLanguage: settings.commercialLanguage,
            sttProvider: PROVIDER.ALIYUN
        };
    }

    global.OnvordCommercial = {
        DAY_MS,
        CACHE_TTL_MS,
        RECORDING_ACCESS_TTL_MS,
        PROVIDER,
        STORAGE_KEYS,
        DEFAULTS,
        mergeSettings,
        normalizeLanguage,
        normalizeProvider,
        hasBackendConfig,
        hasSessionToken,
        bootstrapSession,
        ensureSession,
        readSettings,
        fetchEntitlement,
        startTrial,
        ensureRecordingAccess,
        fetchSpeechSession,
        fetchAccount,
        createGoogleAuthLink,
        linkSupabaseAccount,
        signInWithGoogle,
        signOutLocalAccount,
        isLinkedAccount,
        markRecordingAccessValidated,
        hasFreshRecordingAccessValidation,
        createBillingLink,
        canOpenBilling,
        fixedCommercialSettings
    };
})(globalThis);
