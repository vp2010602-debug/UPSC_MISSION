# Mission UPSC AI OS V29.0 — Jarvis Saarathi

V29.0 is built directly on the complete V28.9 Workspace & Vault Fix package. No previous module, user data key, Firebase collection, note, file, planner, test, revision record or existing Jarvis executor was removed.

## Main upgrade

### Simple Jarvis
- Replaced the technical first-view dashboard with a clean “Ask Jarvis” experience.
- One primary command box with voice input and automatic routing.
- Six clear student actions: Plan Today, Learn, Make Notes, Practice, Mind Map and Search Library.
- Jarvis answer is visible beside the command box on desktop and directly below it on mobile.
- Quick actions for copy, save to notes, read aloud and PDF/print.
- Calendar, revision and workspace counts are shown in a compact daily strip.
- Technical features remain available inside **Advanced Jarvis Workspace**:
  - Command Route
  - Multi-step Action Queue
  - Suggested Next Moves
  - Personal Workspace Memory
  - Saved Routines
  - Recent Commands
  - Live Workspace Context

### AI Voice Saarathi
- New visual voice orb with listening, thinking and speaking states.
- Mentor, Quick Revision, Oral Quiz and Study Plan modes.
- Auto-ask after voice capture.
- Auto-read answers aloud.
- Optional hands-free conversation loop.
- Voice/language, answer-style, speaking voice and speaking-speed controls.
- Pause/resume and stop controls.
- Existing save, flashcard, revision, calendar, download and PDF actions remain intact.

## Compatibility
- Existing localStorage keys are unchanged.
- Existing Firebase configuration and collections are unchanged.
- Existing V28.9 files remain in the package.
- Previous modules continue to use their original functions.
- PWA cache upgraded to V29.0 and includes the new patch files.

## Deployment
Upload the complete contents of this folder to the same GitHub repository. Replace the old repository files with these files, then wait for GitHub Pages to redeploy. On iPhone/iPad, remove the old Home Screen shortcut and add it again after deployment if the cached version remains visible.
