# Mission UPSC AI OS V31.0 — Step 3 Full Planner Integration

This build upgrades the V31 Master Planner from a visual planner into one integrated route:

Daily / AI / Mentor / Subject inputs → War Card → Checklist → Progress → Gap Report → Revision Radar → Calendar sync route.

## Added in Step 3
- Editable War Card timetable rows
- Checklist status: Pending, Completed, Partial, Skipped, Carry Forward
- Automatic progress percentage
- Subject-wise hour tracking
- Gap report from pending/skipped tasks
- Revision radar generated from completed study tasks
- Carry-forward tomorrow button
- Calendar + Revision sync button using existing `saveCol` routes when available
- Weekly chart auto-generated from mentor decoder
- Better print A4 behaviour

## Safety
Old V30.9.0 code is preserved. Duplicate planning sections are hidden, not deleted.
