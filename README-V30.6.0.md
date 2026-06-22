# Mission UPSC AI OS V30.6.0

## Easy Daily Current Affairs

The Daily Current Affairs section now has a zero-token source collector above the existing Tracker workspace.

Workflow:

1. Select trusted source feeds.
2. Press **Fetch & Prepare Today**.
3. JARVIS retrieves RSS headlines through the authenticated Firebase backend.
4. A local UPSC relevance score auto-selects likely useful items without Gemini.
5. Review, open or deselect headlines.
6. Add selected items to the existing source queue.
7. Press the existing **Generate Today's CA with Gemini** button only when ready.

Fetching headlines does not call Gemini. Gemini remains manually controlled and runs as one batch call.

Sources included:

- The Hindu National and Editorial feeds
- Indian Express Explained, Editorials, Economy, Climate and Science & Technology feeds
- PIB Press Releases
- RBI Press Releases and Notifications
- NITI Aayog updates

A failed feed does not stop the other feeds. The source-status panel reports which feeds worked.

## Saarthi Syllabus Micro-Planner

A new tab has been added inside Saarthi Mentorship Hub.

Workflow:

1. Upload a mentor PDF, image or text note.
2. Gemini analyses it once into a saved syllabus tree.
3. Microtopics retain module, topic, page range, estimated study time, Prelims focus, Mains focus, visible provisions/cases/reports and PYQ themes.
4. Mark topics as selected, weak or completed.
5. Set week dates, study hours, daily MCQs, Mains-answer target and test day.
6. Build a token-free local weekly plan, or optionally use one Gemini call to rebalance it.
7. Approve and integrate tasks with Saarthi Board, Smart Calendar, Revision, Mains, Prelims and Test Tracker.

The full PDF is sent only during the initial analysis. Saved maps are reused for future weekly plans.

## Deployment

Upload the frontend update files to the GitHub repository root.

Because V30.6 adds secure RSS collection to the existing backend, deploy Firebase Functions once:

```cmd
npx firebase-tools deploy --only functions
```

The existing `GEMINI_API_KEY` and `OWNER_EMAIL` secrets remain unchanged.

After GitHub Pages deployment:

1. Press `Ctrl + Shift + R`.
2. Fully close and reopen the installed PWA on iPad/iPhone.
3. Sign in with the authorised Google account.
4. Test **Fetch & Prepare Today**.
5. Test the Saarthi **Syllabus Micro-Planner** with a small PDF first.
