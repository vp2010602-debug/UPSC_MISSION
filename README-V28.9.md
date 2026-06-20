# Mission UPSC AI OS V28.9 — Workspace & Vault Fix

## Changes

- Fixed alignment and width overflow in **AI Smart Calendar** Quick Add and AI Time-Block Planner.
- Upgraded **UPSC File Vault** with filters for PDF, documents, images, links, notes and other files.
- Library PDF/website links now appear automatically in File Vault. Existing saved Library links are included; no re-upload is required.
- Restored natural vertical scrolling for laptop mouse wheels and two-finger touchpads.
- Merged **AI Notes Studio** and **Rich Note Studio Pro** into one **AI Notes Studio Pro** navigation workspace.
- Existing legacy AI notes are copied safely into the unified rich-notes library without deleting the originals.
- Preserved Firebase login, existing user data, uploaded files and all other working modules.

## GitHub update

Upload the files from the V28.9 GitHub Update ZIP to the root of the existing repository and replace files with the same names. Keep the existing `firebase-config.js` values.

The service-worker cache version is `v28.9.0`. After GitHub Pages finishes deploying, reload once or use **App & Offline → Check App Update** if an older cached screen remains.
