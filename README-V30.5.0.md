# Mission UPSC AI OS V30.5.0 — Voice + Daily Current Affairs

## Voice Saarthi reliability

- Microphone permission is requested only after **Enable / Test Mic** is pressed.
- Denied/unsupported/no-speech/network states are shown inside the page instead of repeated alerts.
- Text mode remains fully functional and uses the selected JARVIS AI route.
- Recheck, text-mode fallback, stop, speech capture and output speech controls are preserved.
- JARVIS does not store raw microphone audio; browser speech recognition only fills the text command field.

## Daily Current Affairs Tracker

- Tracker-inspired left topic rail + detailed issue workspace.
- Source Desk with 26 newspaper, official, institutional, report and magazine links.
- Zero-token source queue: add headline, URL and excerpt before generation.
- Bulk daily digest import.
- Manual **Generate Today's CA with Gemini** button only; no automatic daily generation.
- Token estimate, topic cap, depth selection and confirmation before every paid call.
- Re-generation on the same date requires a second explicit confirmation.
- One selected queue batch is processed in one secure Gemini call.
- Source-conscious JSON output with UPSC syllabus, tags, importance, Prelims facts/traps, Mains dimensions, laws, reports, opportunities, challenges, PYQ themes, probable questions, way forward, revision capsule and mind map.
- Generated cards integrate with Notes, Revision, Flashcards, Mains, Prelims and Saarthi targets.
- Daily print/PDF and individual issue print.
- Existing secure Firebase Gemini proxy remains unchanged.

## Deployment

Upload the GitHub Update files, replacing matching files. Wait for GitHub Pages and refresh with Ctrl+Shift+R. Fully close and reopen the installed PWA on iPad/iPhone.

No Firebase Functions redeployment is required for V30.5.0.
