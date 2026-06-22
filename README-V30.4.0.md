# Mission UPSC AI OS V30.4.0 — Final Polish

## Base preserved
V30.3.0 Saarthi Mentorship Hub, V30.2 Prompt/YouTube tools, secure Gemini proxy, centred date/time inputs and top-bar hamburger behaviour are preserved.

## Final polishing changes

- Reorganised the sidebar into six logical groups: Start & Today, Learn & Research, Answer & Practice, Mentor & Analytics, Library & Output, and AI & System.
- Added consistent card, form, button, grid and responsive spacing across the app, especially ChatGPT Prompt Hub, Saarthi Hub, and App & Offline Centre.
- Forced production Gemini calls through the authenticated Firebase proxy. The browser stores no Gemini API key.
- Added the already-deployed secure function URL as the non-secret default, while retaining the editable field in AI Control Centre.
- Routed legacy AI Notes, Current Affairs, Jarvis, mentor, revision, PDF/text, answer-writing, test and visual-note workflows to the unified selected AI router.
- Added secure image/scanned-PDF payload handling to the Firebase function.
- Strengthened Jarvis academic intent handling so explanations mentioning “Prelims and Mains” stay inside Jarvis; only explicit test/MCQ commands navigate to a test centre.

## ChatGPT Prompt Hub Pro

The Prompt Hub is now a dedicated full-width section with:

- four-step workflow and quick UPSC presets;
- strict Mains evaluator, topper-answer, CA, ethics, essay, PYQ, notes and Saarthi templates;
- prompt-health and word-count indicators;
- Gemini prompt improvement and same-prompt comparison;
- ChatGPT response paste/editor, preview, copy, local history, Notes/module transfer, print/PDF, TXT and Word export;
- Gemini + ChatGPT comparison and a reviewed merge workflow;
- focus mode and keyboard shortcuts;
- a compact ChatGPT companion window beside JARVIS.

### Browser constraint

The signed-in ChatGPT website cannot be rendered inside another website’s iframe because of browser/security policies. V30.4 therefore keeps the complete working workspace inside JARVIS and opens ChatGPT in a compact companion window. This is more reliable than a broken embedded frame.

## Deployment

1. Upload/replace files from the GitHub Update ZIP.
2. Wait for GitHub Pages to deploy.
3. Hard refresh with `Ctrl + Shift + R`; fully close and reopen an installed PWA.
4. Sign in using the authorised Google account.
5. Open AI Control Centre and run the AI Coverage Audit.

### One backend redeploy for visual files

Text AI continues to use the existing deployed function. To activate secure image and scanned-PDF reading added in V30.4, run once from the full project folder:

```bash
npx firebase-tools deploy --only functions
```

The existing `GEMINI_API_KEY` and `OWNER_EMAIL` secrets remain in Firebase Secret Manager and do not need to be entered again.
