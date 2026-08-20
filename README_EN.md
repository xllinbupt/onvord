<p align="center">
  <img src="icons/icon128.png" width="80" alt="Onvord Logo">
</p>

<h1 align="center">Onvord</h1>

<p align="center">
  <strong>Record your actions, generate AI-executable SOPs</strong><br>
  Browser action recording + voice narration → Structured SOPs for AI agents
</p>

<p align="center">
  <a href="README.md">中文</a> · <b>English</b>
</p>

---

## What is Onvord?

**Onvord** is a Chrome extension that lets you record browser workflows by simply "doing and talking" — it automatically captures your actions and voice narration, then generates a structured SOP (Standard Operating Procedure).

The generated SOP is both **human-friendly** (rich screenshots, clear steps) and **AI-ready** (precise CSS selectors and action semantics that AI agents can execute).

This repository contains the complete Chrome extension client from the former commercial `0.5.19` build, now open-sourced under the MIT License.

> 🎯 **In one sentence**: Do it once, let AI do it a thousand times.

---

## Features

### 🎙️ Real-time Speech-to-Text
- Powered by **hosted Aliyun realtime speech** in the open-source client
- Current recognition options: **Chinese (zh-CN)** and **English (en-US)**
- End users never need to paste a third-party API key; narration is auto-linked to action steps

### 🖱️ Smart Action Capture
- Automatically records clicks, inputs, scrolls, and page navigation
- **Text selection** vs **click** — precisely distinguished
- Intelligent filtering of meaningless actions (blank area clicks, etc.)
- Auto-identifies element types (buttons, links, inputs, icons, etc.)

### 📸 Inline Thumbnail Screenshots
- Auto-captures and annotates screenshots for **click** and **select** events
- Thumbnails are embedded inside action pills (same pattern during recording and preview)
- Click any thumbnail to open a larger viewer

### 📋 Single-Page Hybrid Timeline
- **Recording** and **post-stop preview** share the same timeline view
- **Voice** → merged narration blocks, with the placeholder text `识别中`
- **Actions** → compact pills, with merged scroll display (for example `Scroll xN`)

### 📄 Standalone HTML Export
- One-click export to self-contained HTML file
- Rich visual output with segmented narration and screenshots
- Send directly to colleagues or upload to AI agents
- Built-in guide plus "Execution Details (For Agent)" for automation

## Recent Updates (2026-03)

- Refreshed extension icon assets: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`, `icons/logo.png`
- The open-source client now uses hosted Aliyun speech by default, with no manual API key setup
- Recording and preview were unified into one timeline page
- Sidebar wording was updated to "Execution Details (For Agent)"
- Voice placeholder changed from line marks to `识别中`
- Action pills now support inline screenshot thumbnails with click-to-zoom
- Unrecognized / non-meaningful speech text (for example `...` or punctuation-only) is no longer shown in timeline/preview
- Scroll actions are filtered by PRD rules and merged in live timeline (for example `Scroll xN`)

---

## Use Cases

| Scenario | How |
|----------|-----|
| **Teach AI repetitive tasks** | Record a workflow once, export SOP for AI agent to execute |
| **Create product tutorials** | Operate while narrating, auto-generate visual guides |
| **Bug reproduction** | Record the exact steps to reproduce, with screenshots and selectors |
| **Employee onboarding** | Experienced staff record SOPs, new hires self-learn |
| **Process auditing** | Document operation steps with visual evidence |

---

## Quick Start

### 1. Install

> Currently in developer preview — manual loading required.

1. Download this project
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" → Select the project folder

### 2. Connect to the Hosted Service

1. On first launch, the sidebar auto-registers the device with the official backend
2. The client automatically fetches the temporary speech session needed for the current recording
3. If the service is unavailable, open the settings page to inspect status and reconnect

### 3. Start Recording

1. Open the webpage you want to demonstrate
2. Click the Onvord icon in the toolbar to open the sidebar
3. Click **⏺ Start Recording**
4. Operate the browser normally while narrating each step
5. Click **⏹ Stop Recording** → SOP auto-generates
6. Click **Export SOP** to download the standalone HTML file

---

## Open-source Scope and Hosted Services

- This repository open-sources the **Onvord Chrome extension client**, including recording, timeline, screenshots, export, account, and subscription UI code.
- The client connects to `https://api.onvord.com` by default for device sessions, accounts, subscription status, and temporary speech credentials. That hosted service and third-party services are outside this repository and are not covered by this repository's MIT License.
- This repository is **not yet a complete self-hosted stack**. A compatible backend must implement the endpoints called by `commercial.js`; a reference server implementation is not included yet.
- Existing `commercial*` identifiers are retained for compatibility with current users' local data and API integrations; the client source itself is open source.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)             │
├──────────────┬──────────────┬───────────────┤
│ content.js   │ sidepanel.js │ background.js │
│ · Capture    │ · Unified    │ · State       │
│   actions    │   timeline UI│   management  │
│ · Element    │ · Hosted     │ · SOP         │
│   describe   │   speech STT │   generation  │
│ · Event      │ · HTML       │ · Screenshot  │
│   filtering  │   export     │   annotation  │
└──────────────┴──────────────┴───────────────┘
         │                          │
    ┌────┴────┐              ┌──────┴──────┐
    │ Cloudflare│            │ Offscreen   │
    │ Worker API│            │ Canvas      │
    │ + Aliyun  │            │ (Annotate)  │
    └──────────┘              └─────────────┘
```

---

## Privacy & Security

- 🔒 **No user API key required** — The client only stores device/session state locally
- 🔒 **Voice data** — The hosted flow provisions a speech session and then connects to Aliyun realtime speech
- 🔒 **Screenshots** — Processed entirely in your browser, never leave your machine
- 🔒 **Open-source client** — The extension client is available for audit; see the hosted-service boundary above

---

## Roadmap

- [x] Real-time speech-to-text (hosted Aliyun)
- [x] Smart action capture & filtering
- [x] Screenshot click-position annotation
- [x] Hybrid timeline (narration blocks + action pills)
- [x] Standalone HTML export
- [ ] iFlytek speech engine (China mainland, no VPN needed)
- [ ] AI-powered SOP refinement (LLM-enhanced narration)
- [ ] Cloud SOP sharing (shareable links)
- [ ] Chrome Web Store listing
- [ ] Team collaboration (shared SOP library)
- [ ] Multi-language UI

---

## Contributing

Issues and Pull Requests are welcome!

Run this check before submitting a change:

```bash
npm run check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and manual smoke-test checklist.

---

## License

[MIT License](LICENSE)

---

<p align="center">
  <strong>Onvord</strong> — Let AI see what you do<br>
  <sub>Built with ❤️ for the AI-native workflow</sub>
</p>
