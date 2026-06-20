# Jarvis UPSC V28.8 — Login & Interface Fix

Base: V28.7 Usability Fix.

Changes:
- Fixed the Safari async error caused by an undefined `safe` helper in the Google Docs & Links renderer.
- Reworked Google sign-in with local persistence, popup-first login, redirect fallback, and friendly error messages.
- Replaced “Not signed in / Google Login” with a clearer cloud-backup card and “Continue with Google”.
- Made the page header compact on mobile and replaced the long technical dashboard description.
- Updated service-worker cache to V28.8 so deployed devices receive the correction.

Firebase note: the deployed GitHub Pages domain must be listed under Firebase Authentication → Settings → Authorized domains.
