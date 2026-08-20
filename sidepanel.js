// Onvord Side Panel Logic
(function () {
    'use strict';

    const Commercial = globalThis.OnvordCommercial;

    let currentView = 'idle';
    let startTime = 0;
    let timer = null;
    let currentSOP = null;
    // evCount removed — step count now derived from timeline groups
    let audioCtx = null;
    let analyser = null;
    let micStream = null;
    let volAnimId = null;

    /* ── DOM refs ── */
    const $ = id => document.getElementById(id);
    const views = { idle: $('view-idle'), recording: $('view-recording') };
    const btnStart = $('btn-start'), btnStop = $('btn-stop');
    const btnPause = $('btn-pause');
    const btnRedo = $('btn-redo');
    const btnDownload = $('btn-download');
    const recTimer = $('rec-timer'), voiceBox = $('voice-box');
    const recBarEl = document.querySelector('#view-recording .rec-bar');
    const recActionsEl = $('rec-actions');
    const previewActionsEl = $('preview-actions');
    const recLabelEl = $('rec-label');
    const evList = $('ev-list'), evCountBadge = $('ev-count');
    const imgViewerEl = $('img-viewer');
    const imgViewerCloseEl = $('img-viewer-close');
    const imgViewerImgEl = $('img-viewer-img');
    const toastEl = $('toast');
    const micStatusEl = $('mic-status');
    const volIndicator = $('vol-indicator');
    const volBars = volIndicator ? Array.from(volIndicator.querySelectorAll('.vol-bar')) : [];
    const commercialBannerEl = $('commercial-banner');
    const commercialStatusEl = $('commercial-status');
    const commercialTitleEl = $('commercial-title');
    const commercialCopyEl = $('commercial-copy');
    const commercialBannerActionsEl = commercialBannerEl?.querySelector('.commercial-banner-actions');
    const btnCommercialCheckout = $('btn-commercial-checkout');
    const btnCommercialPortal = $('btn-commercial-portal');
    const uiLocale = /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
    const I18N = {
        zh: {
            titleTagline: '一边操作，一边讲解<br>AI 立即学会流程',
            inst1: '打开要演示的网页',
            inst2: '点击下方按钮开始录制',
            inst3: '操作浏览器，同时语音讲解',
            inst4: '完成后生成 SOP，发送给 AI',
            startRecording: '开始录制',
            settingsLink: '设置',
            recRecording: '录制中',
            recDone: '录制完成',
            recPaused: '已暂停',
            sectionActionLog: '操作记录',
            waitingPlaceholder: '等待操作或说话…',
            noPreview: '没有可预览内容',
            stopRecording: '停止录制',
            pause: '暂停',
            resume: '继续',
            exportSop: '复制 SOP',
            downloadFullSop: '下载完整 SOP（含截图）',
            recordAgain: '重新录制',
            micStatusTitle: '语音识别',
            recognizing: '识别中',
            screenshotPreview: '截图预览',
            viewScreenshot: '查看截图',
            actionFallback: '操作',
            elementFallback: '元素',
            pageFallback: '页面',
            keypressFallback: '快捷键',
            actionClick: '点击 {target}',
            actionInput: '输入「{value}」',
            actionScroll: '滚动',
            actionScrollMerged: '滚动（合并 {count} 次）',
            actionSelect: '选择「{value}」',
            actionClickElement: '点击元素',
            actionInputShort: '输入',
            actionSelectShort: '选择',
            actionNavigate: '页面跳转',
            clickPointScreenshot: '步骤 {step} 截图',
            startNeedKey: '服务未就绪',
            startNeedBackend: '服务暂不可用',
            startNeedSession: '连接已失效',
            startNeedManaged: '官方语音未就绪',
            startNeedSubscription: '请先开通订阅',
            startNeedGoogle: '使用 Google 登录',
            startNeedGoogleBusy: '正在打开 Google 登录…',
            startNeedMic: '开启麦克风权限',
            startProviderUnsupported: '当前语音服务暂不支持',
            initStt: '初始化语音识别…',
            toastWsDisconnected: '语音连接已断开，请暂停后继续重连',
            toastNeedSetupKey: '语音服务暂时不可用，请稍后再试',
            toastNeedBackend: '当前服务暂不可用，请稍后再试',
            toastNeedSession: '连接已失效，请重新打开 Onvord 后再试',
            toastNeedManaged: '语音服务暂时不可用，请稍后再试',
            toastNeedSubscription: '7 天试用已结束，请订阅后继续录制',
            toastCheckoutMissing: '尚未配置支付页链接',
            toastPortalMissing: '尚未配置订阅管理链接',
            toastCheckoutLoginRequired: '订阅前请先登录 Google',
            toastCheckoutLoginContinue: '已连接 Google，正在继续打开订阅页面',
            toastGoogleSigninFailed: 'Google 登录失败，请稍后重试',
            toastGoogleSigninCancelled: '你已取消 Google 登录',
            toastGoogleSigninSuccess: '已连接 Google，现在可以开始使用了',
            toastSessionExpired: '当前登录态已失效，请重新登录后再试',
            toastSpeechSessionFailed: '暂时无法开始语音识别，请稍后再试',
            toastMicDenied: '麦克风权限未授予，无法开始录制',
            toastNoMic: '未检测到麦克风设备，无法开始录制',
            toastMicBusy: '麦克风暂不可用（可能被占用），无法开始录制',
            toastAliyunKeyInvalid: '语音服务鉴权失败，请稍后重试',
            toastAliyunKeyFormat: '语音服务初始化失败，请重试',
            toastAliyunNetwork: '无法连接语音服务，请检查网络后重试',
            toastAliyunAuthRule: '语音服务初始化失败，请重载扩展后重试',
            toastAliyunWsHandshake: '语音服务连接失败，请稍后重试',
            toastAliyunInitFailed: '语音服务初始化失败，请稍后重试',
            toastInitFailed: '语音识别初始化失败，无法开始录制',
            toastStartFailed: '启动失败',
            generating: '生成中…',
            toastGenerateFailed: '生成 SOP 失败',
            toastGenerateError: '生成失败',
            toastPaused: '已暂停',
            toastResumeSttFailed: '恢复语音识别失败，请检查麦克风和网络后重试',
            toastResumed: '已继续录制',
            toastPauseResumeFailed: '暂停/继续失败',
            exportSuccess: '✅ 已复制 SOP 到剪切板',
            downloadSuccess: '✅ 已下载完整 SOP',
            toastCopyFailed: '复制 SOP 失败',
            toastAutoStopped: '已达到录制时间上限，自动停止',
            toastRestricted: '当前页面操作暂不可录制',
            recoveryPrompt: '发现 {ago} 分钟前的录制数据（{count} 个操作块），是否恢复？',
            toastRecoverySttFailed: '语音识别恢复失败',
            copySectionIntro: 'SOP 介绍',
            copySectionNotes: '说明',
            copySectionOps: '操作',
            copyFieldStartUrl: '起始页面',
            copyFieldCreatedAt: '录制时间',
            copyFieldDuration: '总时长',
            copyFieldStepCount: '操作步骤数',
            copyFieldTime: '时间',
            copyFieldPage: '页面',
            copyNarrationTitle: '讲解',
            copyEmptyOps: '暂无操作步骤',
            exportStepAlt: '步骤{step}',
            exportAgentDetail: '执行细节（给 Agent）',
            exportDocTitle: '文档说明',
            exportDocIntro: '本文档由 Onvord 浏览器录制工具自动生成，记录了用户在浏览器中的操作流程。',
            exportHowToRead: '如何阅读：',
            exportHowToReadItems: '• 每个步骤包含一个操作描述（如“点击按钮”、“输入文字”、“选择文字”等）<br>• <strong>讲解</strong>：用户在操作时的语音讲解，说明每一步的意图和上下文<br>• <strong>截图</strong>：操作时刻的页面截图，蓝色圆点标记了操作位置<br>• <strong>执行细节（给 Agent）</strong>：被操作元素的 CSS 选择器路径（默认折叠），可用于自动化复现',
            exportSummary: '信息概要：',
            exportSummaryLines: '• 起始页面：{startUrl}<br>• 录制时间：{createdAt}<br>• 共 {steps} 个操作步骤，总时长 {duration}',
            exportGeneratedBy: '由 Onvord 录制生成 · {createdAt}',
            exportStepsUnit: '步骤',
            exportLang: 'zh',
            commercialStatusTrialAvailable: '待开始试用',
            commercialStatusTrialActive: '试用中，还剩 {days} 天',
            commercialStatusExpired: '试用已结束',
            commercialStatusSubscribed: '订阅有效',
            commercialStatusSignIn: '需要登录',
            commercialStatusUnavailable: '暂时不可用',
            commercialTitleTrialAvailable: '已完成登录，开始第一次录制就会进入 7 天试用。',
            commercialTitleTrialActive: '试用期有效，现在可以直接开始录制。',
            commercialTitleExpired: '试用已结束，订阅后继续录制。',
            commercialTitleSubscribed: 'Onvord Pro 已开通，现在可以直接开始录制。',
            commercialTitleSignIn: '先用 Google 登录，再开始 7 天试用。',
            commercialTitleError: '暂时无法加载你的使用状态。',
            commercialCopyReady: '已登录，可以直接开始录制。',
            commercialCopyTrial: '试用期内可以继续录制，订阅时也会自动绑定到当前账号。',
            commercialCopyExpired: '试用已结束，订阅后可继续录制。',
            commercialCopySignIn: '登录后即可开始 7 天试用，试用、订阅和权限都会绑定到你的账号。',
            commercialCopyError: '请稍后重试。如果刚安装完成，也可以先点击下方按钮登录 Google。',
            commercialNoteTrial: '',
            commercialNoteSubscribed: '',
            commercialNoteExpired: '',
            commercialCheckout: '去订阅',
            commercialPortal: '管理订阅'
        },
        en: {
            titleTagline: 'Operate while explaining<br>AI learns your workflow instantly',
            inst1: 'Open the page you want to demonstrate',
            inst2: 'Click start below to begin recording',
            inst3: 'Perform actions while explaining by voice',
            inst4: 'Generate SOP and share with AI',
            startRecording: 'Start Recording',
            settingsLink: 'Settings',
            recRecording: 'Recording',
            recDone: 'Recording Done',
            recPaused: 'Paused',
            sectionActionLog: 'Action Log',
            waitingPlaceholder: 'Waiting for actions or speech…',
            noPreview: 'No preview content',
            stopRecording: 'Stop Recording',
            pause: 'Pause',
            resume: 'Resume',
            exportSop: 'Copy SOP',
            downloadFullSop: 'Download Full SOP',
            recordAgain: 'Record Again',
            micStatusTitle: 'Speech Recognition',
            recognizing: 'Recognizing',
            screenshotPreview: 'Screenshot Preview',
            viewScreenshot: 'View Screenshot',
            actionFallback: 'Action',
            elementFallback: 'element',
            pageFallback: 'Page',
            keypressFallback: 'Shortcut',
            actionClick: 'Click {target}',
            actionInput: 'Type "{value}"',
            actionScroll: 'Scroll',
            actionScrollMerged: 'Scroll (merged {count})',
            actionSelect: 'Select "{value}"',
            actionClickElement: 'Click element',
            actionInputShort: 'Type',
            actionSelectShort: 'Select',
            actionNavigate: 'Navigate',
            clickPointScreenshot: 'Step {step} Screenshot',
            startNeedKey: 'Service Unavailable',
            startNeedBackend: 'Service Unavailable',
            startNeedSession: 'Reconnect Required',
            startNeedManaged: 'Managed Speech Unavailable',
            startNeedSubscription: 'Subscribe First',
            startNeedGoogle: 'Continue with Google',
            startNeedGoogleBusy: 'Opening Google sign-in…',
            startNeedMic: 'Enable Microphone Access',
            startProviderUnsupported: 'Selected provider is not supported yet',
            initStt: 'Initializing speech recognition…',
            toastWsDisconnected: 'Speech connection disconnected. Pause and resume to reconnect.',
            toastNeedSetupKey: 'Speech service is temporarily unavailable. Please try again later',
            toastNeedBackend: 'The service is temporarily unavailable. Please try again later',
            toastNeedSession: 'Your connection has expired. Reopen Onvord and try again',
            toastNeedManaged: 'Speech service is temporarily unavailable. Please try again later',
            toastNeedSubscription: 'The 7-day trial has ended. Subscribe to continue recording',
            toastCheckoutMissing: 'Checkout link is not configured yet',
            toastPortalMissing: 'Billing portal link is not configured yet',
            toastCheckoutLoginRequired: 'Sign in with Google before subscribing',
            toastCheckoutLoginContinue: 'Google connected. Continuing to checkout…',
            toastGoogleSigninFailed: 'Google sign-in failed. Please try again later',
            toastGoogleSigninCancelled: 'Google sign-in was cancelled',
            toastGoogleSigninSuccess: 'Google connected. You can start using Onvord now',
            toastSessionExpired: 'The current session is invalid or expired. Sign in again',
            toastSpeechSessionFailed: 'Unable to start speech recognition right now. Please try again later',
            toastMicDenied: 'Microphone permission denied. Cannot start recording',
            toastNoMic: 'No microphone device found. Cannot start recording',
            toastMicBusy: 'Microphone unavailable (possibly occupied). Cannot start recording',
            toastAliyunKeyInvalid: 'Speech service authorization failed. Please try again later',
            toastAliyunKeyFormat: 'Speech service initialization failed. Please try again',
            toastAliyunNetwork: 'Unable to connect to speech service. Check your network and retry',
            toastAliyunAuthRule: 'Speech service initialization failed. Reload the extension and retry',
            toastAliyunWsHandshake: 'Speech service connection failed. Please try again later',
            toastAliyunInitFailed: 'Speech service initialization failed. Please try again later',
            toastInitFailed: 'Speech recognition initialization failed. Cannot start recording',
            toastStartFailed: 'Failed to start',
            generating: 'Generating…',
            toastGenerateFailed: 'Failed to generate SOP',
            toastGenerateError: 'Generation failed',
            toastPaused: 'Paused',
            toastResumeSttFailed: 'Failed to resume speech recognition. Check microphone and network and retry',
            toastResumed: 'Recording resumed',
            toastPauseResumeFailed: 'Pause/Resume failed',
            exportSuccess: '✅ SOP copied to clipboard',
            downloadSuccess: '✅ Full SOP downloaded',
            toastCopyFailed: 'Failed to copy SOP',
            toastAutoStopped: 'Recording time limit reached. Stopped automatically',
            toastRestricted: 'Recording is unavailable on this page',
            recoveryPrompt: 'Found recording data from {ago} minutes ago ({count} action groups). Restore?',
            toastRecoverySttFailed: 'Failed to recover speech recognition',
            copySectionIntro: 'SOP Overview',
            copySectionNotes: 'Notes',
            copySectionOps: 'Operations',
            copyFieldStartUrl: 'Start page',
            copyFieldCreatedAt: 'Recorded at',
            copyFieldDuration: 'Duration',
            copyFieldStepCount: 'Action steps',
            copyFieldTime: 'Time',
            copyFieldPage: 'Page',
            copyNarrationTitle: 'Narration',
            copyEmptyOps: 'No action steps',
            exportStepAlt: 'Step {step}',
            exportAgentDetail: 'Execution Details (For Agent)',
            exportDocTitle: 'Document Notes',
            exportDocIntro: 'This document is automatically generated by Onvord and records the browser operation workflow.',
            exportHowToRead: 'How to read:',
            exportHowToReadItems: '• Each step includes an action description (e.g. click, input, select)<br>• <strong>Narration</strong>: voice explanation during operation, describing intent and context<br>• <strong>Screenshot</strong>: page screenshot at operation time with click marker<br>• <strong>Execution Details (For Agent)</strong>: CSS selector path of target element (collapsed by default) for automation replay',
            exportSummary: 'Summary:',
            exportSummaryLines: '• Start page: {startUrl}<br>• Recorded at: {createdAt}<br>• {steps} action steps, total duration {duration}',
            exportGeneratedBy: 'Generated by Onvord · {createdAt}',
            exportStepsUnit: 'steps',
            exportLang: 'en',
            commercialStatusTrialAvailable: 'Trial available',
            commercialStatusTrialActive: '{days} day(s) left in trial',
            commercialStatusExpired: 'Trial ended',
            commercialStatusSubscribed: 'Subscription active',
            commercialStatusSignIn: 'Sign in required',
            commercialStatusUnavailable: 'Temporarily unavailable',
            commercialTitleTrialAvailable: 'You are signed in. Your 7-day trial starts on the first recording.',
            commercialTitleTrialActive: 'Your trial is active. You can start recording now.',
            commercialTitleExpired: 'Your trial has ended. Subscribe to keep recording.',
            commercialTitleSubscribed: 'Onvord Pro is active. You can start recording now.',
            commercialTitleSignIn: 'Use Google first, then start your 7-day trial.',
            commercialTitleError: 'Unable to load your access right now.',
            commercialCopyReady: 'You are signed in and ready to record.',
            commercialCopyTrial: 'Your trial is active. Subscription will stay tied to this account later on.',
            commercialCopyExpired: 'No active access is available. Subscribe to continue recording.',
            commercialCopySignIn: 'Sign in to start your 7-day trial. Your trial, subscription, and access will stay tied to your account.',
            commercialCopyError: 'Please try again in a moment. If you just installed Onvord, you can start by signing in with Google below.',
            commercialNoteTrial: '',
            commercialNoteSubscribed: '',
            commercialNoteExpired: '',
            commercialCheckout: 'Subscribe',
            commercialPortal: 'Manage Subscription'
        }
    };

    function t(key, vars = {}) {
        const table = I18N[uiLocale] || I18N.en;
        let text = table[key] || I18N.en[key] || key;
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
        return text;
    }

    function setText(id, text) {
        const el = $(id);
        if (el) el.textContent = text;
    }

    function getCommercialUiState(entitlement) {
        if (!entitlement) return 'sign-in';
        if (!entitlement.authenticated && !entitlement.userEmail && !entitlement.trial?.started && !entitlement.subscription?.active) {
            return 'sign-in';
        }
        if (entitlement.userIsAnonymous || entitlement.accessSource === 'login-required') return 'sign-in';
        if (entitlement.reason === 'session-invalid') return 'sign-in';
        if (entitlement.reason === 'session-missing' || entitlement.reason === 'network-error') return 'sign-in';
        if (String(entitlement.reason || '').startsWith('bootstrap-')) return 'sign-in';
        if (entitlement.reason === 'api-base-missing') return 'unavailable';
        if (!entitlement.ok) return 'unavailable';
        if (entitlement.subscription?.active) return 'subscribed';
        if (entitlement.trial?.active) return 'trial-active';
        if (entitlement.trial?.started && !entitlement.trial?.active) return 'subscribe';
        if (entitlement.hasAccess) return 'trial-ready';
        return 'subscribe';
    }

    function formatCommercialStatus(entitlement) {
        const state = getCommercialUiState(entitlement);
        if (state === 'sign-in') return t('commercialStatusSignIn');
        if (state === 'subscribed') return t('commercialStatusSubscribed');
        if (state === 'trial-active') return t('commercialStatusTrialActive', { days: entitlement?.trial?.daysLeft || 0 });
        if (state === 'subscribe') return t('commercialStatusExpired');
        if (state === 'trial-ready') return t('commercialStatusTrialAvailable');
        return t('commercialStatusUnavailable');
    }

    function getCommercialTitle(entitlement) {
        const state = getCommercialUiState(entitlement);
        if (state === 'sign-in') return t('commercialTitleSignIn');
        if (state === 'subscribed') return t('commercialTitleSubscribed');
        if (state === 'trial-active') return t('commercialTitleTrialActive');
        if (state === 'subscribe') return t('commercialTitleExpired');
        if (state === 'trial-ready') return t('commercialTitleTrialAvailable');
        return t('commercialTitleError');
    }

    function getCommercialBannerVariant(entitlement) {
        const state = getCommercialUiState(entitlement);
        if (state === 'unavailable') return 'is-error';
        if (state === 'sign-in' || state === 'subscribe') return 'is-upgrade';
        return 'is-subscribed';
    }

    function renderCommercialBanner(settings, entitlement = null) {
        const commercialSettings = Commercial.fixedCommercialSettings({
            ...(settings || {}),
            commercialCheckoutUrl: entitlement?.checkoutUrl || settings?.commercialCheckoutUrl || '',
            commercialPortalUrl: entitlement?.portalUrl || settings?.commercialPortalUrl || ''
        });
        const state = getCommercialUiState(entitlement);
        commercialBannerEl?.classList.remove('hidden');
        commercialBannerEl?.classList.remove('is-subscribed', 'is-expired', 'is-upgrade', 'is-error');
        commercialBannerEl?.classList.add(getCommercialBannerVariant(entitlement));

        if (commercialStatusEl) {
            commercialStatusEl.textContent = formatCommercialStatus(entitlement);
            commercialStatusEl.classList.remove('warn', 'err');
            if (state === 'unavailable') {
                commercialStatusEl.classList.add('err');
            } else if (state === 'sign-in' || state === 'subscribe' || state === 'trial-ready' || state === 'trial-active') {
                commercialStatusEl.classList.add('warn');
            }
        }

        if (commercialTitleEl) {
            commercialTitleEl.textContent = getCommercialTitle(entitlement);
        }

        if (commercialCopyEl) {
            if (state === 'sign-in') {
                commercialCopyEl.textContent = t('commercialCopySignIn');
            } else if (state === 'subscribed') {
                commercialCopyEl.textContent = t('commercialCopyReady');
            } else if (state === 'trial-active') {
                commercialCopyEl.textContent = t('commercialCopyTrial');
            } else if (state === 'subscribe') {
                commercialCopyEl.textContent = t('commercialCopyExpired');
            } else if (state === 'trial-ready') {
                commercialCopyEl.textContent = `${t('commercialCopyReady')} ${t('commercialCopyTrial')}`;
            } else {
                commercialCopyEl.textContent = t('commercialCopyError');
            }
        }

        if (btnCommercialCheckout) {
            btnCommercialCheckout.dataset.action = state === 'sign-in' ? 'signin' : 'checkout';
            btnCommercialCheckout.textContent = state === 'sign-in'
                ? t('startNeedGoogle')
                : t('commercialCheckout');
            btnCommercialCheckout.disabled = false;
            btnCommercialCheckout.classList.toggle(
                'hidden',
                !(
                    ((state === 'subscribe' || state === 'trial-ready' || state === 'trial-active')
                        && Commercial.canOpenBilling('checkout', commercialSettings, entitlement))
                )
            );
        }
        if (btnCommercialPortal) {
            btnCommercialPortal.textContent = t('commercialPortal');
            btnCommercialPortal.disabled = false;
            btnCommercialPortal.classList.add('hidden');
        }
        if (commercialBannerActionsEl) {
            commercialBannerActionsEl.classList.toggle(
                'hidden',
                btnCommercialCheckout?.classList.contains('hidden') && btnCommercialPortal?.classList.contains('hidden')
            );
        }
    }

    function applyUiLocale() {
        document.documentElement.lang = uiLocale === 'zh' ? 'zh-CN' : 'en';
        const tagline = $('tagline');
        if (tagline) tagline.innerHTML = t('titleTagline');
        setText('inst-1', t('inst1'));
        setText('inst-2', t('inst2'));
        setText('inst-3', t('inst3'));
        setText('inst-4', t('inst4'));
        setText('link-settings', t('settingsLink'));
        setText('sec-title-text', t('sectionActionLog'));
        setText('timeline-placeholder', t('waitingPlaceholder'));
        micStatusEl?.setAttribute('title', t('micStatusTitle'));
        imgViewerCloseEl?.setAttribute('aria-label', t('screenshotPreview'));
        if (imgViewerImgEl) imgViewerImgEl.alt = t('screenshotPreview');
        showGoogleSigninButton();
        setPauseButton(false);
        if (btnStop) btnStop.innerHTML = `<span class="bi">⏹</span>${t('stopRecording')}`;
        if (btnExport) btnExport.textContent = t('exportSop');
        if (btnDownload) btnDownload.textContent = t('downloadFullSop');
        if (btnRedo) btnRedo.textContent = t('recordAgain');
        if (recLabelEl) recLabelEl.textContent = t('recRecording');
        renderCommercialBanner({}, {
            ok: true,
            hasAccess: false,
            accessSource: 'login-required',
            userIsAnonymous: true,
            trial: { started: false, active: false, expired: false, daysLeft: 0 },
            subscription: { active: false, status: 'inactive', endAt: 0 }
        });
    }

    /* ── Helpers ── */
    function switchView(v) {
        currentView = v;
        Object.entries(views).forEach(([k, el]) => {
            if (!el) return;
            el.classList.toggle('active', k === v);
        });
    }
    function fmtTime(ms) { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
    function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(() => toastEl.classList.remove('show'), 2000); }
    async function ensureGoogleAccountForCheckout() {
        const settings = await getSttSettings();
        const entitlement = await Commercial.fetchEntitlement(settings, { fresh: true });
        if (!entitlement.userIsAnonymous && entitlement.accessSource !== 'login-required') {
            return { ok: true, settings };
        }

        toast(t('toastCheckoutLoginRequired'));
        const signedIn = await signInForCommercialAccess(false);
        if (!signedIn) {
            return { ok: false };
        }
        toast(t('toastCheckoutLoginContinue'));
        return { ok: true, settings: await getSttSettings() };
    }
    async function openBillingUrl(kind) {
        let settings = await getSttSettings();
        if (kind === 'checkout') {
            const linked = await ensureGoogleAccountForCheckout();
            if (!linked.ok) return;
            settings = linked.settings || settings;
        }
        const link = await Commercial.createBillingLink(settings, kind);
        if (!link.ok || !link.url) {
            toast(t(kind === 'portal' ? 'toastPortalMissing' : 'toastCheckoutMissing'));
            return;
        }
        try {
            await chrome.tabs.create({ url: link.url });
        } catch {
            toast(t(kind === 'portal' ? 'toastPortalMissing' : 'toastCheckoutMissing'));
        }
    }

    async function handleCommercialPrimaryAction() {
        const action = String(btnCommercialCheckout?.dataset.action || '').trim();
        if (action === 'signin') {
            await signInForCommercialAccess();
            return;
        }
        await openBillingUrl('checkout');
    }
    function normalizeNarrationText(text) {
        return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    }
    function isMeaningfulNarration(text) {
        const normalized = normalizeNarrationText(text);
        if (!normalized) return false;
        const core = normalized.replace(/[.。,…，、!！?？~～\-—_·•:：;；'"`“”‘’()（）[\]【】{}<>《》|\\/+=*&^%$#@\s]/g, '');
        return core.length > 0;
    }
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function safeFilename(name) {
        return String(name || 'SOP')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 120);
    }
    function normalizeExternalUrl(url) {
        if (!url) return '';
        try {
            const u = new URL(url);
            if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
        } catch { /* noop */ }
        return '';
    }
    function normalizeImageSrc(src) {
        const s = String(src || '');
        if (s.startsWith('data:image/')) return s;
        if (s.startsWith('http://') || s.startsWith('https://')) return s;
        return '';
    }
    function openMicPermissionGuide() {
        try {
            chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission.html') });
        } catch (e) {
            console.warn('Open mic permission guide failed:', e);
        }
    }

    let isPaused = false;
    let pausedDuration = 0;
    const RECORDING_LIMIT_MS = 10 * 60 * 1000;

    function evIcon(t) {
        switch (t) {
            case 'click': return '👆';
            case 'input': return '⌨️';
            case 'navigate': case 'navigation': return '🔗';
            case 'scroll': return '📍';
            case 'select': return '📋';
            case 'keypress': return '⌨️';
            default: return '⚡';
        }
    }

    function updateTimerDisplay(elapsedMs) {
        recTimer.textContent = fmtTime(elapsedMs);
        recTimer.classList.toggle('warn', (RECORDING_LIMIT_MS - elapsedMs) <= 30000);
    }

    /* ── Audio Volume Visualizer ── */
    function startVolumeVis(stream) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            const src = audioCtx.createMediaStreamSource(stream);
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            volIndicator?.classList.add('active');

            function draw() {
                volAnimId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(data);
                const bands = [2, 4, 6, 8, 10];
                for (let i = 0; i < volBars.length; i++) {
                    const val = data[bands[i]] || 0;
                    const h = Math.max(3, (val / 255) * 14);
                    volBars[i].style.height = h + 'px';
                }
            }
            draw();
        } catch (e) { console.warn('Volume vis failed:', e); }
    }

    function stopVolumeVis() {
        if (volAnimId) { cancelAnimationFrame(volAnimId); volAnimId = null; }
        if (audioCtx) { audioCtx.close().catch(() => { }); audioCtx = null; analyser = null; }
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
        volIndicator?.classList.remove('active');
        volBars.forEach(b => b.style.height = '3px');
    }

    /* ── Speech-to-Text Engine ── */
    const STT_PROVIDER = {
        ALIYUN: 'aliyun'
    };
    const STT_SETTINGS_KEYS = [...Commercial.STORAGE_KEYS];
    const STT_SETTINGS_DEFAULTS = {
        commercialLanguage: 'zh-CN',
        commercialLastSpeechProvider: STT_PROVIDER.ALIYUN
    };
    const ALIYUN_WS_AUTH_RULE_IDS = [391001, 391002, 391003];
    const ALIYUN_WS_AUTH_HOSTS = [
        'dashscope.aliyuncs.com',
        'dashscope-us.aliyuncs.com',
        'dashscope-intl.aliyuncs.com'
    ];
    let sttEngine = null;
    let sttSocket = null;
    let aliyunAudioCtx = null;
    let aliyunAudioSource = null;
    let aliyunAudioProcessor = null;
    let aliyunAudioSink = null;
    let aliyunAudioProcessorMode = '';
    let sttStream = null;
    let sttLastFailure = '';
    let preferredMicDeviceId = '';
    let pendingInterimNarration = '';
    let lastFinalNarrationText = '';

    async function ensureMicPermission() {
        const permissionState = await navigator.permissions.query({ name: 'microphone' })
            .then(r => r.state)
            .catch(() => 'unknown');
        const audioInputs = await navigator.mediaDevices.enumerateDevices()
            .then(list => list.filter(d => d.kind === 'audioinput'))
            .catch(() => []);
        console.info('Onvord mic permission state:', permissionState);
        console.info('Onvord audioinput devices:', audioInputs.map((d, i) => ({
            idx: i,
            label: d.label || '(no-label)',
            idTail: (d.deviceId || '').slice(-8)
        })));

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const defaultTrack = stream.getAudioTracks()[0];
            const defaultId = defaultTrack?.getSettings?.().deviceId || '';
            if (defaultId) preferredMicDeviceId = defaultId;
            stream.getTracks().forEach(t => t.stop());
            return { ok: true };
        } catch (e) {
            const name = e?.name || 'unknown';
            console.warn('Microphone permission preflight failed:', name, e?.message || '');
            if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
                // Fallback: default input may be stale/unavailable, retry each concrete input device id.
                for (const dev of audioInputs) {
                    if (!dev.deviceId) continue;
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                            audio: { deviceId: { exact: dev.deviceId } }
                        });
                        stream.getTracks().forEach(t => t.stop());
                        preferredMicDeviceId = dev.deviceId;
                        return { ok: true };
                    } catch { /* try next device */ }
                }
            }
            return { ok: false, error: name, permissionState, deviceCount: audioInputs.length };
        }
    }

    async function getMicStreamForUse() {
        if (preferredMicDeviceId) {
            try {
                return await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: preferredMicDeviceId } }
                });
            } catch {
                preferredMicDeviceId = '';
            }
        }
        return await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    function normalizeAliyunLanguage(lang) {
        return lang === 'en-US' ? 'en' : 'zh';
    }

    function normalizeAliyunRegion(region) {
        if (region === 'intl' || region === 'us') return region;
        return 'cn';
    }

    function getAliyunRegionCandidates(preferredRegion) {
        const first = normalizeAliyunRegion(preferredRegion);
        return Array.from(new Set([first, 'cn', 'us', 'intl']));
    }

    function getAliyunHost(region) {
        const normalized = normalizeAliyunRegion(region);
        if (normalized === 'intl') return 'dashscope-intl.aliyuncs.com';
        if (normalized === 'us') return 'dashscope-us.aliyuncs.com';
        return 'dashscope.aliyuncs.com';
    }

    function getAliyunRealtimeWsAttempts(region, model, apiKey, options = {}) {
        const { preferHeaderAuth = false } = options;
        const host = getAliyunHost(region);
        const encodedModel = encodeURIComponent(model);
        const keyProtocol = `openai-insecure-api-key.${apiKey}`;
        const betaProtocol = 'openai-beta.realtime-v1';
        const attempts = [];

        if (preferHeaderAuth) {
            attempts.push(
                {
                    label: 'apiws-header-auth',
                    url: `wss://${host}/api-ws/v1/realtime?model=${encodedModel}`,
                    protocols: []
                },
                {
                    label: 'apiws-header-auth-beta-subprotocol',
                    url: `wss://${host}/api-ws/v1/realtime?model=${encodedModel}`,
                    protocols: [betaProtocol]
                },
                {
                    label: 'compatible-header-auth',
                    url: `wss://${host}/compatible-mode/v1/realtime?model=${encodedModel}`,
                    protocols: []
                },
                {
                    label: 'compatible-ws-header-auth',
                    url: `wss://${host}/compatible-mode/v1/realtime/ws?model=${encodedModel}`,
                    protocols: []
                }
            );
        }

        attempts.push(
            {
                label: 'compatible-ws-subprotocol',
                url: `wss://${host}/compatible-mode/v1/realtime/ws?model=${encodedModel}`,
                protocols: [keyProtocol, betaProtocol]
            },
            {
                label: 'compatible-subprotocol',
                url: `wss://${host}/compatible-mode/v1/realtime?model=${encodedModel}`,
                protocols: [keyProtocol, betaProtocol]
            },
            {
                label: 'compatible-ws-subprotocol-legacy',
                url: `wss://${host}/compatible-mode/v1/realtime/ws?model=${encodedModel}`,
                protocols: ['realtime', keyProtocol, betaProtocol]
            },
            {
                label: 'apiws-subprotocol',
                url: `wss://${host}/api-ws/v1/realtime?model=${encodedModel}`,
                protocols: [keyProtocol, betaProtocol]
            },
        );
        return attempts;
    }

    function sanitizeAliyunWsLog(wsUrl, protocols) {
        const safeUrl = String(wsUrl || '').replace(/([?&](?:api[-_]?key)=)[^&]+/ig, '$1***');
        const safeProtocols = (Array.isArray(protocols) ? protocols : []).map((item) => {
            const text = String(item || '');
            if (text.startsWith('openai-insecure-api-key.')) return 'openai-insecure-api-key.***';
            return text;
        });
        return { safeUrl, safeProtocols };
    }

    function getAliyunWsRuleRegex(host) {
        const escaped = String(host || '').replace(/\./g, '\\.');
        return `^wss://${escaped}/(?:api-ws/v1/realtime|compatible-mode/v1/realtime(?:/ws)?)\\?.*`;
    }

    async function applyAliyunWsAuthRules(apiKey) {
        const dnr = chrome.declarativeNetRequest;
        if (!dnr?.updateSessionRules) {
            return { ok: false, reason: 'dnr-unavailable' };
        }
        const bearer = `Bearer ${apiKey}`;
        const addRules = ALIYUN_WS_AUTH_RULE_IDS.map((id, idx) => ({
            id,
            priority: 10,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'Authorization', operation: 'set', value: bearer },
                    { header: 'OpenAI-Beta', operation: 'set', value: 'realtime=v1' }
                ]
            },
            condition: {
                regexFilter: getAliyunWsRuleRegex(ALIYUN_WS_AUTH_HOSTS[idx]),
                resourceTypes: ['websocket']
            }
        }));
        try {
            await dnr.updateSessionRules({ removeRuleIds: ALIYUN_WS_AUTH_RULE_IDS, addRules });
            return { ok: true, reason: 'ok' };
        } catch (e) {
            console.warn('Aliyun WS auth rule apply failed:', String(e?.message || e || ''));
            return { ok: false, reason: 'dnr-update-failed' };
        }
    }

    function clearAliyunWsAuthRules() {
        const dnr = chrome.declarativeNetRequest;
        if (!dnr?.updateSessionRules) return;
        dnr.updateSessionRules({ removeRuleIds: ALIYUN_WS_AUTH_RULE_IDS }).catch(() => { });
    }


    function getAliyunProbeBase(region) {
        return `https://${getAliyunHost(region)}`;
    }

    function containsNonLatin1(text) {
        const value = String(text || '');
        for (let i = 0; i < value.length; i++) {
            if (value.charCodeAt(i) > 255) return true;
        }
        return false;
    }

    function normalizeCredentialValue(value) {
        return String(value || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, '')
            .trim();
    }

    async function getSttSettings() {
        const data = await new Promise(resolve => chrome.storage.local.get(STT_SETTINGS_KEYS, resolve));
        return Commercial.fixedCommercialSettings({
            ...STT_SETTINGS_DEFAULTS,
            ...(data || {})
        });
    }

    function hasProviderCredential(settings) {
        return Commercial.hasBackendConfig(settings);
    }

    function sttMissingCredentialReason(provider, settings) {
        if (!Commercial.hasBackendConfig(settings)) return 'commercial-backend-missing';
        return 'commercial-managed-credential-missing';
    }

    function emitVoiceStarted(audioStartHint) {
        updateListeningPlaceholder();
        chrome.runtime.sendMessage({
            type: 'VOICE_STARTED',
            timestamp: Date.now() - startTime,
            audio_start: audioStartHint || (Date.now() - startTime)
        }).catch(() => { });
    }

    function emitVoiceEnded() {
        const interim = evList.querySelector('.tl-narration-interim');
        if (interim) interim.remove();
        chrome.runtime.sendMessage({ type: 'VOICE_ENDED', timestamp: Date.now() - startTime }).catch(() => { });
    }

    function emitFinalNarration(text) {
        const transcript = normalizeNarrationText(text);
        if (!isMeaningfulNarration(transcript)) return;
        pendingInterimNarration = '';
        const ts = Date.now() - startTime;
        lastFinalNarrationText = transcript;
        chrome.runtime.sendMessage({ type: 'NARRATION_EVENT', text: transcript, timestamp: ts, isFinal: true }).catch(() => { });
        appendNarrationToTimeline(transcript, ts);
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        const chunk = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function downsampleFloat32(input, inputRate, outputRate) {
        if (inputRate === outputRate) return input;
        if (outputRate > inputRate) return input;
        const ratio = inputRate / outputRate;
        const length = Math.max(1, Math.round(input.length / ratio));
        const output = new Float32Array(length);
        let outIdx = 0;
        let inIdx = 0;
        while (outIdx < length) {
            const nextInIdx = Math.min(input.length, Math.round((outIdx + 1) * ratio));
            let sum = 0;
            let count = 0;
            for (let i = inIdx; i < nextInIdx; i++) {
                sum += input[i];
                count += 1;
            }
            output[outIdx] = count ? (sum / count) : 0;
            outIdx += 1;
            inIdx = nextInIdx;
        }
        return output;
    }

    function float32ToPcm16Bytes(input) {
        const out = new Uint8Array(input.length * 2);
        const view = new DataView(out.buffer);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            const v = s < 0 ? s * 0x8000 : s * 0x7FFF;
            view.setInt16(i * 2, v, true);
        }
        return out;
    }

    function stopAliyunPcmCapture() {
        if (aliyunAudioProcessor) {
            try { aliyunAudioProcessor.disconnect(); } catch { /* noop */ }
            if ('onaudioprocess' in aliyunAudioProcessor) {
                aliyunAudioProcessor.onaudioprocess = null;
            }
            if (aliyunAudioProcessor.port) {
                try { aliyunAudioProcessor.port.onmessage = null; } catch { /* noop */ }
                try { aliyunAudioProcessor.port.close(); } catch { /* noop */ }
            }
            aliyunAudioProcessor = null;
            aliyunAudioProcessorMode = '';
        }
        if (aliyunAudioSource) {
            try { aliyunAudioSource.disconnect(); } catch { /* noop */ }
            aliyunAudioSource = null;
        }
        if (aliyunAudioSink) {
            try { aliyunAudioSink.disconnect(); } catch { /* noop */ }
            aliyunAudioSink = null;
        }
        if (aliyunAudioCtx) {
            aliyunAudioCtx.close().catch(() => { });
            aliyunAudioCtx = null;
        }
    }

    function appendAliyunPcmChunk(socket, inRate, float32Samples) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        if (!(float32Samples instanceof Float32Array) || float32Samples.length === 0) return;
        const mono = downsampleFloat32(float32Samples, inRate, 16000);
        if (!mono || mono.length === 0) return;
        const pcm16 = float32ToPcm16Bytes(mono);
        if (!pcm16.byteLength) return;
        try {
            const audio = arrayBufferToBase64(pcm16.buffer);
            socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
        } catch (e) {
            console.warn('Aliyun PCM append failed:', String(e?.message || e || ''));
        }
    }

    function formatAliyunRealtimeError(msg) {
        const error = msg?.error || {};
        return {
            type: String(error?.type || msg?.type || '').trim(),
            code: String(error?.code || '').trim(),
            message: String(error?.message || '').trim(),
            param: String(error?.param || '').trim(),
            eventId: String(error?.event_id || msg?.event_id || '').trim()
        };
    }

    async function startAliyunPcmCapture(stream, socket) {
        stopAliyunPcmCapture();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return { ok: false, reason: 'aliyun-audiocontext-unavailable' };
        try {
            aliyunAudioCtx = new Ctx({ sampleRate: 16000 });
        } catch {
            aliyunAudioCtx = new Ctx();
        }

        try {
            await aliyunAudioCtx.resume();
        } catch { /* noop */ }

        const inRate = aliyunAudioCtx.sampleRate || 48000;
        aliyunAudioSource = aliyunAudioCtx.createMediaStreamSource(stream);
        aliyunAudioSink = aliyunAudioCtx.createGain();
        aliyunAudioSink.gain.value = 0;

        const supportsAudioWorklet = Boolean(aliyunAudioCtx.audioWorklet?.addModule && window.AudioWorkletNode);
        if (supportsAudioWorklet) {
            try {
                await aliyunAudioCtx.audioWorklet.addModule(chrome.runtime.getURL('aliyun-pcm-worklet.js'));
                aliyunAudioProcessor = new AudioWorkletNode(aliyunAudioCtx, 'aliyun-pcm-capture', {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [1],
                    channelCount: 1,
                    channelCountMode: 'explicit',
                    processorOptions: {
                        frameSize: 4096
                    }
                });
                aliyunAudioProcessor.port.onmessage = (event) => {
                    const buffer = event?.data;
                    if (!(buffer instanceof ArrayBuffer)) return;
                    appendAliyunPcmChunk(socket, inRate, new Float32Array(buffer));
                };
                aliyunAudioSource.connect(aliyunAudioProcessor);
                aliyunAudioProcessor.connect(aliyunAudioSink);
                aliyunAudioSink.connect(aliyunAudioCtx.destination);
                aliyunAudioProcessorMode = 'audio-worklet';
            } catch (e) {
                console.warn('Aliyun AudioWorklet init failed, falling back to ScriptProcessorNode:', String(e?.message || e || ''));
            }
        }

        if (!aliyunAudioProcessor) {
            aliyunAudioProcessor = aliyunAudioCtx.createScriptProcessor(4096, 1, 1);
            aliyunAudioSource.connect(aliyunAudioProcessor);
            aliyunAudioProcessor.connect(aliyunAudioSink);
            aliyunAudioSink.connect(aliyunAudioCtx.destination);
            aliyunAudioProcessor.onaudioprocess = (event) => {
                appendAliyunPcmChunk(socket, inRate, event.inputBuffer.getChannelData(0));
            };
            aliyunAudioProcessorMode = 'script-processor';
        }

        console.info('Aliyun PCM capture started:', {
            mode: aliyunAudioProcessorMode || 'unknown',
            inputSampleRate: inRate,
            outputSampleRate: 16000
        });
        return { ok: true, reason: 'ok' };
    }

    async function probeAliyun(apiKey, region) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        try {
            const res = await fetch(`${getAliyunProbeBase(region)}/compatible-mode/v1/models`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${apiKey}` },
                signal: ctrl.signal
            });
            if (res.ok) return { ok: true, reason: 'ok' };
            if (res.status === 401 || res.status === 403) return { ok: false, reason: 'aliyun-key-invalid', status: res.status };
            return { ok: false, reason: 'aliyun-server', status: res.status };
        } catch (e) {
            const msg = String(e?.message || e || '');
            if (/ISO-8859-1|code point/i.test(msg)) return { ok: false, reason: 'aliyun-key-format-invalid' };
            if (e?.name === 'AbortError') return { ok: false, reason: 'aliyun-network-timeout' };
            return { ok: false, reason: 'aliyun-network' };
        } finally {
            clearTimeout(t);
        }
    }

    async function probeAliyunWithFallback(apiKey, preferredRegion) {
        let best = { ok: false, reason: 'aliyun-network' };
        let sawAuthFailure = false;
        let authFailureRegion = normalizeAliyunRegion(preferredRegion);
        for (const region of getAliyunRegionCandidates(preferredRegion)) {
            const current = await probeAliyun(apiKey, region);
            if (current.ok) return { ...current, region };
            if (current.reason === 'aliyun-key-invalid') {
                sawAuthFailure = true;
                authFailureRegion = region;
                continue;
            }
            if (current.reason === 'aliyun-key-format-invalid') return { ...current, region };
            if (current.reason === 'aliyun-server') best = { ...current, region };
            if ((current.reason === 'aliyun-network' || current.reason === 'aliyun-network-timeout') && best.reason !== 'aliyun-server') {
                best = { ...current, region };
            }
        }
        if (sawAuthFailure) return { ok: false, reason: 'aliyun-key-invalid', region: authFailureRegion };
        return best;
    }

    function extractAliyunTranscript(msg) {
        const candidates = [
            msg?.transcript,
            msg?.transcript?.text,
            msg?.text,
            msg?.delta,
            msg?.output_text,
            msg?.response?.transcript,
            msg?.response?.text,
            msg?.response?.output_text,
            msg?.item?.content?.[0]?.transcript,
            msg?.item?.content?.[0]?.text,
            msg?.item?.content?.[0]?.output_text,
            msg?.item?.input_audio_transcription?.text
        ];
        for (const raw of candidates) {
            const text = normalizeNarrationText(raw || '');
            if (isMeaningfulNarration(text)) return text;
        }
        return '';
    }

    function isAliyunFinalEvent(msg) {
        const type = String(msg?.type || '');
        if (msg?.is_final === true) return true;
        return /completed|done|final|finished/i.test(type);
    }

    async function initAliyunWithRegion(stream, settings, micStatusEl, region) {
        const apiKey = String(settings.aliyunKey || '').trim();
        if (containsNonLatin1(apiKey)) {
            return { ok: false, reason: 'aliyun-key-format-invalid', region: normalizeAliyunRegion(region) };
        }
        const model = String(settings.aliyunModel || STT_SETTINGS_DEFAULTS.aliyunModel).trim() || STT_SETTINGS_DEFAULTS.aliyunModel;
        const normalizedRegion = normalizeAliyunRegion(region);
        const lang = normalizeAliyunLanguage(settings.sttLanguage || settings.commercialLanguage);
        const authRule = await applyAliyunWsAuthRules(apiKey);
        console.info('Aliyun WS auth rule:', {
            ok: authRule.ok,
            reason: authRule.reason,
            region: normalizedRegion
        });
        const wsAttempts = getAliyunRealtimeWsAttempts(normalizedRegion, model, apiKey, {
            preferHeaderAuth: authRule.ok
        });
        let lastFailure = { ok: false, reason: 'aliyun-init-failed', region: normalizedRegion };

        for (const attempt of wsAttempts) {
            const { safeUrl, safeProtocols } = sanitizeAliyunWsLog(attempt.url, attempt.protocols);
            console.info('Aliyun WS attempt:', {
                region: normalizedRegion,
                mode: attempt.label,
                url: safeUrl,
                protocols: safeProtocols
            });

            try {
                sttSocket = new WebSocket(attempt.url, attempt.protocols);
            } catch (e) {
                console.error('Aliyun WS constructor error:', {
                    region: normalizedRegion,
                    mode: attempt.label,
                    error: String(e?.message || e || '')
                });
                lastFailure = { ok: false, reason: 'aliyun-ws-constructor', region: normalizedRegion, attempt: attempt.label };
                continue;
            }

            const attemptResult = await new Promise((resolve) => {
                let settled = false;
                let opened = false;
                let speechActive = false;
                const finish = (ok, reason, meta = {}) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(handshakeTimer);
                    resolve({ ok, reason, region: normalizedRegion, attempt: attempt.label, ...meta });
                };
                const handshakeTimer = setTimeout(() => {
                    try { sttSocket?.close(); } catch { /* noop */ }
                    finish(false, 'aliyun-ws-timeout');
                }, 9000);

                sttSocket.onopen = () => {
                    opened = true;
                    console.log('Aliyun realtime connected:', normalizedRegion, attempt.label);
                    try {
                        sttSocket.send(JSON.stringify({
                            type: 'session.update',
                            session: {
                                modalities: ['text'],
                                input_audio_format: 'pcm',
                                input_audio_transcription: {
                                    model,
                                    language: lang
                                },
                                turn_detection: {
                                    type: 'server_vad',
                                    threshold: 0,
                                    silence_duration_ms: 600
                                },
                                sample_rate: 16000
                            }
                        }));
                    } catch (e) {
                        console.warn('Aliyun session.update failed:', e);
                    }

                    try {
                        startAliyunPcmCapture(stream, sttSocket).then((captureResult) => {
                            if (!captureResult.ok) {
                                if (micStatusEl) micStatusEl.classList.add('error');
                                finish(false, captureResult.reason || 'aliyun-audio-capture-failed');
                                return;
                            }
                            finish(true, 'ok');
                        }).catch((err) => {
                            console.error('Aliyun PCM capture init failed:', err);
                            if (micStatusEl) micStatusEl.classList.add('error');
                            finish(false, 'aliyun-audio-capture-failed');
                        });
                    } catch (e) {
                        console.error('Aliyun audio capture error:', e);
                        if (micStatusEl) micStatusEl.classList.add('error');
                        finish(false, 'aliyun-audio-capture-failed');
                    }
                };

                sttSocket.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        const type = String(msg?.type || '');
                        if (type === 'input_audio_buffer.speech_started') {
                            if (!speechActive) {
                                speechActive = true;
                                emitVoiceStarted(Date.now() - startTime);
                            }
                            return;
                        }
                        if (type === 'input_audio_buffer.speech_stopped') {
                            if (speechActive) {
                                speechActive = false;
                                emitVoiceEnded();
                            }
                            return;
                        }
                        if (type === 'session.finished') {
                            if (sttSocket?.__onvordExpectedClose && sttSocket.readyState === WebSocket.OPEN) {
                                try { sttSocket.close(1000, 'client-stop'); } catch { /* noop */ }
                            }
                            return;
                        }
                        if (type === 'error') {
                            console.error('Aliyun realtime error:', formatAliyunRealtimeError(msg), msg);
                            return;
                        }
                        const transcript = extractAliyunTranscript(msg);
                        if (!transcript) return;
                        if (!speechActive) {
                            speechActive = true;
                            emitVoiceStarted(Date.now() - startTime);
                        }
                        if (isAliyunFinalEvent(msg)) {
                            emitFinalNarration(transcript);
                        } else {
                            pendingInterimNarration = '';
                        }
                    } catch { /* ignore */ }
                };

                sttSocket.onerror = (e) => {
                    const stateMap = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
                    console.error('Aliyun WS error:', {
                        readyState: stateMap[e?.target?.readyState ?? 3] || String(e?.target?.readyState),
                        url: safeUrl,
                        protocols: safeProtocols,
                        eventType: e?.type || 'error',
                        region: normalizedRegion,
                        mode: attempt.label
                    });
                    if (!opened) finish(false, 'aliyun-ws-error');
                };

                sttSocket.onclose = (e) => {
                    const closedByExpectedFlow = Boolean(e?.target?.__onvordExpectedClose);
                    console.log('Aliyun WS closed:', {
                        code: e.code,
                        reason: e.reason || '',
                        region: normalizedRegion,
                        mode: attempt.label,
                        expected: closedByExpectedFlow
                    });
                    if (!opened) {
                        if (closedByExpectedFlow) {
                            finish(false, 'aliyun-ws-closed-by-client');
                            return;
                        }
                        finish(false, `aliyun-ws-close-${e.code || 'unknown'}`, { closeCode: e.code || 0 });
                        return;
                    }
                    if (!closedByExpectedFlow && currentView === 'recording' && !isPaused && e.code !== 1000) {
                        if (micStatusEl) micStatusEl.classList.add('error');
                        toast(t('toastWsDisconnected'));
                    }
                };
            });

            if (attemptResult.ok) return attemptResult;
            if (attemptResult.reason === 'aliyun-ws-closed-by-client') return attemptResult;
            lastFailure = attemptResult;

            try {
                if (sttSocket && sttSocket.readyState !== WebSocket.CLOSED) sttSocket.close();
            } catch { /* noop */ }
            sttSocket = null;
        }

        if (micStatusEl) micStatusEl.classList.add('error');
        if (!authRule.ok && String(lastFailure.reason || '').startsWith('aliyun-ws-')) {
            return { ok: false, reason: 'aliyun-auth-rule-unavailable', region: normalizedRegion };
        }
        return lastFailure;
    }

    async function initAliyun(stream, settings, micStatusEl) {
        let bestFail = { ok: false, reason: 'aliyun-init-failed' };
        for (const region of getAliyunRegionCandidates(settings.aliyunRegion)) {
            const current = await initAliyunWithRegion(stream, settings, micStatusEl, region);
            if (current.ok) {
                if (normalizeAliyunRegion(settings.aliyunRegion) !== current.region) {
                    chrome.storage.local.set({ aliyunRegion: current.region }).catch(() => { });
                }
                return current;
            }
            if (current.reason === 'aliyun-ws-closed-by-client') return current;
            bestFail = current;
        }
        return bestFail;
    }

    function flushPendingInterimNarration() {
        const text = normalizeNarrationText(pendingInterimNarration || '');
        if (!isMeaningfulNarration(text)) {
            pendingInterimNarration = '';
            return;
        }
        if (text === lastFinalNarrationText) {
            pendingInterimNarration = '';
            return;
        }
        const ts = Date.now() - startTime;
        pendingInterimNarration = '';
        lastFinalNarrationText = text;
        chrome.runtime.sendMessage({ type: 'NARRATION_EVENT', text, timestamp: ts, isFinal: true }).catch(() => { });
        appendNarrationToTimeline(text, ts);
    }

    function stopSTT(options = {}) {
        const { flushInterim = true } = options;
        const interim = evList.querySelector('.tl-narration-interim');
        if (interim) interim.remove();
        if (flushInterim) {
            flushPendingInterimNarration();
        } else {
            pendingInterimNarration = '';
            lastFinalNarrationText = '';
        }
        stopAliyunPcmCapture();
        if (sttStream) {
            sttStream.getTracks().forEach(t => t.stop());
            sttStream = null;
        }
        if (sttSocket) {
            const ws = sttSocket;
            ws.__onvordExpectedClose = true;
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({
                        event_id: `event_${Date.now()}`,
                        type: 'session.finish'
                    }));
                } catch { /* noop */ }
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try { ws.close(1000, 'client-stop'); } catch { /* noop */ }
                    }
                }, 1200);
            } else if (ws.readyState === WebSocket.CONNECTING) {
                try { ws.close(1000, 'client-stop'); } catch { /* noop */ }
            }
            sttSocket = null;
        }
        clearAliyunWsAuthRules();
        sttEngine = null;
    }

    async function initSTT() {
        stopSTT({ flushInterim: false });
        sttLastFailure = '';
        micStatusEl?.classList.remove('error');

        const settings = await getSttSettings();
        if (!hasProviderCredential(settings)) {
            sttLastFailure = sttMissingCredentialReason(settings.sttProvider, settings);
            micStatusEl?.classList.add('error');
            return false;
        }

        try {
            const speechSessionPromise = Commercial.fetchSpeechSession(settings);
            const mic = await ensureMicPermission();
            if (!mic.ok) {
                if (mic.error === 'NotFoundError' || mic.error === 'DevicesNotFoundError') {
                    if (mic.permissionState === 'denied') {
                        sttLastFailure = 'mic-denied';
                    } else {
                        sttLastFailure = 'no-mic-device';
                    }
                } else if (mic.error === 'NotReadableError' || mic.error === 'TrackStartError' || mic.error === 'AbortError') {
                    sttLastFailure = 'mic-unavailable';
                } else {
                    sttLastFailure = 'mic-denied';
                }
                micStatusEl?.classList.add('error');
                return false;
            }
            sttStream = await getMicStreamForUse();

            const speechSession = await speechSessionPromise;
            if (!speechSession.ok) {
                sttStream.getTracks().forEach(t => t.stop());
                sttStream = null;
                if (speechSession.reason === 'api-base-missing') {
                    sttLastFailure = 'commercial-backend-missing';
                } else if (speechSession.reason === 'session-missing') {
                    sttLastFailure = 'commercial-session-missing';
                } else if (speechSession.reason === 'session-invalid') {
                    sttLastFailure = 'commercial-session-invalid';
                } else if (speechSession.reason === 'google-login-required') {
                    sttLastFailure = 'commercial-google-login-required';
                } else if (speechSession.reason === 'subscription-required') {
                    const latestEntitlement = await Commercial.fetchEntitlement(settings, { fresh: true });
                    renderCommercialBanner(settings, latestEntitlement);
                    sttLastFailure = 'commercial-subscription-required';
                } else {
                    sttLastFailure = 'commercial-speech-session-failed';
                }
                micStatusEl?.classList.add('error');
                return false;
            }

            const aliyunSettings = {
                aliyunKey: String(speechSession.token || speechSession.apiKey || '').trim(),
                aliyunRegion: speechSession.region || 'cn',
                aliyunModel: speechSession.model || 'qwen3-asr-flash-realtime',
                sttLanguage: speechSession.language || settings.commercialLanguage
            };
            if (containsNonLatin1(aliyunSettings.aliyunKey)) {
                sttStream.getTracks().forEach(t => t.stop());
                sttStream = null;
                sttLastFailure = 'aliyun-key-format-invalid';
                micStatusEl?.classList.add('error');
                return false;
            }
            const aliyunStarted = await initAliyun(sttStream, aliyunSettings, micStatusEl);
            if (!aliyunStarted.ok) {
                sttStream.getTracks().forEach(t => t.stop());
                sttStream = null;
                const startedReason = String(aliyunStarted.reason || '');
                const wsInitFailed = startedReason.startsWith('aliyun-ws-') || aliyunStarted.reason === 'aliyun-audio-capture-failed';
                if (aliyunStarted.reason === 'aliyun-auth-rule-unavailable') {
                    sttLastFailure = 'aliyun-auth-rule-unavailable';
                } else if (wsInitFailed) {
                    sttLastFailure = 'aliyun-ws-handshake-failed';
                } else {
                    sttLastFailure = aliyunStarted.reason || 'aliyun-init-failed';
                }
                micStatusEl?.classList.add('error');
                return false;
            }
            sttEngine = STT_PROVIDER.ALIYUN;
            return true;
        } catch (e) {
            console.error('STT init failed:', e);
            sttLastFailure = 'commercial-speech-session-failed';
            micStatusEl?.classList.add('error');
            return false;
        }
    }

    /* ── Hybrid Timeline ── */
    // Narration: full-width blocks. If last item is narration, append to it.
    // Actions: inline pills inside a flex container. If last item is an action container, add pill to it.

    function clearPlaceholder() {
        const ph = evList.querySelector('.placeholder'); if (ph) ph.remove();
    }

    function getLastTimelineItem() {
        return evList.lastElementChild;
    }

    function setInterimNarrationState(span, text, isStatus = false) {
        if (!span) return;
        span.classList.add('voice-interim');
        span.classList.toggle('voice-interim-status', Boolean(isStatus));
        span.textContent = text;
    }

    function appendNarrationToTimeline(text, timestamp) {
        const normalized = normalizeNarrationText(text);
        if (!isMeaningfulNarration(normalized)) return;
        clearPlaceholder();

        // Check for interim narration — convert it in-place (preserves position in timeline)
        // This prevents speech from jumping to the end when actions arrive during STT latency
        const interim = evList.querySelector('.tl-narration-interim');
        if (interim) {
            const prev = interim.previousElementSibling;
            // If there are no actions between two speech chunks, merge into the previous narration block.
            if (prev && prev.classList.contains('tl-narration') && !prev.classList.contains('tl-narration-interim')) {
                const prevSpan = prev.querySelector('.tl-narr-text');
                if (prevSpan) {
                    prevSpan.textContent = normalizeNarrationText(`${prevSpan.textContent || ''} ${normalized}`);
                }
                interim.remove();
                evList.scrollTop = evList.scrollHeight;
                updateStepCount();
                return;
            }
            interim.classList.remove('tl-narration-interim');
            const span = interim.querySelector('.tl-narr-text');
            if (span) {
                span.classList.remove('voice-interim');
                span.classList.remove('voice-interim-status');
                span.textContent = normalized;
            }
            evList.scrollTop = evList.scrollHeight;
            updateStepCount();
            return;
        }

        // No interim — check if last item is narration, append to it
        const last = getLastTimelineItem();
        if (last && last.classList.contains('tl-narration')) {
            const span = last.querySelector('.tl-narr-text');
            if (span) span.textContent += normalized;
        } else {
            const d = document.createElement('div');
            d.className = 'tl-narration';
            const icon = document.createElement('span');
            icon.className = 'tl-narr-icon';
            icon.textContent = '🎙️';
            const safeText = document.createElement('span');
            safeText.className = 'tl-narr-text';
            safeText.textContent = normalized;
            d.appendChild(icon);
            d.appendChild(safeText);
            evList.appendChild(d);
        }
        evList.scrollTop = evList.scrollHeight;
        updateStepCount();
    }

    function updateInterimNarration(text) {
        const normalized = normalizeNarrationText(text);
        if (!isMeaningfulNarration(normalized)) return;
        clearPlaceholder();
        let interim = evList.querySelector('.tl-narration-interim');
        if (!interim) {
            interim = document.createElement('div');
            interim.className = 'tl-narration tl-narration-interim';
            const icon = document.createElement('span');
            icon.className = 'tl-narr-icon';
            icon.textContent = '🎙️';
            const span = document.createElement('span');
            span.className = 'tl-narr-text';
            interim.appendChild(icon);
            interim.appendChild(span);
            evList.appendChild(interim);
        }
        const span = interim.querySelector('.tl-narr-text');
        setInterimNarrationState(span, normalized, false);
        evList.scrollTop = evList.scrollHeight;
    }

    function updateListeningPlaceholder() {
        clearPlaceholder();
        let interim = evList.querySelector('.tl-narration-interim');
        if (!interim) {
            interim = document.createElement('div');
            interim.className = 'tl-narration tl-narration-interim';
            const icon = document.createElement('span');
            icon.className = 'tl-narr-icon';
            icon.textContent = '🎙️';
            const span = document.createElement('span');
            span.className = 'tl-narr-text';
            interim.appendChild(icon);
            interim.appendChild(span);
            evList.appendChild(interim);
        }
        const span = interim.querySelector('.tl-narr-text');
        setInterimNarrationState(span, t('recognizing'), true);
        evList.scrollTop = evList.scrollHeight;
    }

    function updateStepCount() {
        // Count top-level timeline groups (narration blocks + action containers) as "big steps"
        const groups = evList.querySelectorAll(':scope > .tl-narration:not(.tl-narration-interim), :scope > .tl-actions');
        evCountBadge.textContent = groups.length;
    }

    function openImageViewer(src, altText) {
        if (!imgViewerEl || !imgViewerImgEl || !src) return;
        imgViewerImgEl.src = src;
        imgViewerImgEl.alt = altText || t('screenshotPreview');
        imgViewerEl.classList.remove('hidden');
        imgViewerEl.setAttribute('aria-hidden', 'false');
    }

    function closeImageViewer() {
        if (!imgViewerEl || !imgViewerImgEl) return;
        imgViewerEl.classList.add('hidden');
        imgViewerEl.setAttribute('aria-hidden', 'true');
        imgViewerImgEl.removeAttribute('src');
    }

    function getInlineScreenshotSrc(payload) {
        return normalizeImageSrc(payload?.screenshot || payload?.screenshot_base64 || '');
    }

    function setPillText(pill, text) {
        if (!pill) return;
        let textEl = pill.querySelector('.ev-pill-text');
        if (!textEl) {
            textEl = document.createElement('span');
            textEl.className = 'ev-pill-text';
            pill.prepend(textEl);
        }
        textEl.textContent = text;
    }

    function upsertPillThumb(pill, src, altText) {
        if (!pill) return;
        const safeImage = normalizeImageSrc(src);
        let thumbBtn = pill.querySelector('.ev-thumb-btn');
        if (!safeImage) {
            if (thumbBtn) thumbBtn.remove();
            pill.classList.remove('has-thumb');
            return;
        }
        if (!thumbBtn) {
            thumbBtn = document.createElement('button');
            thumbBtn.type = 'button';
            thumbBtn.className = 'ev-thumb-btn';
            thumbBtn.setAttribute('aria-label', t('viewScreenshot'));

            const thumb = document.createElement('img');
            thumb.className = 'ev-thumb';
            thumb.alt = '';
            thumb.loading = 'lazy';
            thumb.decoding = 'async';
            thumbBtn.appendChild(thumb);
            pill.appendChild(thumbBtn);
        }
        thumbBtn.setAttribute('data-full-src', safeImage);
        thumbBtn.setAttribute('data-alt', altText || t('screenshotPreview'));
        const thumb = thumbBtn.querySelector('.ev-thumb');
        if (thumb) thumb.src = safeImage;
        pill.classList.add('has-thumb');
    }

    function applyScreenshotToTimeline(timestamp, screenshot) {
        if (timestamp == null) return;
        const safeImage = normalizeImageSrc(screenshot);
        if (!safeImage) return;
        const pills = evList.querySelectorAll(`.ev-pill[data-ts="${String(timestamp)}"]`);
        if (!pills.length) return;
        pills.forEach((pill) => {
            const type = pill.getAttribute('data-type') || t('actionFallback');
            const label = pill.querySelector('.ev-pill-text')?.textContent || type;
            upsertPillThumb(pill, safeImage, `${type}：${label}`);
        });
    }

    function addActionPill(ev) {
        clearPlaceholder();

        const icon = evIcon(ev.actionType);
        let label = '';
        switch (ev.actionType) {
            case 'click': label = t('actionClick', { target: ev.target?.description || t('elementFallback') }); break;
            case 'input': label = t('actionInput', { value: (ev.value || '').substring(0, 15) }); break;
            case 'navigate': case 'navigation': label = ev.pageTitle || t('pageFallback'); break;
            case 'scroll': label = t('actionScroll'); break;
            case 'select': label = t('actionSelect', { value: (ev.value || '').substring(0, 15) }); break;
            case 'keypress': label = ev.key || ev.value || t('keypressFallback'); break;
            default: label = ev.actionType;
        }

        // For input events, update the last input pill instead of creating a new one
        if (ev.actionType === 'input') {
            const last = getLastTimelineItem();
            if (last && last.classList.contains('tl-actions')) {
                const lastPill = last.querySelector('.ev-pill[data-type="input"]:last-of-type');
                if (lastPill) {
                    lastPill.classList.add('ev-pill-preview');
                    if (ev.timestamp != null) lastPill.setAttribute('data-ts', String(ev.timestamp));
                    setPillText(lastPill, `${icon} ${label}`);
                    lastPill.setAttribute('title', `${fmtTime(ev.timestamp)} — ${label}`);
                    const shot = getInlineScreenshotSrc(ev);
                    if (shot) upsertPillThumb(lastPill, shot, `${fmtTime(ev.timestamp)} — ${label}`);
                    return; // Updated in place, no new pill needed
                }
            }
        }

        // Merge continuous scrolls to one pill in live timeline.
        if (ev.actionType === 'scroll') {
            const last = getLastTimelineItem();
            if (last && last.classList.contains('tl-actions')) {
                const tail = last.lastElementChild;
                if (tail && tail.classList.contains('ev-pill') && tail.getAttribute('data-type') === 'scroll') {
                    const count = Number(tail.getAttribute('data-count') || '1') + 1;
                    tail.setAttribute('data-count', String(count));
                    tail.classList.add('ev-pill-preview');
                    if (ev.timestamp != null) tail.setAttribute('data-ts', String(ev.timestamp));
                    setPillText(tail, `${icon} ${t('actionScroll')} x${count}`);
                    tail.setAttribute('title', `${fmtTime(ev.timestamp)} — ${t('actionScrollMerged', { count })}`);
                    const shot = getInlineScreenshotSrc(ev);
                    if (shot) upsertPillThumb(tail, shot, `${fmtTime(ev.timestamp)} — ${t('actionScrollMerged', { count })}`);
                    return;
                }
            }
        }

        const pill = document.createElement('span');
        pill.className = 'ev-pill ev-pill-preview';
        pill.setAttribute('data-type', ev.actionType);
        if (ev.timestamp != null) pill.setAttribute('data-ts', String(ev.timestamp));
        pill.setAttribute('title', `${fmtTime(ev.timestamp)} — ${label}`);
        setPillText(pill, `${icon} ${label}`);
        const shot = getInlineScreenshotSrc(ev);
        if (shot) upsertPillThumb(pill, shot, `${fmtTime(ev.timestamp)} — ${label}`);

        const last = getLastTimelineItem();
        if (last && last.classList.contains('tl-actions')) {
            last.appendChild(pill);
        } else {
            const container = document.createElement('div');
            container.className = 'tl-actions';
            container.appendChild(pill);
            evList.appendChild(container);
        }
        evList.scrollTop = evList.scrollHeight;
        updateStepCount();
    }

    /* ── SOP rendering (timeline-based preview) ── */
    function compactLabel(text, maxLen = 22) {
        const t = normalizeNarrationText(text);
        if (!t) return '';
        return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
    }

    function getPreviewActionLabel(step) {
        const action = step?.action || {};
        const type = action.type || '';
        const rawDesc = normalizeNarrationText(action.description || '');
        if (rawDesc) return compactLabel(rawDesc, 26);

        switch (type) {
            case 'click': return t('actionClickElement');
            case 'input': return compactLabel(t('actionInput', { value: action.value || '' }), 22) || t('actionInputShort');
            case 'navigate':
            case 'navigation': return compactLabel(action.page_title || action.url || t('actionNavigate'), 24);
            case 'scroll': return t('actionScroll');
            case 'select': return compactLabel(t('actionSelect', { value: action.value || '' }), 22) || t('actionSelectShort');
            case 'keypress': return compactLabel(action.key || action.value || t('keypressFallback'), 18);
            default: return compactLabel(type || t('actionFallback'), 22);
        }
    }

    function createPreviewPill(step) {
        const action = step?.action || {};
        const actionType = action.type || 'action';
        const label = getPreviewActionLabel(step);
        const icon = evIcon(actionType);

        const pill = document.createElement('span');
        pill.className = 'ev-pill ev-pill-preview';
        pill.setAttribute('data-type', actionType);
        if (step?.timestampMs != null) pill.setAttribute('data-ts', String(step.timestampMs));
        const ts = step?.timestamp || '';
        pill.setAttribute('title', `${ts ? `${ts} — ` : ''}${label}`);
        setPillText(pill, `${icon} ${label}`);
        const safeImage = normalizeImageSrc(step?.screenshot);
        if (safeImage) upsertPillThumb(pill, safeImage, t('clickPointScreenshot', { step: step?.stepNumber || '' }));

        return pill;
    }

    function applySopScreenshotsToCurrentTimeline(sop) {
        if (!sop) return;
        const segs = sop.segments || [];
        for (const seg of segs) {
            for (const step of (seg.steps || [])) {
                if (step?.timestampMs == null || !step?.screenshot) continue;
                applyScreenshotToTimeline(step.timestampMs, step.screenshot);
            }
        }
    }

    function renderSOP(sop) {
        currentSOP = sop;
        clearPlaceholder();
        evList.innerHTML = '';

        const segs = sop.segments || [];
        if (segs.length === 0 && sop.steps) {
            // Fallback: no segments, render flat steps
            segs.push({ type: 'silent', narration: '', steps: sop.steps });
        }

        let previewStepCount = 0;
        for (const seg of segs) {
            if (seg.type === 'voice' && isMeaningfulNarration(seg.narration)) {
                const hdr = document.createElement('div');
                hdr.className = 'tl-narration';
                const icon = document.createElement('span');
                icon.className = 'tl-narr-icon';
                icon.textContent = '🎙️';
                const text = document.createElement('span');
                text.className = 'tl-narr-text';
                text.textContent = seg.narration;
                hdr.appendChild(icon);
                hdr.appendChild(text);
                if (seg.timeRange) {
                    const tm = document.createElement('span');
                    tm.className = 'tl-narr-meta';
                    tm.textContent = seg.timeRange;
                    hdr.appendChild(tm);
                }
                evList.appendChild(hdr);
            }

            const steps = seg.steps || [];
            if (steps.length > 0) {
                const container = document.createElement('div');
                container.className = 'tl-actions';
                for (const s of steps) {
                    container.appendChild(createPreviewPill(s));
                    previewStepCount += 1;
                }
                evList.appendChild(container);
            }
        }

        if (!evList.children.length) {
            evList.innerHTML = `<div class="placeholder">${escapeHtml(t('noPreview'))}</div>`;
        }
        evCountBadge.textContent = String(previewStepCount || sop.totalSteps || 0);
        evList.scrollTop = 0;
    }

    /* ── Actions ── */
    let startButtonMode = 'record';

    function setStartButtonMode(mode) {
        startButtonMode = mode || 'record';
        btnStart.dataset.mode = startButtonMode;
    }

    function disableStartButton(msg) {
        setStartButtonMode('disabled');
        btnStart.disabled = true;
        btnStart.classList.add('btn-disabled');
        btnStart.innerHTML = '<span class="bi">⏺</span>' + msg;
    }

    function enableStartButton() {
        setStartButtonMode('record');
        btnStart.disabled = false;
        btnStart.classList.remove('btn-disabled');
        btnStart.innerHTML = `<span class="bi">⏺</span>${t('startRecording')}`;
    }

    function showMicPermissionButton() {
        setStartButtonMode('mic-permission');
        btnStart.disabled = false;
        btnStart.classList.remove('btn-disabled');
        btnStart.innerHTML = `<span class="bi">🎙</span>${t('startNeedMic')}`;
    }

    function showGoogleSigninButton() {
        setStartButtonMode('google-signin');
        btnStart.disabled = false;
        btnStart.classList.remove('btn-disabled');
        btnStart.innerHTML = `<span class="bi">↗</span>${t('startNeedGoogle')}`;
    }

    async function signInForCommercialAccess(showSuccessToast = true) {
        btnStart.disabled = true;
        btnStart.classList.add('btn-disabled');
        btnStart.innerHTML = `<span class="bi">↗</span>${t('startNeedGoogleBusy')}`;
        const settings = await getSttSettings();
        const linked = await Commercial.signInWithGoogle(settings);
        if (!linked.ok) {
            toast(t(linked.reason === 'google-auth-cancelled' ? 'toastGoogleSigninCancelled' : 'toastGoogleSigninFailed'));
            await refreshStartEligibility();
            return false;
        }
        if (showSuccessToast) {
            toast(t('toastGoogleSigninSuccess'));
        }
        await refreshStartEligibility();
        return true;
    }

    function setPauseButton(paused) {
        if (!btnPause) return;
        btnPause.innerHTML = paused
            ? `<span class="bi">▶</span>${t('resume')}`
            : `<span class="bi">⏸</span>${t('pause')}`;
    }

    function setRecordingLayout(mode) {
        const isPreview = mode === 'preview';
        const isPausedState = mode === 'paused';
        recBarEl?.classList.toggle('done', isPreview);
        recBarEl?.classList.toggle('paused', isPausedState);
        if (mode === 'preview') {
            recActionsEl?.classList.add('hidden');
            previewActionsEl?.classList.remove('hidden');
            if (recLabelEl) recLabelEl.textContent = t('recDone');
            return;
        }
        recActionsEl?.classList.remove('hidden');
        previewActionsEl?.classList.add('hidden');
        closeImageViewer();
        if (recLabelEl) recLabelEl.textContent = mode === 'paused' ? t('recPaused') : t('recRecording');
    }

    async function refreshStartEligibility() {
        const settings = await getSttSettings();
        const entitlement = await Commercial.fetchEntitlement(settings, { fresh: true });
        const commercialState = getCommercialUiState(entitlement);
        renderCommercialBanner(settings, entitlement);
        if (currentView !== 'idle') return;
        if (!Commercial.hasBackendConfig(settings)) {
            disableStartButton(t('startNeedBackend'));
            return;
        }
        if (commercialState === 'sign-in') {
            showGoogleSigninButton();
            return;
        }
        if (commercialState === 'unavailable') {
            disableStartButton(t('startNeedManaged'));
            return;
        }
        if (commercialState === 'subscribe') {
            disableStartButton(t('startNeedSubscription'));
            return;
        }
        let micPermissionState = 'unknown';
        try {
            const res = await navigator.permissions.query({ name: 'microphone' });
            micPermissionState = res.state;
        } catch { /* noop */ }
        if (micPermissionState !== 'granted') {
            showMicPermissionButton();
            return;
        }
        enableStartButton();
    }

    async function handleStartClick() {
        if (startButtonMode === 'mic-permission') {
            openMicPermissionGuide();
            return;
        }
        if (startButtonMode === 'google-signin') {
            await signInForCommercialAccess();
            return;
        }
        if (startButtonMode === 'disabled') return;
        await doStart();
    }

    let _starting = false;
    async function doStart() {
        if (_starting) return;
        _starting = true;
        try {
            btnStart.disabled = true;
            btnStart.textContent = t('initStt');

            // Step 1: Initialize STT — must succeed before recording
            const sttOk = await initSTT();

            if (!sttOk) {
                if (sttLastFailure === 'commercial-backend-missing') {
                    disableStartButton(t('startNeedBackend'));
                    toast(t('toastNeedBackend'));
                } else if (sttLastFailure === 'commercial-session-missing') {
                    disableStartButton(t('startNeedSession'));
                    toast(t('toastNeedSession'));
                } else if (sttLastFailure === 'commercial-session-invalid') {
                    disableStartButton(t('startNeedSession'));
                    toast(t('toastSessionExpired'));
                } else if (sttLastFailure === 'commercial-managed-credential-missing') {
                    disableStartButton(t('startNeedManaged'));
                    toast(t('toastNeedManaged'));
                } else if (sttLastFailure === 'commercial-speech-session-failed') {
                    enableStartButton();
                    toast(t('toastSpeechSessionFailed'));
                } else if (sttLastFailure === 'commercial-subscription-required') {
                    disableStartButton(t('startNeedSubscription'));
                    toast(t('toastNeedSubscription'));
                } else if (sttLastFailure === 'commercial-google-login-required') {
                    showGoogleSigninButton();
                    toast(t('toastCheckoutLoginRequired'));
                } else if (sttLastFailure === 'mic-denied') {
                    showMicPermissionButton();
                    toast(t('toastMicDenied'));
                    openMicPermissionGuide();
                } else if (sttLastFailure === 'no-mic-device') {
                    enableStartButton();
                    toast(t('toastNoMic'));
                } else if (sttLastFailure === 'mic-unavailable') {
                    enableStartButton();
                    toast(t('toastMicBusy'));
                } else if (sttLastFailure === 'aliyun-key-invalid') {
                    enableStartButton();
                    toast(t('toastAliyunKeyInvalid'));
                } else if (sttLastFailure === 'aliyun-key-format-invalid') {
                    enableStartButton();
                    toast(t('toastAliyunKeyFormat'));
                } else if (sttLastFailure === 'aliyun-network') {
                    enableStartButton();
                    toast(t('toastAliyunNetwork'));
                } else if (sttLastFailure === 'aliyun-auth-rule-unavailable') {
                    enableStartButton();
                    toast(t('toastAliyunAuthRule'));
                } else if (sttLastFailure === 'aliyun-ws-handshake-failed') {
                    enableStartButton();
                    toast(t('toastAliyunWsHandshake'));
                } else if (sttLastFailure === 'aliyun-init-failed') {
                    enableStartButton();
                    toast(t('toastAliyunInitFailed'));
                } else {
                    enableStartButton();
                    toast(t('toastInitFailed'));
                }
                stopSTT();
                return;
            }

            // Step 2: STT ready — get mic for volume visualizer (optional, non-blocking)
            if (!micStream) {
                try {
                    micStream = await getMicStreamForUse();
                    startVolumeVis(micStream);
                } catch (e) { /* volume vis not available — not critical */ }
            }

            // Step 3: Start recording
            const res = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
            if (res?.success) {
                startTime = res.startTime;
                isPaused = false;
                pausedDuration = 0;
                currentSOP = null;
                evList.innerHTML = `<div class="placeholder">${escapeHtml(t('waitingPlaceholder'))}</div>`;
                evCountBadge.textContent = '0';
                updateTimerDisplay(0);
                setPauseButton(false);
                switchView('recording');
                setRecordingLayout('live');
                timer = setInterval(() => {
                    if (!isPaused) updateTimerDisplay(Date.now() - startTime - pausedDuration);
                }, 1000);
            } else {
                stopSTT({ flushInterim: false });
                stopVolumeVis();
                if (res?.reason === 'commercial-access-required') {
                    disableStartButton(t('startNeedSubscription'));
                    toast(t('toastNeedSubscription'));
                } else if (res?.reason === 'restricted-page') {
                    toast(t('toastRestricted'));
                } else {
                    toast(t('toastStartFailed'));
                }
            }
            enableStartButton();
        } catch (e) {
            console.error(e);
            toast(t('toastStartFailed'));
            enableStartButton();
        } finally {
            _starting = false;
        }
    }

    async function doStop() {
        btnStop.disabled = true; btnStop.textContent = t('generating');
        if (btnPause) btnPause.disabled = true;
        clearInterval(timer); timer = null;
        stopSTT();
        stopVolumeVis();
        await new Promise(r => setTimeout(r, 420));
        try {
            const res = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
            if (res?.success && res.sop) {
                currentSOP = res.sop;
                applySopScreenshotsToCurrentTimeline(res.sop);
                switchView('recording');
                setRecordingLayout('preview');
            }
            else { toast(t('toastGenerateFailed')); switchView('idle'); }
        } catch (e) { console.error(e); toast(t('toastGenerateError')); switchView('idle'); }
        btnStop.disabled = false; btnStop.innerHTML = `<span class="bi">⏹</span>${t('stopRecording')}`;
        if (btnPause) {
            btnPause.disabled = false;
            setPauseButton(false);
        }
        isPaused = false;
    }

    async function doTogglePause() {
        if (currentView !== 'recording' || !btnPause) return;
        btnPause.disabled = true;
        try {
            if (!isPaused) {
                await chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
                isPaused = true;
                stopSTT({ flushInterim: false });
                stopVolumeVis();
                setPauseButton(true);
                setRecordingLayout('paused');
                toast(t('toastPaused'));
                return;
            }

            const sttOk = await initSTT();
            if (!sttOk) {
                toast(t('toastResumeSttFailed'));
                return;
            }
            try {
                micStream = await getMicStreamForUse();
                startVolumeVis(micStream);
            } catch { /* non-blocking */ }
            await chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
            isPaused = false;
            setPauseButton(false);
            setRecordingLayout('live');
            toast(t('toastResumed'));
        } catch (e) {
            console.error(e);
            toast(t('toastPauseResumeFailed'));
        } finally {
            btnPause.disabled = false;
        }
    }

    function normalizeActionTypeForExport(type) {
        const t = String(type || '').toLowerCase();
        return t === 'navigate' ? 'navigation' : t;
    }

    function buildStepLookupByTimestamp(steps) {
        const map = new Map();
        for (const step of (steps || [])) {
            const ts = Number(step?.timestampMs);
            if (!Number.isFinite(ts)) continue;
            const queue = map.get(ts) || [];
            queue.push(step);
            map.set(ts, queue);
        }
        return map;
    }

    function consumeStepForExport(stepLookup, timestampMs, actionType) {
        if (!Number.isFinite(timestampMs)) return null;
        const queue = stepLookup.get(timestampMs);
        if (!queue || queue.length === 0) return null;
        const wantType = normalizeActionTypeForExport(actionType);
        let idx = queue.findIndex((s) => normalizeActionTypeForExport(s?.action?.type) === wantType);
        if (idx < 0) idx = 0;
        const [picked] = queue.splice(idx, 1);
        return picked || null;
    }

    function getPillExportLabel(pill, fallback) {
        const raw = normalizeNarrationText(pill?.querySelector('.ev-pill-text')?.textContent || '');
        if (!raw) return fallback || t('actionFallback');
        const stripped = raw.replace(/^[^A-Za-z0-9\u4e00-\u9fff]+/, '').trim();
        return stripped || fallback || t('actionFallback');
    }

    function getExportPresentation(sop) {
        const timelineSegs = buildExportSegmentsFromTimeline(sop);
        const hasTimelineSegs = timelineSegs.some(seg =>
            (seg.steps && seg.steps.length > 0) || (seg.type === 'voice' && isMeaningfulNarration(seg.narration))
        );
        const segments = hasTimelineSegs
            ? timelineSegs
            : ((Array.isArray(sop?.segments) && sop.segments.length > 0)
                ? sop.segments
                : [{ type: 'silent', narration: '', steps: sop?.steps || [] }]);
        const totalSteps = segments.reduce((sum, seg) => sum + ((seg.steps || []).length), 0);
        return { segments, totalSteps };
    }

    function decodeHtmlEntities(value) {
        return String(value || '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    function htmlToPlainText(value) {
        return decodeHtmlEntities(String(value || ''))
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>\s*<p>/gi, '\n\n')
            .replace(/<\/li>\s*<li>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function buildClipboardPayload(sop) {
        const { segments, totalSteps } = getExportPresentation(sop);
        const introTitle = t('copySectionIntro');
        const notesTitle = t('copySectionNotes');
        const opsTitle = t('copySectionOps');
        const introLines = [
            `- ${t('copyFieldStartUrl')}：${sop.startUrl || ''}`,
            `- ${t('copyFieldCreatedAt')}：${sop.createdAt || ''}`,
            `- ${t('copyFieldDuration')}：${fmtTime(sop.duration || 0)}`,
            `- ${t('copyFieldStepCount')}：${totalSteps}`
        ];
        const notesLines = [
            t('exportDocIntro'),
            htmlToPlainText(t('exportHowToReadItems'))
        ].filter(Boolean);

        const operationBlocks = [];
        const operationHtmlBlocks = [];
        let lastUrl = '';

        for (const seg of segments) {
            const blockLines = [];
            const blockHtml = [];
            const hasVoice = seg.type === 'voice' && isMeaningfulNarration(seg.narration);

            if (hasVoice) {
                const narrationTitle = t('copyNarrationTitle');
                blockLines.push(`### ${narrationTitle}`);
                blockLines.push(seg.narration);
                if (seg.timeRange) blockLines.push(`- ${t('copyFieldTime')}：${seg.timeRange}`);

                blockHtml.push(`<section class="copy-seg copy-seg-voice">`);
                blockHtml.push(`<h3>${escapeHtml(narrationTitle)}</h3>`);
                blockHtml.push(`<p>${escapeHtml(seg.narration)}</p>`);
                if (seg.timeRange) blockHtml.push(`<p><strong>${escapeHtml(t('copyFieldTime'))}:</strong> ${escapeHtml(seg.timeRange)}</p>`);
            } else {
                blockHtml.push(`<section class="copy-seg">`);
            }

            for (const step of (seg.steps || [])) {
                const desc = normalizeNarrationText(step?.action?.description || step?.action?.type || t('actionFallback'));
                const stepLines = [`${step.stepNumber}. ${desc}`];
                const stepMeta = [];
                const stepMetaHtml = [];
                if (step?.timestamp) {
                    stepMeta.push(`- ${t('copyFieldTime')}：${step.timestamp}`);
                    stepMetaHtml.push(`<li><strong>${escapeHtml(t('copyFieldTime'))}:</strong> ${escapeHtml(step.timestamp)}</li>`);
                }
                const stepUrl = normalizeNarrationText(step?.action?.url || '');
                if (stepUrl && stepUrl !== lastUrl) {
                    stepMeta.push(`- ${t('copyFieldPage')}：${stepUrl}`);
                    stepMetaHtml.push(`<li><strong>${escapeHtml(t('copyFieldPage'))}:</strong> ${escapeHtml(stepUrl)}</li>`);
                    lastUrl = stepUrl;
                }
                const selector = normalizeNarrationText(step?.action?.selector || '');
                if (selector) {
                    stepMeta.push(`- ${t('exportAgentDetail')}：${selector}`);
                    stepMetaHtml.push(`<li><strong>${escapeHtml(t('exportAgentDetail'))}:</strong> <code>${escapeHtml(selector)}</code></li>`);
                }
                if (stepMeta.length) stepLines.push(stepMeta.map(line => `   ${line}`).join('\n'));
                blockLines.push(stepLines.join('\n'));

                blockHtml.push(`<div class="copy-step"><p><strong>${escapeHtml(`${step.stepNumber}. ${desc}`)}</strong></p>${stepMetaHtml.length ? `<ul>${stepMetaHtml.join('')}</ul>` : ''}</div>`);
            }

            if (hasVoice || (seg.steps || []).length) {
                operationBlocks.push(blockLines.join('\n\n').trim());
                blockHtml.push(`</section>`);
                operationHtmlBlocks.push(blockHtml.join(''));
            }
        }

        if (!operationBlocks.length) {
            operationBlocks.push(t('copyEmptyOps'));
            operationHtmlBlocks.push(`<p>${escapeHtml(t('copyEmptyOps'))}</p>`);
        }

        const plainText = [
            `# ${sop.title || 'SOP'}`,
            `## ${introTitle}`,
            introLines.join('\n'),
            `## ${notesTitle}`,
            notesLines.join('\n\n'),
            `## ${opsTitle}`,
            operationBlocks.join('\n\n')
        ].join('\n\n').trim();

        const html = [
            `<article>`,
            `<h1>${escapeHtml(sop.title || 'SOP')}</h1>`,
            `<h2>${escapeHtml(introTitle)}</h2>`,
            `<ul>${introLines.map(line => `<li>${escapeHtml(line.replace(/^- /, ''))}</li>`).join('')}</ul>`,
            `<h2>${escapeHtml(notesTitle)}</h2>`,
            notesLines.map(line => `<p>${escapeHtml(line)}</p>`).join(''),
            `<h2>${escapeHtml(opsTitle)}</h2>`,
            operationHtmlBlocks.join(''),
            `</article>`
        ].join('');

        return { plainText, html };
    }

    async function writeClipboard(payload) {
        const plainText = String(payload?.plainText || '').trim();
        const html = String(payload?.html || '').trim();
        if (!plainText) throw new Error('empty-clipboard-payload');

        if (navigator.clipboard?.write && window.ClipboardItem) {
            try {
                const item = new ClipboardItem({
                    'text/plain': new Blob([plainText], { type: 'text/plain' }),
                    'text/html': new Blob([html || `<pre>${escapeHtml(plainText)}</pre>`], { type: 'text/html' })
                });
                await navigator.clipboard.write([item]);
                return;
            } catch (e) {
                console.warn('Clipboard rich write failed, fallback to text:', e);
            }
        }

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(plainText);
            return;
        }

        const ta = document.createElement('textarea');
        ta.value = plainText;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        ta.remove();
        if (!ok) throw new Error('clipboard-copy-failed');
    }

    function buildDownloadHtml(sop) {
        const { segments, totalSteps } = getExportPresentation(sop);
        let stepsHtml = '';
        let lastUrl = '';

        for (const seg of segments) {
            const isVoice = seg.type === 'voice' && isMeaningfulNarration(seg.narration);
            stepsHtml += `<div class="sop-segment ${isVoice ? 'sop-seg-voice' : 'sop-seg-silent'}">`;
            if (isVoice) {
                stepsHtml += `<div class="seg-narration"><span class="seg-icon">🎙️</span><span class="seg-text">${escapeHtml(seg.narration)}</span>${seg.timeRange ? `<span class="seg-time">${escapeHtml(seg.timeRange)}</span>` : ''}</div>`;
            }
            for (const s of (seg.steps || [])) {
                const descHtml = escapeHtml(s.action?.description || s.action?.type || t('actionFallback'));
                let body = '';
                const stepUrl = s.action?.url || '';
                if (stepUrl && stepUrl !== lastUrl) {
                    const safeUrl = normalizeExternalUrl(stepUrl);
                    if (safeUrl) {
                        body += `<div class="step-url">🔗 <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(stepUrl)}</a></div>`;
                    } else {
                        body += `<div class="step-url">🔗 ${escapeHtml(stepUrl)}</div>`;
                    }
                    lastUrl = stepUrl;
                }
                const safeImage = normalizeImageSrc(s.screenshot);
                if (safeImage) body += `<img class="step-img" src="${escapeHtml(safeImage)}" alt="${escapeHtml(t('exportStepAlt', { step: s.stepNumber }))}" loading="lazy">`;
                if (s.action?.selector) body += `<details class="step-code-details"><summary class="step-code-summary">${escapeHtml(t('exportAgentDetail'))}</summary><div class="step-sel">${escapeHtml(s.action.selector)}</div></details>`;
                stepsHtml += `<article class="sop-step"><header class="sop-hdr"><span class="step-n">${escapeHtml(s.stepNumber)}</span><span class="step-act">${descHtml}</span><span class="step-t">${escapeHtml(s.timestamp || '')}</span></header>${body ? `<div class="sop-body">${body}</div>` : ''}</article>`;
            }
            stepsHtml += `</div>`;
        }

        const summaryLines = t('exportSummaryLines', {
            startUrl: escapeHtml(sop.startUrl || ''),
            createdAt: escapeHtml(sop.createdAt || ''),
            steps: escapeHtml(totalSteps),
            duration: escapeHtml(fmtTime(sop.duration || 0))
        });
        const desc = `<section class="doc-desc"><h2>${escapeHtml(t('exportDocTitle'))}</h2><p>${escapeHtml(t('exportDocIntro'))}</p><p><strong>${escapeHtml(t('exportHowToRead'))}</strong><br>${t('exportHowToReadItems')}</p><p><strong>${escapeHtml(t('exportSummary'))}</strong><br>${summaryLines}</p></section>`;
        const sopJson = JSON.stringify(sop)
            .replace(/</g, '\\u003c')
            .replace(/-->/g, '--\\u003e');

        return `<!DOCTYPE html><html lang="${escapeHtml(t('exportLang'))}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(sop.title || 'SOP')}</title><style>:root{--bg:#eef3f8;--surface:#fff;--surface-2:#f7fafc;--line:#d8e2ec;--text:#102a43;--muted:#52667a;--muted-soft:#7b8ea4;--ac:#0b5fff;--ach:#2f80ff;--ac-g:rgba(11,95,255,.2);--r-md:14px;--r-lg:18px;--rf:999px}*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Public Sans","Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);line-height:1.65;background:radial-gradient(circle at 92% 6%,rgba(11,95,255,.12) 0%,transparent 32%),linear-gradient(180deg,#f8fbff 0%,var(--bg) 100%);padding:24px 16px;-webkit-font-smoothing:antialiased}img{max-width:100%}.shell{max-width:940px;margin:0 auto}.hero{border:1px solid var(--line);background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-radius:var(--r-lg);padding:18px;box-shadow:0 12px 24px rgba(12,27,61,.08);margin-bottom:12px}.hero-kicker{display:inline-flex;align-items:center;border-radius:var(--rf);border:1px solid #c4d3e2;background:#f4f8fd;color:#3c5471;padding:4px 10px;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-family:"IBM Plex Mono","SF Mono",Menlo,monospace;margin-bottom:8px}.title{font-family:"Nunito Sans","Public Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:30px;font-weight:800;line-height:1.08;letter-spacing:-.02em;color:#123454;margin-bottom:9px}.meta{display:flex;gap:8px;flex-wrap:wrap}.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:var(--rf);font-size:12px;font-weight:700}.badge-primary{background:linear-gradient(120deg,var(--ac),var(--ach));color:#fff}.badge-soft{background:#eaf1f9;color:#3d5774}.doc-desc{border:1px solid var(--line);background:rgba(255,255,255,.92);border-radius:var(--r-md);padding:14px 15px;box-shadow:0 10px 20px rgba(12,27,61,.07);margin-bottom:12px;font-size:13px;color:var(--muted)}.doc-desc h2{font-size:14px;color:#173453;margin-bottom:8px}.doc-desc p{margin-bottom:8px}.doc-desc p:last-child{margin-bottom:0}.steps{display:flex;flex-direction:column;gap:12px}.sop-step{border:1px solid var(--line);background:#fff;border-radius:var(--r-md);overflow:hidden;box-shadow:0 10px 20px rgba(12,27,61,.07)}.sop-hdr{display:flex;align-items:center;gap:10px;padding:11px 12px;background:#fbfdff;border-bottom:1px solid #e2eaf3}.step-n{width:24px;height:24px;border-radius:var(--rf);display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(120deg,var(--ac),var(--ach));color:#fff;font-size:11px;font-weight:700;flex-shrink:0}.step-act{flex:1;font-size:13px;font-weight:700;color:#1a3a5c}.step-act-val{color:#5f7690;font-weight:500}.step-t{font-size:11px;color:#6e849a;font-family:"IBM Plex Mono","SF Mono",Menlo,monospace;white-space:nowrap}.sop-body{padding:10px 12px}.step-url{font-size:12px;color:#6e849a;padding:7px 10px;background:#f7fbff;border-radius:8px;border:1px solid #dbe7f4;margin-bottom:10px;word-break:break-all}.step-url a{color:#0b5fff;text-decoration:none}.step-url a:hover{text-decoration:underline}.step-img{width:100%;border-radius:8px;border:1px solid #e0e8f1;margin-bottom:10px}.step-code-details{margin-top:8px}.step-code-summary{cursor:pointer;user-select:none;border:1px solid #d9e4ef;border-radius:8px;background:#f9fcff;color:#4b6784;font-size:12px;font-weight:600;padding:6px 9px}.step-code-summary:hover{border-color:#c4d8ec;background:#fff;color:#2a4a6d}.step-sel{padding:6px 9px;border-radius:0 0 8px 8px;border:1px solid #d9e4ef;border-top:none;font-family:"IBM Plex Mono","SF Mono",Menlo,monospace;font-size:11px;color:#5b7390;word-break:break-all;background:#f9fcff}.sop-segment{display:flex;flex-direction:column;gap:10px}.sop-seg-voice{border-left:3px solid var(--ac);padding-left:12px}.sop-seg-silent{border-left:3px solid #d5e2ef;padding-left:12px}.seg-narration{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:10px;background:rgba(11,95,255,.06);border:1px solid rgba(11,95,255,.12);font-size:13px;line-height:1.6;color:#1a3a5c}.seg-icon{flex-shrink:0;font-size:14px}.seg-text{flex:1}.seg-time{flex-shrink:0;font-size:11px;color:#7b8ea4;font-family:"IBM Plex Mono","SF Mono",Menlo,monospace}.footer{text-align:center;padding:18px 8px;color:#71859b;font-size:12px}@media (max-width:680px){body{padding:12px}.hero{padding:14px}.title{font-size:24px}.sop-hdr{align-items:flex-start}.step-t{padding-top:3px}}</style></head><body><div class="shell"><section class="hero"><p class="hero-kicker">ONVORD SOP EXPORT</p><h1 class="title">${escapeHtml(sop.title || 'SOP')}</h1><div class="meta"><span class="badge badge-primary">${escapeHtml(totalSteps)} ${escapeHtml(t('exportStepsUnit'))}</span><span class="badge badge-soft">${escapeHtml(fmtTime(sop.duration || 0))}</span></div></section>${desc}<section class="steps">${stepsHtml}</section><footer class="footer">${escapeHtml(t('exportGeneratedBy', { createdAt: sop.createdAt || '' }))}</footer></div><script id="onvord-sop-json" type="application/json">${sopJson}</script></body></html>`;
    }

    function buildExportSegmentsFromTimeline(sop) {
        const timelineItems = Array.from(evList?.children || []);
        if (!timelineItems.length) return [];

        const stepLookup = buildStepLookupByTimestamp(sop?.steps || []);
        const segments = [];
        let pendingVoice = null;
        let exportStepNumber = 0;

        const flushPendingVoice = () => {
            if (!pendingVoice) return;
            segments.push(pendingVoice);
            pendingVoice = null;
        };

        for (const item of timelineItems) {
            if (item.classList.contains('tl-narration')) {
                if (item.classList.contains('tl-narration-interim')) continue;
                const narration = normalizeNarrationText(item.querySelector('.tl-narr-text')?.textContent || '');
                if (!isMeaningfulNarration(narration)) continue;
                flushPendingVoice();
                pendingVoice = {
                    type: 'voice',
                    narration,
                    timeRange: '',
                    timeRangeMs: null,
                    steps: []
                };
                continue;
            }

            if (!item.classList.contains('tl-actions')) continue;
            const pills = Array.from(item.querySelectorAll('.ev-pill'));
            if (!pills.length) continue;

            const segSteps = [];
            for (const pill of pills) {
                const type = normalizeActionTypeForExport(pill.getAttribute('data-type') || 'action');
                const ts = Number(pill.getAttribute('data-ts'));
                const matchedStep = consumeStepForExport(stepLookup, ts, type);
                const label = getPillExportLabel(pill, matchedStep?.action?.description || type || t('actionFallback'));
                const inlineShot = normalizeImageSrc(pill.querySelector('.ev-thumb-btn')?.getAttribute('data-full-src') || '');
                const stepShot = normalizeImageSrc(matchedStep?.screenshot || matchedStep?.action?.screenshot_base64 || '');
                const screenshot = inlineShot || stepShot || '';
                const timestampMs = Number.isFinite(ts)
                    ? ts
                    : (Number.isFinite(Number(matchedStep?.timestampMs)) ? Number(matchedStep.timestampMs) : null);

                segSteps.push({
                    stepNumber: ++exportStepNumber,
                    timestamp: timestampMs != null ? fmtTime(timestampMs) : (matchedStep?.timestamp || ''),
                    timestampMs,
                    action: {
                        ...(matchedStep?.action || {}),
                        type: matchedStep?.action?.type || type || 'action',
                        description: label
                    },
                    screenshot,
                    narration: ''
                });
            }

            if (!segSteps.length) continue;

            if (pendingVoice && pendingVoice.steps.length === 0) {
                pendingVoice.steps = segSteps;
                const firstTs = segSteps[0]?.timestampMs;
                const lastTs = segSteps[segSteps.length - 1]?.timestampMs;
                if (Number.isFinite(firstTs) && Number.isFinite(lastTs)) {
                    pendingVoice.timeRange = `${fmtTime(firstTs)} - ${fmtTime(lastTs)}`;
                    pendingVoice.timeRangeMs = { start: firstTs, end: lastTs };
                }
                segments.push(pendingVoice);
                pendingVoice = null;
            } else {
                segments.push({
                    type: 'silent',
                    narration: '',
                    timeRange: '',
                    timeRangeMs: null,
                    steps: segSteps
                });
            }
        }

        flushPendingVoice();
        return segments;
    }

    async function doCopySOP() {
        if (!currentSOP) return;
        const sop = currentSOP;
        try {
            const payload = buildClipboardPayload(sop);
            await writeClipboard(payload);
            toast(t('exportSuccess'));
        } catch (e) {
            console.error('Copy SOP failed:', e);
            toast(t('toastCopyFailed'));
        }
    }

    function doDownloadHTML() {
        if (!currentSOP) return;
        const sop = currentSOP;
        try {
            const html = buildDownloadHtml(sop);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const a = document.createElement('a');
            const href = URL.createObjectURL(blob);
            a.href = href;
            a.download = `${safeFilename(sop.title)}.html`;
            a.click();
            URL.revokeObjectURL(href);
            toast(t('downloadSuccess'));
        } catch (e) {
            console.error('Download SOP failed:', e);
            toast(t('toastGenerateFailed'));
        }
    }

    /* ── Wire up ── */
    const btnExport = $('btn-export');
    const linkSettings = $('link-settings');
    applyUiLocale();
    btnStart.addEventListener('click', handleStartClick);
    btnStop.addEventListener('click', doStop);
    btnPause?.addEventListener('click', doTogglePause);
    btnExport.addEventListener('click', doCopySOP);
    btnDownload?.addEventListener('click', doDownloadHTML);
    btnCommercialCheckout?.addEventListener('click', handleCommercialPrimaryAction);
    btnCommercialPortal?.addEventListener('click', () => openBillingUrl('portal'));
    btnRedo.addEventListener('click', () => {
        stopVolumeVis();
        currentSOP = null;
        setRecordingLayout('live');
        switchView('idle');
    });
    evList.addEventListener('click', (e) => {
        const btn = e.target.closest('.ev-thumb-btn');
        if (!btn) return;
        e.preventDefault();
        openImageViewer(btn.getAttribute('data-full-src') || '', btn.getAttribute('data-alt') || t('screenshotPreview'));
    });
    imgViewerCloseEl?.addEventListener('click', closeImageViewer);
    imgViewerEl?.addEventListener('click', (e) => {
        if (e.target === imgViewerEl) closeImageViewer();
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeImageViewer();
    });
    linkSettings.addEventListener('click', async (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'NEW_EVENT' && currentView === 'recording') addActionPill(msg.data);
        if (msg.type === 'EVENT_SCREENSHOT' && currentView === 'recording') {
            applyScreenshotToTimeline(msg.timestamp, msg.screenshot);
        }
        if (msg.type === 'AUTO_STOPPED' && currentView === 'recording') {
            toast(t('toastAutoStopped'));
            // Clean up local state without sending another STOP_RECORDING
            clearInterval(timer); timer = null;
            stopSTT();
            stopVolumeVis();
            if (msg.sop) {
                currentSOP = msg.sop;
                applySopScreenshotsToCurrentTimeline(msg.sop);
                switchView('recording');
                setRecordingLayout('preview');
            } else {
                // Fallback: request SOP separately
                chrome.runtime.sendMessage({ type: 'GET_SOP' }, (res) => {
                    if (res?.sop) {
                        currentSOP = res.sop;
                        applySopScreenshotsToCurrentTimeline(res.sop);
                        switchView('recording');
                        setRecordingLayout('preview');
                    }
                    else { switchView('idle'); }
                });
            }
            btnStop.disabled = false;
            btnStop.innerHTML = `<span class="bi">⏹</span>${t('stopRecording')}`;
            setPauseButton(false);
            if (btnPause) btnPause.disabled = false;
            isPaused = false;
        }
        if (msg.type === 'RESTRICTED_PAGE') {
            toast(t('toastRestricted'));
        }
        if (msg.type === 'MIC_PERMISSION_GRANTED') {
            refreshStartEligibility();
        }
    });

    /* ── Recovery check on startup ── */
    chrome.runtime.sendMessage({ type: 'CHECK_RECOVERY' }, (res) => {
        if (res?.recovery && !res.recovery._dismissed) {
            const savedAt = new Date(res.recovery.savedAt);
            const ago = Math.round((Date.now() - res.recovery.savedAt) / 60000);
            if (ago < 30) {
                // Show recovery prompt
                const blockCount = (res.recovery.timeline || []).length;
                if (blockCount > 0 && confirm(t('recoveryPrompt', { ago, count: blockCount }))) {
                    chrome.runtime.sendMessage({ type: 'RESTORE_RECOVERY', data: res.recovery }, () => {
                        startTime = res.recovery.startTime;
                        pausedDuration = res.recovery.pausedDuration || 0;
                        isPaused = false;
                        switchView('recording');
                        setPauseButton(false);
                        setRecordingLayout('live');
                        timer = setInterval(() => {
                            updateTimerDisplay(Date.now() - startTime - pausedDuration);
                        }, 1000);
                        initSTT().then(ok => {
                            if (!ok) toast(t('toastRecoverySttFailed'));
                        });
                        getMicStreamForUse().then(stream => {
                            micStream = stream;
                            startVolumeVis(stream);
                        }).catch(() => {});
                    });
                } else {
                    chrome.runtime.sendMessage({ type: 'CLEAR_RECOVERY' });
                }
            } else {
                chrome.runtime.sendMessage({ type: 'CLEAR_RECOVERY' });
            }
        }
    });

    /* ── Startup readiness ── */
    refreshStartEligibility();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshStartEligibility();
    });
    window.addEventListener('focus', () => refreshStartEligibility());

    /* ── Initial state check ── */
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
        if (res?.recording) {
            startTime = res.startTime;
            pausedDuration = res.pausedDuration || 0;
            isPaused = res.paused || false;
            switchView('recording');
            setPauseButton(isPaused);
            setRecordingLayout(isPaused ? 'paused' : 'live');
            timer = setInterval(() => {
                if (!isPaused) {
                    updateTimerDisplay(Date.now() - startTime - pausedDuration);
                }
            }, 1000);
            initSTT();
            getMicStreamForUse().then(stream => {
                micStream = stream;
                startVolumeVis(stream);
            }).catch(() => {});
        }
    });

    /* ── Re-check start eligibility when commercial state changes ── */
    chrome.storage.onChanged.addListener((changes) => {
        const hasRelevantChange =
            changes.commercialApiBaseUrl ||
            changes.commercialSessionToken ||
            changes.commercialCheckoutUrl ||
            changes.commercialPortalUrl ||
            changes.commercialLanguage ||
            changes.commercialCachedEntitlement ||
            changes.commercialCachedEntitlementAt ||
            changes.commercialCachedUserEmail ||
            changes.commercialLastSpeechProvider;
        if (!hasRelevantChange) {
            return;
        }
        getSttSettings()
            .then((settings) => Commercial.fetchEntitlement(settings, { fresh: true })
                .then((entitlement) => renderCommercialBanner(settings, entitlement)))
            .catch(() => {});
        if (currentView !== 'idle') return;
        refreshStartEligibility();
    });
})();
