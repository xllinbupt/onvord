try {
    importScripts('commercial-config.js');
} catch (e) {
    console.warn('commercial-config.js load failed:', e);
}

try {
    importScripts('commercial.js');
} catch (e) {
    console.warn('commercial.js load failed:', e);
}

// Onvord Background Service Worker — Phase 1-3: Block-based Timeline Engine

/* ── Constants ── */
const VOICE_DELAY_WINDOW = 2000;   // ms: actions within this window after voice ends still belong to current block
const SILENT_SPLIT_GAP = 3000;     // ms: gap between actions to split into new silent block
const AUTO_STOP_DURATION = 600000; // ms: 10 minutes
const RECOVERY_INTERVAL = 30000;   // ms: 30 seconds
const SCROLL_PROMOTE_WINDOW = 500; // ms: pending scroll promotion window

/* ── State ── */
let state = {
    recording: false,
    paused: false,
    startTime: 0,
    pausedDuration: 0,
    pauseStartTime: 0,
    startUrl: '',
    sttProvider: 'managed',
    language: 'zh-CN',

    // Block-based timeline
    timeline: [],        // finalized blocks
    currentBlock: null,   // block being assembled

    // Voice tracking
    voiceActive: false,
    voiceEndTime: 0,

    // Voice segments for SOP grouping: [{startTime, endTime, texts:[]}]
    voiceSegments: [],
    currentVoiceSegment: null,

    // Scroll filtering
    pendingScrolls: [],   // buffered pending scrolls from content.js

    // Screenshots (keyed by action timestamp)
    screenshots: {},

    // Legacy compat: events/narrations for sidepanel rendering (Phase 4 will remove)
    events: [],
    narrations: [],
};

let offscreenReady = false;
let autoStopTimer = null;
let recoveryTimer = null;
let blockIdCounter = 0;

/* ── Block & Action Data Structures ── */

function createBlockId() {
    return `blk_${++blockIdCounter}`;
}

/**
 * Create a new block.
 * @param {object|null} intent - { text: string, audio_start: number } or null for silent block
 * @param {number} timestamp - relative ms from recording start
 */
function createBlock(intent, timestamp) {
    return {
        id: createBlockId(),
        type: intent ? 'voice' : 'silent',
        intent: intent,   // { text, audio_start } | null
        actions: [],
        start_time: timestamp,
        end_time: timestamp,
    };
}

function finalizeCurrentBlock() {
    if (!state.currentBlock) return;
    if (state.currentBlock.actions.length > 0 || state.currentBlock.intent) {
        state.currentBlock.end_time = state.currentBlock.actions.length > 0
            ? state.currentBlock.actions[state.currentBlock.actions.length - 1].timestamp
            : state.currentBlock.start_time;
        state.timeline.push(state.currentBlock);
    }
    state.currentBlock = null;
}

function addActionToCurrentBlock(action) {
    const now = action.timestamp;

    // If voice is active, action belongs to current block
    if (state.voiceActive) {
        if (!state.currentBlock || state.currentBlock.type === 'silent') {
            // Voice started but block not yet created — create a voice block
            finalizeCurrentBlock();
            state.currentBlock = createBlock({ text: '', audio_start: now }, now);
        }
        state.currentBlock.actions.push(action);
        state.currentBlock.end_time = now;
        return;
    }

    // Within voice delay window
    if (state.voiceEndTime > 0 && (now - state.voiceEndTime) <= VOICE_DELAY_WINDOW) {
        if (state.currentBlock && state.currentBlock.type === 'voice') {
            state.currentBlock.actions.push(action);
            state.currentBlock.end_time = now;
            return;
        }
    }

    // Silent action: check if we should append to current silent block or create new one
    if (state.currentBlock && state.currentBlock.type === 'silent') {
        const lastActionTime = state.currentBlock.actions.length > 0
            ? state.currentBlock.actions[state.currentBlock.actions.length - 1].timestamp
            : state.currentBlock.start_time;

        if ((now - lastActionTime) > SILENT_SPLIT_GAP) {
            // Gap too large, split into new block
            finalizeCurrentBlock();
            state.currentBlock = createBlock(null, now);
        }
        state.currentBlock.actions.push(action);
        state.currentBlock.end_time = now;
        return;
    }

    // No current block or current is voice block that's done
    if (state.currentBlock && state.currentBlock.type === 'voice') {
        finalizeCurrentBlock();
    }

    if (!state.currentBlock) {
        state.currentBlock = createBlock(null, now);
    }
    state.currentBlock.actions.push(action);
    state.currentBlock.end_time = now;
}

/* ── Offscreen document for Canvas annotation ── */
async function ensureOffscreen() {
    if (offscreenReady) return;
    try {
        await chrome.offscreen.createDocument({
            url: 'annotate.html',
            reasons: ['DOM_PARSER'],
            justification: 'Annotate screenshots with click position using Canvas'
        });
        offscreenReady = true;
    } catch (e) {
        if (e.message?.includes('already exists')) offscreenReady = true;
        else console.warn('offscreen create failed:', e);
    }
}

/* ── Screenshot ── */
async function capture() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return null;
        return await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 70 });
    } catch { return null; }
}

async function captureAndAnnotate(clickX, clickY, viewportW, viewportH) {
    const dataUrl = await capture();
    if (!dataUrl || clickX == null || clickY == null) return dataUrl;
    try {
        await ensureOffscreen();
        const res = await chrome.runtime.sendMessage({
            type: 'ANNOTATE_SCREENSHOT', dataUrl, clickX, clickY, viewportW, viewportH
        });
        return res?.annotatedUrl || dataUrl;
    } catch (e) {
        console.warn('annotate failed:', e);
        return dataUrl;
    }
}

/* ── Effective timestamp (accounting for paused duration) ── */
function effectiveTimestamp() {
    return Date.now() - state.startTime - state.pausedDuration;
}

/* ── Auto-stop timer ── */
function startAutoStopTimer() {
    clearTimeout(autoStopTimer);
    const remaining = AUTO_STOP_DURATION - effectiveTimestamp();
    if (remaining <= 0) {
        stopRecording().then(sop => {
            chrome.runtime.sendMessage({ type: 'AUTO_STOPPED', sop }).catch(() => {});
        });
        return;
    }
    autoStopTimer = setTimeout(async () => {
        if (state.recording && !state.paused) {
            const sop = await stopRecording();
            chrome.runtime.sendMessage({ type: 'AUTO_STOPPED', sop }).catch(() => {});
        }
    }, remaining);
}

function clearAutoStopTimer() {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
}

/* ── Data Recovery ── */
function startRecoveryTimer() {
    clearInterval(recoveryTimer);
    recoveryTimer = setInterval(() => {
        if (!state.recording) return;
        saveRecoveryData();
    }, RECOVERY_INTERVAL);
}

function saveRecoveryData() {
    // Save timeline without screenshot_base64 to keep size manageable
    const timelineForRecovery = state.timeline.map(block => ({
        ...block,
        actions: block.actions.map(a => {
            const { screenshot_base64, ...rest } = a;
            return rest;
        })
    }));
    const currentBlockForRecovery = state.currentBlock ? {
        ...state.currentBlock,
        actions: state.currentBlock.actions.map(a => {
            const { screenshot_base64, ...rest } = a;
            return rest;
        })
    } : null;

    chrome.storage.session.set({
        onvord_recovery: {
            timeline: timelineForRecovery,
            currentBlock: currentBlockForRecovery,
            narrations: state.narrations,
            voiceSegments: state.voiceSegments,
            currentVoiceSegment: state.currentVoiceSegment,
            voiceActive: state.voiceActive,
            voiceEndTime: state.voiceEndTime,
            pendingScrolls: state.pendingScrolls,
            startTime: state.startTime,
            startUrl: state.startUrl,
            sttProvider: state.sttProvider,
            language: state.language,
            pausedDuration: state.pausedDuration,
            savedAt: Date.now()
        }
    }).catch(() => {});
}

function clearRecoveryData() {
    chrome.storage.session.remove('onvord_recovery').catch(() => {});
}

/* ── Restricted page detection ── */
function isRestrictedUrl(url) {
    if (!url) return true;
    return url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:') ||
        url.startsWith('chrome-search://') || url.startsWith('devtools://');
}

/* ── Recording lifecycle ── */
async function startRecording() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab?.id) {
        return { success: false, reason: 'no-active-tab' };
    }
    if (isRestrictedUrl(activeTab.url)) {
        chrome.runtime.sendMessage({ type: 'RESTRICTED_PAGE', url: activeTab.url }).catch(() => {});
        return { success: false, reason: 'restricted-page' };
    }

    const commercial = globalThis.OnvordCommercial;
    const rawSettings = await chrome.storage.local.get(commercial?.STORAGE_KEYS || []);
    const commercialSettings = commercial?.fixedCommercialSettings
        ? commercial.fixedCommercialSettings(rawSettings)
        : rawSettings;
    const hasFreshValidatedAccess = commercial?.hasFreshRecordingAccessValidation
        ? commercial.hasFreshRecordingAccessValidation(commercialSettings)
        : false;
    const entitlement = hasFreshValidatedAccess
        ? { ok: true, hasAccess: true, reason: 'recent-validation' }
        : commercial?.ensureRecordingAccess
            ? await commercial.ensureRecordingAccess(commercialSettings)
            : { ok: false, hasAccess: false, reason: 'commercial-helper-missing' };

    if (!entitlement.ok || !entitlement.hasAccess) {
        return { success: false, reason: 'commercial-access-required' };
    }

    const sttProvider = commercialSettings.commercialLastSpeechProvider || 'managed';
    const language = commercialSettings.commercialLanguage === 'en-US' ? 'en-US' : 'zh-CN';

    state = {
        recording: true,
        paused: false,
        startTime: Date.now(),
        pausedDuration: 0,
        pauseStartTime: 0,
        startUrl: activeTab?.url || '',
        sttProvider,
        language,
        timeline: [],
        currentBlock: null,
        voiceActive: false,
        voiceEndTime: 0,
        voiceSegments: [],
        currentVoiceSegment: null,
        pendingScrolls: [],
        screenshots: {},
        events: [],
        narrations: [],
    };
    blockIdCounter = 0;

    // Pre-create offscreen document
    ensureOffscreen().catch(() => {});

    // Inject content script into active tab
    const injected = await injectContentScript(activeTab.id, state.startTime);
    if (!injected.ok) {
        state.recording = false;
        return { success: false, reason: injected.reason || 'inject-failed' };
    }

    // Start timers
    startAutoStopTimer();
    startRecoveryTimer();

    return { success: true, startTime: state.startTime };
}

async function injectContentScript(tabId, startTime) {
    try {
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING', startTime });
        return { ok: true };
    } catch {
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
            await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING', startTime });
            return { ok: true };
        } catch (e) {
            // Check if restricted page
            try {
                const tab = await chrome.tabs.get(tabId);
                if (isRestrictedUrl(tab.url)) {
                    chrome.runtime.sendMessage({ type: 'RESTRICTED_PAGE', url: tab.url }).catch(() => {});
                    return { ok: false, reason: 'restricted-page' };
                }
            } catch {}
            console.warn('inject failed', e);
            return { ok: false, reason: 'inject-failed' };
        }
    }
}

async function stopRecording() {
    state.recording = false;
    state.paused = false;
    finalizeCurrentBlock();

    // Close any open voice segment
    if (state.currentVoiceSegment) {
        state.currentVoiceSegment.endTime = state.currentVoiceSegment.endTime || effectiveTimestamp();
        state.voiceSegments.push(state.currentVoiceSegment);
        state.currentVoiceSegment = null;
    }

    clearAutoStopTimer();
    clearInterval(recoveryTimer);
    clearRecoveryData();

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        try { await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' }); } catch {}
    }

    return generateSOP();
}

function pauseRecording() {
    if (!state.recording || state.paused) return;
    state.paused = true;
    state.pauseStartTime = Date.now();
    clearAutoStopTimer();

    // Pause content scripts
    chrome.tabs.query({}).then(tabs => {
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: 'PAUSE_RECORDING' }).catch(() => {});
        }
    });
}

function resumeRecording() {
    if (!state.recording || !state.paused) return;
    state.pausedDuration += Date.now() - state.pauseStartTime;
    state.paused = false;
    state.pauseStartTime = 0;
    startAutoStopTimer();

    // Resume content scripts
    chrome.tabs.query({}).then(tabs => {
        for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: 'RESUME_RECORDING' }).catch(() => {});
        }
    });
}

/* ── Scroll filtering (promote pending scrolls) ── */
function promotePendingScrolls(beforeTimestamp) {
    // If a click/input happens within SCROLL_PROMOTE_WINDOW of a pending scroll,
    // promote only the latest one as the meaningful "find target then act" scroll.
    let latest = null;
    const remaining = [];
    for (const ps of state.pendingScrolls) {
        const delta = beforeTimestamp - ps.timestamp;
        if (delta >= 0 && delta <= SCROLL_PROMOTE_WINDOW) {
            if (!latest || ps.timestamp > latest.timestamp) latest = ps;
        } else if (delta > SCROLL_PROMOTE_WINDOW) {
            // Too old, discard
        } else {
            remaining.push(ps);
        }
    }
    state.pendingScrolls = remaining;
    return latest ? [latest] : [];
}

/* ── SOP generation (legacy compat for Phase 4 transition) ── */
function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function actionDesc(ev) {
    const direction = ev.direction === 'up' ? '向上' : '向下';
    const distance = Number(ev.distance_px || ev.scrollDelta || 0);
    switch (ev.actionType) {
        case 'click': return `点击 ${ev.target?.description || '元素'}`;
        case 'input': return `在 ${ev.target?.description || '输入框'} 中输入 "${(ev.value || '').substring(0, 40)}"`;
        case 'navigate':
        case 'navigation': return `导航到 ${ev.pageTitle || ev.url}`;
        case 'select': return `选择文字「${(ev.value || '').substring(0, 40)}」`;
        case 'keypress': return `按下 ${ev.key || ev.value || '快捷键'}`;
        case 'scroll': return `页面${direction}滚动 ${distance}px`;
        default: return ev.actionType;
    }
}

function isMeaningfulNarrationText(text) {
    const normalized = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!normalized) return false;
    const core = normalized.replace(/[.。,…，、!！?？~～\-—_·•:：;；'"`“”‘’()（）[\]【】{}<>《》|\\/+=*&^%$#@\s]/g, '');
    return core.length > 0;
}

function generateSOP() {
    // Flatten all actions from timeline blocks
    const allActions = [];
    const allBlocks = [...state.timeline];
    if (state.currentBlock) allBlocks.push(state.currentBlock);

    for (const block of allBlocks) {
        for (const action of block.actions) {
            allActions.push(action);
        }
    }

    // Keep all action types, including meaningful scrolls promoted from pending buffer.
    const actions = allActions.sort((a, b) => a.timestamp - b.timestamp);

    // ── Build voice segments from narration events ──
    // Narration events are the source of truth; VOICE_STARTED/VOICE_ENDED are best-effort hints.
    const finalNarrations = state.narrations.filter(n => n.isFinal && isMeaningfulNarrationText(n.text));

    // Estimate time range for each narration
    // narration.timestamp = when text was recognized (after STT latency)
    // Estimated speech end = timestamp - STT_LATENCY
    // Estimated speech start = speech end - speech duration (based on text length)
    const STT_LATENCY = 1500; // ms
    const CHARS_PER_SEC = 4;  // Chinese chars per second (speaking speed)

    const narrationRanges = finalNarrations.map(n => {
        const textLen = n.text.trim().length;
        const estimatedDurationMs = Math.max(1500, Math.round(textLen / CHARS_PER_SEC * 1000));
        const endTime = Math.max(0, n.timestamp - STT_LATENCY);
        const startTime = Math.max(0, endTime - estimatedDurationMs);
        return { startTime, endTime, text: n.text.trim() };
    });

    // Merge narrations only when there is no action event between them.
    // This keeps backend grouping consistent with live timeline behavior.
    const voiceSegs = [];
    const sortedNarrationRanges = narrationRanges.slice().sort((a, b) => a.startTime - b.startTime);
    for (const nr of sortedNarrationRanges) {
        const last = voiceSegs[voiceSegs.length - 1];
        const hasActionBetween = Boolean(last) && actions.some((a) => {
            const left = Math.min(last.endTime, nr.startTime);
            const right = Math.max(last.endTime, nr.startTime);
            return a.timestamp > left && a.timestamp < right;
        });
        if (last && !hasActionBetween) {
            last.endTime = Math.max(last.endTime, nr.endTime);
            last.texts.push(nr.text);
        } else {
            voiceSegs.push({
                startTime: nr.startTime,
                endTime: nr.endTime,
                texts: [nr.text]
            });
        }
    }

    // Build step objects
    let stepNum = 0;
    const makeStep = (ev) => {
        const normalizedType = ev.actionType === 'navigate' ? 'navigation' : ev.actionType;
        const screenshot = state.screenshots[ev.timestamp] || null;
        return ({
        stepNumber: ++stepNum,
        timestamp: fmtTime(ev.timestamp),
        timestampMs: ev.timestamp,
        action: {
            type: normalizedType,
            description: actionDesc(ev),
            target: ev.target || null,
            selector: ev.target?.selector || '',
            xpath: ev.target?.xpath || '',
            selector_confidence: ev.target?.selector_confidence || 'low',
            url: ev.url,
            from_url: ev.from_url || null,
            pageTitle: ev.pageTitle,
            value: ev.value || null,
            key: ev.key || ev.value || null,
            direction: ev.direction || null,
            distance_px: Number(ev.distance_px || ev.scrollDelta || 0) || null,
            screenshot_base64: (normalizedType === 'click' || normalizedType === 'select') ? screenshot : null
        },
        screenshot,
        narration: ''
    });
    };

    // Assign each action to a voice segment (±BUFFER)
    const BUFFER = 3000;
    const actionSegMap = new Array(actions.length).fill(-1);

    for (let ai = 0; ai < actions.length; ai++) {
        const at = actions[ai].timestamp;
        for (let si = 0; si < voiceSegs.length; si++) {
            const seg = voiceSegs[si];
            if (at >= seg.startTime - BUFFER && at <= seg.endTime + BUFFER) {
                actionSegMap[ai] = si;
                break;
            }
        }
    }

    // Build segments array
    const segments = [];
    const usedVoiceSegIdx = new Set();
    let i = 0;
    while (i < actions.length) {
        const segIdx = actionSegMap[i];
        if (segIdx >= 0) {
            const seg = voiceSegs[segIdx];
            usedVoiceSegIdx.add(segIdx);
            const groupSteps = [];
            while (i < actions.length && actionSegMap[i] === segIdx) {
                groupSteps.push(makeStep(actions[i]));
                i++;
            }
            segments.push({
                type: 'voice',
                narration: seg.texts.join(''),
                timeRange: `${fmtTime(seg.startTime)} - ${fmtTime(seg.endTime)}`,
                timeRangeMs: { start: seg.startTime, end: seg.endTime },
                steps: groupSteps
            });
        } else {
            const groupSteps = [];
            while (i < actions.length && actionSegMap[i] < 0) {
                groupSteps.push(makeStep(actions[i]));
                i++;
            }
            segments.push({
                type: 'silent',
                narration: '',
                timeRange: '',
                timeRangeMs: null,
                steps: groupSteps
            });
        }
    }

    // Preserve voice segments that could not be aligned to any action.
    // Without this, preview/export may show only actions and lose narration blocks.
    for (let si = 0; si < voiceSegs.length; si++) {
        if (usedVoiceSegIdx.has(si)) continue;
        const seg = voiceSegs[si];
        segments.push({
            type: 'voice',
            narration: seg.texts.join(''),
            timeRange: `${fmtTime(seg.startTime)} - ${fmtTime(seg.endTime)}`,
            timeRangeMs: { start: seg.startTime, end: seg.endTime },
            steps: []
        });
    }

    // Keep segment order stable by timeline start.
    segments.sort((a, b) => {
        const aStart = a.timeRangeMs?.start ?? a.steps?.[0]?.timestampMs ?? Number.MAX_SAFE_INTEGER;
        const bStart = b.timeRangeMs?.start ?? b.steps?.[0]?.timestampMs ?? Number.MAX_SAFE_INTEGER;
        return aStart - bStart;
    });

    // Handle case with narrations but no actions.
    if (actions.length === 0 && segments.length === 0 && voiceSegs.length > 0) {
        for (const seg of voiceSegs) {
            segments.push({
                type: 'voice',
                narration: seg.texts.join(''),
                timeRange: `${fmtTime(seg.startTime)} - ${fmtTime(seg.endTime)}`,
                timeRangeMs: { start: seg.startTime, end: seg.endTime },
                steps: []
            });
        }
    }

    // Flat steps list (for backward compat)
    const steps = segments.flatMap(seg =>
        seg.steps.map((s, idx) => ({
            ...s,
            narration: idx === 0 ? seg.narration : ''
        }))
    );

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const totalDuration = allActions.length > 0
        ? allActions[allActions.length - 1].timestamp
        : (state.startTime ? Date.now() - state.startTime - state.pausedDuration : 0);

    return {
        title: `SOP - ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
        createdAt: now.toISOString(),
        duration: totalDuration,
        startUrl: state.startUrl || actions[0]?.url || '',
        totalSteps: steps.length,
        steps,
        segments,
        // New: include block timeline for Phase 5 JSON export
        _timeline: allBlocks.map(b => ({
            id: b.id,
            type: b.type,
            intent: b.intent,
            actions: b.actions,
            start_time: b.start_time,
            end_time: b.end_time
        })),
        _metadata: {
            start_time: state.startTime ? new Date(state.startTime).toISOString() : now.toISOString(),
            duration_seconds: Math.round(totalDuration / 1000),
            start_url: state.startUrl,
            stt_provider: state.sttProvider || 'managed',
            language: state.language,
            environment: {
                user_agent: '',  // filled in sidepanel/export
                screen_width: 0,
                screen_height: 0
            }
        }
    };
}

function sopToMarkdown(sop) {
    let md = `# ${sop.title}\n\n> 录制时间: ${sop.createdAt}  \n> 起始页面: ${sop.startUrl}  \n> 总步骤数: ${sop.totalSteps}\n\n---\n\n`;
    sop.steps.forEach(s => {
        md += `## 步骤 ${s.stepNumber} [${s.timestamp}]\n\n`;
        if (s.narration) md += `**讲解：** ${s.narration}\n\n`;
        md += `**操作：** ${s.action.description}\n\n`;
        if (s.action.url) md += `**页面：** ${s.action.url}\n\n`;
        if (s.action.selector) md += `<details>\n<summary>元素选择器</summary>\n\n\`\`\`\n${s.action.selector}\n\`\`\`\n\n</details>\n\n`;
        md += `---\n\n`;
    });
    return md;
}

/* ── Cross-page navigation via webNavigation ── */
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (!state.recording || state.paused) return;
    if (details.frameId !== 0) return; // Only main frame

    const tabId = details.tabId;
    const url = details.url;

    // Check for restricted page
    if (isRestrictedUrl(url)) {
        chrome.runtime.sendMessage({ type: 'RESTRICTED_PAGE', url }).catch(() => {});
        return;
    }

    // Re-inject content script and resume recording
    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING', startTime: state.startTime });
    } catch (e) {
        console.warn('webNavigation re-inject failed:', e);
    }
});

/* ── Tab lifecycle (keep recording across tab switches) ── */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    if (!state.recording || state.paused) return;
    try {
        const tab = await chrome.tabs.get(tabId);
        if (isRestrictedUrl(tab.url)) {
            chrome.runtime.sendMessage({ type: 'RESTRICTED_PAGE', url: tab.url }).catch(() => {});
            return;
        }
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING', startTime: state.startTime });
    } catch {}
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (!state.recording || state.paused || info.status !== 'complete') return;
    try {
        const tab = await chrome.tabs.get(tabId);
        if (isRestrictedUrl(tab.url)) return;
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING', startTime: state.startTime });
    } catch {
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
            await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING', startTime: state.startTime });
        } catch {}
    }
});

/* ── Open side panel on icon click ── */
chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
});

/* ── Message router ── */
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    // Recording lifecycle
    if (msg.type === 'START_RECORDING') {
        startRecording().then(r => respond(r));
        return true;
    }
    if (msg.type === 'STOP_RECORDING') {
        stopRecording().then(sop => respond({ success: true, sop }));
        return true;
    }
    if (msg.type === 'PAUSE_RECORDING') {
        pauseRecording();
        respond({ success: true, paused: true });
        return false;
    }
    if (msg.type === 'RESUME_RECORDING') {
        resumeRecording();
        respond({ success: true, paused: false });
        return false;
    }

    // State query
    if (msg.type === 'GET_STATE') {
        respond({
            recording: state.recording,
            paused: state.paused,
            startTime: state.startTime,
            pausedDuration: state.pausedDuration,
            eventCount: state.events.length,
            blockCount: state.timeline.length + (state.currentBlock ? 1 : 0)
        });
        return false;
    }

    // Action events from content script
    if (msg.type === 'ACTION_EVENT') {
        if (!state.recording || state.paused) return;
        const action = msg.data;

        // Promote any pending scrolls that happened near this action
        if (action.actionType === 'click' || action.actionType === 'input') {
            const promoted = promotePendingScrolls(action.timestamp);
            for (const ps of promoted) {
                addActionToCurrentBlock(ps);
                // Legacy compat
                state.events.push(ps);
            }
        }

        // Add action to block engine
        addActionToCurrentBlock(action);

        // Legacy compat: push to events array for sidepanel
        state.events.push(action);

        // Screenshot capture
        if (action.actionType === 'click' || action.actionType === 'select') {
            captureAndAnnotate(action.clickX, action.clickY, action.viewportW, action.viewportH)
                .then(s => {
                    if (!s) return;
                    state.screenshots[action.timestamp] = s;
                    chrome.runtime.sendMessage({
                        type: 'EVENT_SCREENSHOT',
                        timestamp: action.timestamp,
                        screenshot: s
                    }).catch(() => {});
                });
        }

        // Notify sidepanel
        chrome.runtime.sendMessage({ type: 'NEW_EVENT', data: action }).catch(() => {});
        return false;
    }

    // Pending scroll from content script (buffered small scroll)
    if (msg.type === 'PENDING_SCROLL') {
        if (!state.recording || state.paused) return;
        state.pendingScrolls.push(msg.data);
        // Clean up old pending scrolls (older than 2x promote window)
        const cutoff = msg.data.timestamp - SCROLL_PROMOTE_WINDOW * 2;
        state.pendingScrolls = state.pendingScrolls.filter(ps => ps.timestamp > cutoff);
        return false;
    }

    // Voice events from sidepanel
    if (msg.type === 'VOICE_STARTED') {
        if (!state.recording || state.paused) return;
        state.voiceActive = true;
        const ts = msg.timestamp || effectiveTimestamp();

        // Voice segment tracking
        if (!state.currentVoiceSegment) {
            state.currentVoiceSegment = { startTime: ts, endTime: null, texts: [] };
        }

        // Block engine (kept for _timeline export)
        finalizeCurrentBlock();
        state.currentBlock = createBlock({ text: '', audio_start: msg.audio_start || ts }, ts);
        return false;
    }

    if (msg.type === 'VOICE_ENDED') {
        if (!state.recording) return;
        state.voiceActive = false;
        state.voiceEndTime = msg.timestamp || effectiveTimestamp();

        // Close voice segment
        if (state.currentVoiceSegment) {
            state.currentVoiceSegment.endTime = msg.timestamp || effectiveTimestamp();
            state.voiceSegments.push(state.currentVoiceSegment);
            state.currentVoiceSegment = null;
        }
        return false;
    }

    if (msg.type === 'NARRATION_EVENT') {
        if (!state.recording) return;
        state.narrations.push({ text: msg.text, timestamp: msg.timestamp, isFinal: msg.isFinal });

        // Attach text to current or most recent voice segment
        if (msg.isFinal && msg.text.trim()) {
            const seg = state.currentVoiceSegment || state.voiceSegments[state.voiceSegments.length - 1];
            if (seg) seg.texts.push(msg.text.trim());
        }

        // Block engine compat
        if (msg.isFinal && state.currentBlock && state.currentBlock.type === 'voice' && state.currentBlock.intent) {
            if (state.currentBlock.intent.text) state.currentBlock.intent.text += ' ';
            state.currentBlock.intent.text += msg.text;
        }
        return false;
    }

    // Get SOP without triggering stop (for auto-stop flow)
    if (msg.type === 'GET_SOP') {
        respond({ sop: generateSOP() });
        return false;
    }

    // Markdown generation
    if (msg.type === 'GET_MARKDOWN') {
        respond({ markdown: sopToMarkdown(msg.sop) });
        return false;
    }

    // Mic permission relay
    if (msg.type === 'MIC_PERMISSION_GRANTED') {
        chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' }).catch(() => {});
        return false;
    }

    // Recovery data check
    if (msg.type === 'CHECK_RECOVERY') {
        chrome.storage.session.get('onvord_recovery', (data) => {
            respond({ recovery: data.onvord_recovery || null });
        });
        return true;
    }

    if (msg.type === 'CLEAR_RECOVERY') {
        clearRecoveryData();
        respond({ success: true });
        return false;
    }

    if (msg.type === 'RESTORE_RECOVERY') {
        const recovery = msg.data;
        if (recovery) {
            state.timeline = recovery.timeline || [];
            state.currentBlock = recovery.currentBlock || null;
            state.narrations = recovery.narrations || [];
            state.voiceSegments = recovery.voiceSegments || [];
            state.currentVoiceSegment = recovery.currentVoiceSegment || null;
            state.voiceActive = Boolean(recovery.voiceActive);
            state.voiceEndTime = recovery.voiceEndTime || 0;
            state.pendingScrolls = recovery.pendingScrolls || [];
            state.startTime = recovery.startTime;
            state.startUrl = recovery.startUrl;
            state.sttProvider = ['aliyun', 'managed'].includes(recovery.sttProvider)
                ? recovery.sttProvider
                : 'managed';
            state.language = recovery.language;
            // Account for crash gap as paused duration
            const crashGap = Date.now() - (recovery.savedAt || Date.now());
            state.pausedDuration = (recovery.pausedDuration || 0) + crashGap;
            state.recording = true;
            state.paused = false;
            blockIdCounter = state.timeline.length + (state.currentBlock ? 1 : 0);

            // Rebuild legacy events from timeline
            state.events = [];
            for (const block of state.timeline) {
                for (const action of block.actions) {
                    state.events.push(action);
                }
            }
            if (state.currentBlock) {
                for (const action of state.currentBlock.actions) {
                    state.events.push(action);
                }
            }

            startAutoStopTimer();
            startRecoveryTimer();
            clearRecoveryData();
        }
        respond({ success: true });
        return false;
    }
});
