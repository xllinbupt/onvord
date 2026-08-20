// Onvord Settings Page
(function () {
    'use strict';

    const Commercial = globalThis.OnvordCommercial;
    const isZh = /^zh\b/i.test(navigator.language || '');
    const LOCALE = isZh ? 'zh' : 'en';

    const $ = (id) => document.getElementById(id);

    const elLanguage = $('commercial-language');
    const elAccountBadge = $('account-badge');
    const elAccountAvatar = $('account-avatar');
    const elAccountName = $('account-name');
    const elAccountEmail = $('account-email');
    const elAccountSummary = $('account-summary');
    const elBillingCard = $('billing-card');
    const elRecordingCard = $('recording-card');
    const elAccessBadge = $('access-badge');
    const elAccessSummary = $('access-summary');
    const elStatus = $('status');

    const btnGoogleSignin = $('btn-google-signin');
    const btnSignOut = $('btn-sign-out');
    const btnSave = $('btn-save');
    const btnRefresh = $('btn-refresh');
    const btnOpenCheckout = $('btn-open-checkout');
    const btnOpenPortal = $('btn-open-portal');

    const I18N = {
        zh: {
            kicker: '设置',
            title: 'Onvord',
            subtitle: '使用 Google 登录后开始试用，订阅和状态都会绑定到同一个账号。',
            cardAccount: '账号与恢复',
            cardAccountSubtitle: '商业版从 Google 账号开始。试用、订阅和后续恢复都会跟账号走。',
            cardBilling: '订阅与账单',
            cardBillingSubtitle: '查看当前订阅状态、刷新权限，并在需要时进入账单管理。',
            cardRecording: '录制偏好',
            cardRecordingSubtitle: '这里只放录制相关设置，不和订阅动作混在一起。',
            labelAccount: '账号状态',
            labelStatus: '访问状态',
            labelLanguage: '录制语言',
            accountChecking: '正在检查账号',
            accountAnonymous: '需要登录',
            accountLinked: '已绑定 Google',
            accountUnavailable: '账号服务不可用',
            accountAnonymousName: '先用 Google 登录，再开始使用',
            accountAnonymousSummary: '登录后才会开始试用，后续订阅和权限也会直接绑定到这个账号。',
            accountLinkedSummary: '当前设备已经绑定到你的 Google 账号。以后重装插件后，重新登录即可恢复权限。',
            accountUnavailableSummary: '当前无法连接账号服务，请稍后再试。',
            googleSignin: '使用 Google 登录',
            googleConnected: '已连接 Google',
            googleSigninBusy: '正在打开 Google 登录…',
            signOut: '退出登录',
            signOutBusy: '正在退出…',
            signOutConfirm: '确认退出当前设备上的登录吗？之后可以随时重新使用 Google 登录恢复权限。',
            googleSigninSuccess: '✅ 已连接 Google，后续可跨设备恢复订阅',
            googleSigninFailed: '❌ Google 登录失败，请稍后重试',
            googleSigninCancelled: '❌ 你已取消 Google 登录',
            signOutSuccess: '✅ 已退出当前设备登录',
            checkoutNeedsGoogle: '订阅前请先登录 Google',
            checkoutGoogleThenContinue: '已连接 Google，正在继续打开订阅页面',
            recordingNote: '修改后会应用到之后的新录制会话。',
            save: '保存',
            refresh: '刷新状态',
            openCheckout: '订阅',
            openPortal: '打开订阅管理',
            waiting: '正在检查状态',
            waitingSummary: '正在连接 Onvord 服务，请稍候。',
            noBackend: '服务暂不可用',
            trialAvailable: '可开始试用',
            trialActive: '试用中',
            betaActive: '已可用',
            subscriptionActive: '订阅有效',
            accessLocked: '需要订阅',
            summaryNoBackend: '当前服务暂时不可用，请稍后再试。',
            summaryTrialAvailable: '第一次开始录制时会自动开始 7 天试用。',
            summaryTrialActive: '试用到期时间：{endAt}，剩余 {daysLeft} 天。',
            summaryBetaActive: '当前可以直接开始录制。',
            summarySubscriptionActive: '订阅有效。到期时间：{endAt}。',
            summaryAccessLocked: '当前没有可用权限，请订阅后继续录制。',
            summaryServerError: '暂时无法获取状态，请稍后再试。',
            saved: '✅ 语言设置已保存',
            refreshed: '✅ 已刷新访问状态',
            openCheckoutMissing: '❌ 暂未开放订阅入口',
            openPortalMissing: '❌ 尚未配置订阅管理链接',
            openLinkFailed: '❌ 无法打开外部链接',
            refreshFailed: '❌ 刷新状态失败'
        },
        en: {
            kicker: 'Settings',
            title: 'Onvord',
            subtitle: 'Start with Google so trial, subscription, and future access all stay tied to one account.',
            cardAccount: 'Account & Recovery',
            cardAccountSubtitle: 'Commercial access starts with Google. Trial, subscription, and future restore all stay tied to the same account.',
            cardBilling: 'Subscription & Billing',
            cardBillingSubtitle: 'Check your access state, refresh entitlement, and open billing only when needed.',
            cardRecording: 'Recording Preferences',
            cardRecordingSubtitle: 'Only recording-related settings live here, separate from subscription actions.',
            labelAccount: 'Account',
            labelStatus: 'Access Status',
            labelLanguage: 'Recording Language',
            accountChecking: 'Checking account',
            accountAnonymous: 'Sign in required',
            accountLinked: 'Google connected',
            accountUnavailable: 'Account unavailable',
            accountAnonymousName: 'Use Google before you start',
            accountAnonymousSummary: 'Your trial starts only after sign-in, and future subscription access stays tied to this account.',
            accountLinkedSummary: 'This device is already linked to your Google account. Sign in again after reinstalling to restore access.',
            accountUnavailableSummary: 'Unable to connect to the account service right now. Please try again later.',
            googleSignin: 'Continue with Google',
            googleConnected: 'Google connected',
            googleSigninBusy: 'Opening Google sign-in…',
            signOut: 'Sign out',
            signOutBusy: 'Signing out…',
            signOutConfirm: 'Sign out on this device now? You can sign in with Google again at any time to restore access.',
            googleSigninSuccess: '✅ Google connected. Your subscription can now be restored across devices',
            googleSigninFailed: '❌ Google sign-in failed. Please try again later',
            googleSigninCancelled: '❌ Google sign-in was cancelled',
            signOutSuccess: '✅ Signed out on this device',
            checkoutNeedsGoogle: 'Sign in with Google before subscribing',
            checkoutGoogleThenContinue: 'Google connected. Continuing to checkout…',
            recordingNote: 'Changes apply to your next recording sessions.',
            save: 'Save',
            refresh: 'Refresh',
            openCheckout: 'Subscribe',
            openPortal: 'Manage Subscription',
            waiting: 'Checking status',
            waitingSummary: 'Connecting to Onvord. Please wait.',
            noBackend: 'Service unavailable',
            trialAvailable: 'Trial available',
            trialActive: 'Trial active',
            betaActive: 'Ready',
            subscriptionActive: 'Subscription active',
            accessLocked: 'Subscription required',
            summaryNoBackend: 'The service is temporarily unavailable. Please try again later.',
            summaryTrialAvailable: 'Your 7-day trial will start automatically on the first recording.',
            summaryTrialActive: 'Trial ends at {endAt}, with {daysLeft} day(s) left.',
            summaryBetaActive: 'You can start recording now.',
            summarySubscriptionActive: 'Subscription is active. Renewal date: {endAt}.',
            summaryAccessLocked: 'No active access is available. Subscribe to keep recording.',
            summaryServerError: 'Unable to fetch your current state. Please try again later.',
            saved: '✅ Language saved',
            refreshed: '✅ Access state refreshed',
            openCheckoutMissing: '❌ Subscription is not available yet',
            openPortalMissing: '❌ Billing portal URL is not configured',
            openLinkFailed: '❌ Unable to open the external link',
            refreshFailed: '❌ Failed to refresh access'
        }
    };

    function t(key, vars = {}) {
        const table = I18N[LOCALE] || I18N.en;
        let text = table[key] || I18N.en[key] || key;
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
        return text;
    }

    function setText(id, text) {
        const el = $(id);
        if (el) el.textContent = text;
    }

    function formatDateTime(ts) {
        if (!ts) return '-';
        try {
            const locale = LOCALE === 'zh' ? 'zh-CN' : 'en-US';
            return new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(ts));
        } catch {
            return new Date(ts).toLocaleString();
        }
    }

    function showStatus(message, ok) {
        elStatus.textContent = message;
        elStatus.className = `status ${ok ? 'ok' : 'err'}`;
    }

    function hideStatus() {
        elStatus.className = 'status';
        elStatus.textContent = '';
    }

    function collectSettings(base = {}) {
        return Commercial.mergeSettings({
            ...(base || {}),
            commercialLanguage: elLanguage.value
        });
    }

    function applySettings(settings) {
        const merged = Commercial.mergeSettings(settings);
        elLanguage.value = merged.commercialLanguage;
    }

    function getAccountInitial(account) {
        const source = account?.displayName || account?.email || 'O';
        return String(source || 'O').trim().charAt(0).toUpperCase() || 'O';
    }

    function setButtonLoading(button, loading, loadingText, idleText) {
        if (!button) return;
        button.disabled = Boolean(loading);
        button.classList.toggle('is-loading', Boolean(loading));
        button.textContent = loading ? loadingText : idleText;
    }

    function setBillingVisibility(visible) {
        elBillingCard?.classList.toggle('hidden', !visible);
    }

    function setAuthenticatedSectionsVisible(visible) {
        setBillingVisibility(visible);
        elRecordingCard?.classList.toggle('hidden', !visible);
    }

    function buildSignedOutEntitlement() {
        return {
            ok: true,
            authenticated: false,
            hasAccess: false,
            accessSource: 'login-required',
            userIsAnonymous: true,
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
            }
        };
    }

    function renderAccount(account) {
        elAccountBadge.className = 'badge';
        elAccountAvatar.classList.remove('has-image');
        elAccountAvatar.innerHTML = '';

        if (!account) {
            setAuthenticatedSectionsVisible(false);
            elAccountBadge.textContent = t('accountChecking');
            elAccountName.textContent = t('accountChecking');
            elAccountEmail.textContent = '-';
            elAccountSummary.textContent = t('waitingSummary');
            elAccountAvatar.textContent = 'O';
            btnGoogleSignin.disabled = true;
            btnSignOut.disabled = true;
            btnGoogleSignin.classList.remove('hidden');
            btnSignOut.classList.add('hidden');
            btnGoogleSignin.textContent = t('googleSignin');
            return;
        }

        if (!account.ok) {
            setAuthenticatedSectionsVisible(false);
            elAccountBadge.textContent = t('accountUnavailable');
            elAccountBadge.classList.add('warn');
            elAccountName.textContent = t('accountUnavailable');
            elAccountEmail.textContent = '-';
            elAccountSummary.textContent = t('accountUnavailableSummary');
            elAccountAvatar.textContent = '!';
            btnGoogleSignin.disabled = false;
            btnSignOut.disabled = true;
            btnGoogleSignin.classList.remove('hidden');
            btnSignOut.classList.add('hidden');
            btnGoogleSignin.textContent = t('googleSignin');
            return;
        }

        const profile = account.account;
        elAccountAvatar.textContent = getAccountInitial(profile);
        if (profile.avatarUrl) {
            const img = document.createElement('img');
            img.src = profile.avatarUrl;
            img.alt = profile.displayName || profile.email || 'Onvord';
            img.onload = () => {
                elAccountAvatar.classList.add('has-image');
            };
            img.onerror = () => {
                img.remove();
            };
            elAccountAvatar.appendChild(img);
        }

        elAccountName.textContent = profile.isAnonymous
            ? t('accountAnonymousName')
            : (profile.displayName || profile.email || 'Onvord');
        elAccountEmail.textContent = profile.email || '-';

        if (profile.linkedGoogle && !profile.isAnonymous) {
            setAuthenticatedSectionsVisible(true);
            elAccountBadge.textContent = t('accountLinked');
            elAccountBadge.classList.add('ok');
            elAccountSummary.textContent = t('accountLinkedSummary');
            btnGoogleSignin.classList.add('hidden');
            btnSignOut.classList.remove('hidden');
            btnSignOut.textContent = t('signOut');
        } else {
            setAuthenticatedSectionsVisible(false);
            elAccountBadge.textContent = t('accountAnonymous');
            elAccountBadge.classList.add('warn');
            elAccountSummary.textContent = t('accountAnonymousSummary');
            btnGoogleSignin.classList.remove('hidden');
            btnSignOut.classList.add('hidden');
            btnGoogleSignin.textContent = t('googleSignin');
        }
        btnGoogleSignin.disabled = false;
        btnSignOut.disabled = false;
    }

    function renderEntitlement(entitlement) {
        elAccessBadge.className = 'badge';
        const settings = Commercial.mergeSettings({
            commercialLanguage: elLanguage.value
        });

        const loginRequired = Boolean(entitlement?.userIsAnonymous) || entitlement?.accessSource === 'login-required';
        btnOpenCheckout.classList.toggle(
            'hidden',
            loginRequired || !Commercial.canOpenBilling('checkout', settings, entitlement) || Boolean(entitlement?.subscription?.active)
        );
        btnOpenPortal.classList.toggle(
            'hidden',
            Boolean(entitlement?.subscription?.active) || !Commercial.canOpenBilling('portal', settings, entitlement)
        );

        if (!entitlement) {
            elAccessBadge.textContent = t('waiting');
            elAccessSummary.textContent = t('waitingSummary');
            return;
        }

        if (entitlement.reason === 'api-base-missing') {
            elAccessBadge.textContent = t('noBackend');
            elAccessBadge.classList.add('warn');
            elAccessSummary.textContent = t('summaryNoBackend');
            return;
        }

        if (loginRequired) {
            elAccessBadge.textContent = t('accountAnonymous');
            elAccessBadge.classList.add('warn');
            elAccessSummary.textContent = t('accountAnonymousSummary');
            return;
        }

        if (!entitlement.ok && entitlement.reason !== 'cached') {
            elAccessBadge.textContent = t('accessLocked');
            elAccessBadge.classList.add('err');
            elAccessSummary.textContent = t('summaryServerError');
            return;
        }

        if (entitlement.subscription?.active && entitlement.subscription.status === 'beta') {
            elAccessBadge.textContent = t('betaActive');
            elAccessBadge.classList.add('ok');
            elAccessSummary.textContent = t('summaryBetaActive');
            return;
        }

        if (entitlement.subscription?.active) {
            elAccessBadge.textContent = t('subscriptionActive');
            elAccessBadge.classList.add('ok');
            elAccessSummary.textContent = t('summarySubscriptionActive', {
                endAt: formatDateTime(entitlement.subscription.endAt)
            });
            return;
        }

        if (entitlement.trial?.active) {
            elAccessBadge.textContent = t('trialActive');
            elAccessBadge.classList.add('warn');
            elAccessSummary.textContent = t('summaryTrialActive', {
                endAt: formatDateTime(entitlement.trial.endAt),
                daysLeft: entitlement.trial.daysLeft
            });
            return;
        }

        if (entitlement.accessSource === 'trial-available') {
            elAccessBadge.textContent = t('trialAvailable');
            elAccessBadge.classList.add('warn');
            elAccessSummary.textContent = t('summaryTrialAvailable');
            return;
        }

        elAccessBadge.textContent = t('accessLocked');
        elAccessBadge.classList.add('err');
        elAccessSummary.textContent = t('summaryAccessLocked');
    }

    async function refreshEntitlement(showToast = false) {
        try {
            const settings = await Commercial.readSettings();
            const entitlement = await Commercial.fetchEntitlement(settings, { fresh: true });
            const latestSettings = await Commercial.readSettings();
            applySettings(latestSettings);
            renderEntitlement(entitlement);
            if (showToast) {
                showStatus(t('refreshed'), true);
            }
        } catch {
            if (showToast) {
                showStatus(t('refreshFailed'), false);
            }
        }
    }

    async function refreshAccount(showToast = false) {
        try {
            const settings = await Commercial.readSettings();
            const account = await Commercial.fetchAccount(settings);
            renderAccount(account);
            if (showToast && account.ok) {
                showStatus(t('refreshed'), true);
            }
        } catch {
            renderAccount({ ok: false });
            if (showToast) {
                showStatus(t('refreshFailed'), false);
            }
        }
    }

    async function saveSettings() {
        const current = await Commercial.readSettings();
        const settings = collectSettings(current);
        await chrome.storage.local.set({
            commercialLanguage: settings.commercialLanguage
        });
        applySettings(settings);
        renderEntitlement(await Commercial.fetchEntitlement(settings, { fresh: true }));
        showStatus(t('saved'), true);
    }

    async function ensureGoogleAccountForCheckout() {
        const settings = await Commercial.readSettings();
        const account = await Commercial.fetchAccount(settings);
        if (account.ok && Commercial.isLinkedAccount(account.account)) {
            return { ok: true, account };
        }

        showStatus(t('checkoutNeedsGoogle'), false);
        const linked = await Commercial.signInWithGoogle(settings);
        if (!linked.ok) {
            showStatus(
                linked.reason === 'google-auth-cancelled'
                    ? t('googleSigninCancelled')
                    : t('googleSigninFailed'),
                false
            );
            return linked;
        }

        renderAccount({ ok: true, account: linked.account });
        if (linked.entitlement) {
            renderEntitlement(linked.entitlement);
        }
        showStatus(t('checkoutGoogleThenContinue'), true);
        return linked;
    }

    async function openLink(kind) {
        let settings = await Commercial.readSettings();
        if (kind === 'checkout') {
            const linked = await ensureGoogleAccountForCheckout();
            if (!linked.ok) return;
            settings = await Commercial.readSettings();
        }
        const link = await Commercial.createBillingLink(settings, kind);
        if (!link.ok || !link.url) {
            showStatus(t(kind === 'checkout' ? 'openCheckoutMissing' : 'openPortalMissing'), false);
            return;
        }
        try {
            await chrome.tabs.create({ url: link.url });
        } catch {
            showStatus(t('openLinkFailed'), false);
        }
    }

    async function signInWithGoogle() {
        setButtonLoading(btnGoogleSignin, true, t('googleSigninBusy'), t('googleSignin'));
        try {
            const settings = await Commercial.readSettings();
            const linked = await Commercial.signInWithGoogle(settings);
            if (!linked.ok) {
                showStatus(
                    linked.reason === 'google-auth-cancelled'
                        ? t('googleSigninCancelled')
                        : t('googleSigninFailed'),
                    false
                );
                return;
            }

            renderAccount({ ok: true, account: linked.account });
            if (linked.entitlement) {
                renderEntitlement(linked.entitlement);
            } else {
                refreshEntitlement(false).catch(() => {});
            }
            refreshAccount(false).catch(() => {});
            showStatus(t('googleSigninSuccess'), true);
        } catch {
            showStatus(t('googleSigninFailed'), false);
        } finally {
            setButtonLoading(btnGoogleSignin, false, t('googleSigninBusy'), t('googleSignin'));
        }
    }

    async function signOut() {
        if (!window.confirm(t('signOutConfirm'))) {
            return;
        }

        setButtonLoading(btnSignOut, true, t('signOutBusy'), t('signOut'));
        try {
            await Commercial.signOutLocalAccount();
            renderAccount({
                ok: true,
                account: {
                    email: '',
                    displayName: '',
                    avatarUrl: '',
                    isAnonymous: true,
                    linkedGoogle: false
                }
            });
            renderEntitlement(buildSignedOutEntitlement());
            showStatus(t('signOutSuccess'), true);
            refreshEntitlement(false).catch(() => {});
            refreshAccount(false).catch(() => {});
        } catch {
            showStatus(t('refreshFailed'), false);
        } finally {
            setButtonLoading(btnSignOut, false, t('signOutBusy'), t('signOut'));
        }
    }

    function applyLocale() {
        document.documentElement.lang = isZh ? 'zh-CN' : 'en';
        document.title = `${t('title')} ${LOCALE === 'zh' ? '设置' : 'Settings'}`;
        setText('opt-kicker', t('kicker'));
        setText('opt-title', t('title'));
        setText('opt-subtitle', t('subtitle'));
        setText('opt-card-account', t('cardAccount'));
        setText('opt-card-account-subtitle', t('cardAccountSubtitle'));
        setText('opt-card-billing', t('cardBilling'));
        setText('opt-card-billing-subtitle', t('cardBillingSubtitle'));
        setText('opt-card-recording', t('cardRecording'));
        setText('opt-card-recording-subtitle', t('cardRecordingSubtitle'));
        setText('opt-label-account', t('labelAccount'));
        setText('opt-label-status', t('labelStatus'));
        setText('opt-label-language', t('labelLanguage'));
        setText('recording-note', t('recordingNote'));
        btnGoogleSignin.textContent = t('googleSignin');
        btnSignOut.textContent = t('signOut');
        btnSave.textContent = t('save');
        btnRefresh.textContent = t('refresh');
        btnOpenCheckout.textContent = t('openCheckout');
        btnOpenPortal.textContent = t('openPortal');

        const optZh = elLanguage.querySelector('option[value="zh-CN"]');
        const optEn = elLanguage.querySelector('option[value="en-US"]');
        if (optZh) optZh.textContent = isZh ? '中文' : 'Chinese';
        if (optEn) optEn.textContent = 'English';

        renderAccount(null);
        renderEntitlement(null);
    }

    async function init() {
        applyLocale();
        hideStatus();
        const settings = await Commercial.readSettings();
        applySettings(settings);
        const [entitlement, account] = await Promise.all([
            Commercial.fetchEntitlement(settings, { fresh: false }),
            Commercial.fetchAccount(settings)
        ]);
        applySettings(await Commercial.readSettings());
        renderAccount(account);
        renderEntitlement(entitlement);

        btnSave.addEventListener('click', () => saveSettings().catch(() => showStatus(t('refreshFailed'), false)));
        btnRefresh.addEventListener('click', async () => {
            await Promise.all([refreshEntitlement(false), refreshAccount(false)]);
            showStatus(t('refreshed'), true);
        });
        btnGoogleSignin.addEventListener('click', () => signInWithGoogle());
        btnSignOut.addEventListener('click', () => signOut());
        btnOpenCheckout.addEventListener('click', () => openLink('checkout'));
        btnOpenPortal.addEventListener('click', () => openLink('portal'));
    }

    init().catch(() => {
        renderEntitlement(null);
        showStatus(t('refreshFailed'), false);
    });
})();
