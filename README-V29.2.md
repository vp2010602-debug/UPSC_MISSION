# Mission UPSC AI OS V29.2 — Visual + Notes Upgrade

Built safely on V29.1 Clean Consolidated. Existing Firebase configuration, local-storage keys, notes, plans, tests, Jarvis and Voice Saarathi remain intact.

## Changes

### Visual contrast
- Fixed dark text inside the Jarvis Command Centre hero.
- Fixed dark text inside Syllabus Command and other dark syllabus/countdown heroes.
- Added dependable white/light text contrast and subtle shadow without changing button colours.

### Syllabus Command alignment
- Rebuilt the hero as a stable two-column layout on laptop.
- Centred the Coverage Readiness panel.
- Equalised all five summary-card heights and internal icon/number/label alignment.
- Added clean responsive wrapping for tablet and phone.

### UPSC Notes Hub upgrade
- Added a prominent **Generate AI Notes** function to Quick Note and Pro Editor.
- Added note modes: Integrated, One-page, Prelims, Mains, Detailed and Current Affairs.
- Added clean **PDF / Print** output in A4 format.
- Added Copy and Word export to Quick Note.
- AI-generated notes are inserted into the existing note fields and can be saved using the existing storage system.
- Existing Pro Editor AI improve, templates, version history and exports are preserved.

## Deployment
Upload the files from the V29.2 GitHub Update package to the repository root and replace matching files. Do not replace your own Firebase credentials with another file. After GitHub Pages deploys, hard refresh once or clear the old service worker cache.
