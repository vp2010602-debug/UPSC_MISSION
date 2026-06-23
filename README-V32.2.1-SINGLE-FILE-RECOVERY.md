# Mission UPSC AI OS V32.2.1 — Single-File Tracker Recovery

This recovery build fixes the blank JARVIS Tracker screen by embedding the complete Tracker CSS and JavaScript directly inside `index.html`.

## Deployment
Replace only these two files in the repository root:
1. `index.html`
2. `service-worker.js`

Then open the site once with `?v=3221`, for example:
`https://vp2010602-debug.github.io/UPSC_MISSION/?v=3221`

The build also recreates the tracker section if older scripts remove it, displays a visible recovery panel instead of a blank page, and performs a one-time old-cache cleanup.
