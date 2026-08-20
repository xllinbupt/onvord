# Contributing to Onvord

Thanks for helping improve Onvord.

## Before opening a pull request

1. Keep changes focused on one problem.
2. Run the automated repository check:

   ```bash
   npm run check
   ```

3. Load the repository as an unpacked extension in Chrome and verify the affected flow.

## Minimum manual smoke test

- Open the side panel and settings page without console errors.
- Start, pause, resume, and stop a recording.
- Capture a click, input, selection, scroll, and navigation event.
- Confirm speech text and screenshots appear in the timeline.
- Export the SOP and open the generated HTML file.
- Confirm the extension reports hosted-service failures clearly instead of hanging.

Do not include API keys, access tokens, session tokens, exported SOPs, or user screenshots in commits or issues.
