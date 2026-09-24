# RIGPOWER agent entry point

Read this file before changing the project. Keep the context needed to continue work in this repository; chat history and machine-local memory do not travel with a Git pull.

## Read in this order

1. `RIGPOWER_PROJECT_NOTES_2026-09-21_195000.md` — purpose, domain conventions, and design principles.
2. `RIGPOWER_SESSION_2026-09-23_INTEGRATION.md` for the combined build and current verification; `RIGPOWER_SESSION_2026-09-23.md` for Chunk 6B implementation and limits; `RIGPOWER_SESSION_2026-09-22_215147.md` for E/F/H decisions; then `RIGPOWER_SESSION_2026-08-24_112141.md` — read the build table, standing instructions, latest completed chunk, and final next-chunks section first; then relevant earlier decisions. Despite its filename, this log includes September 21 work.
3. `RIGPOWER_HANDOFF_2026-09-21_195000.md` — roadmap and known issues. Its build pointer and some completion statuses predate Chunk 6A.
4. `RIGPOWER_REFERENCE.md` — architecture, parsing, electrical and cable logic, and verification details. Revision 2 covers Chunks 1–5; its build pointer and line numbers refer to the August 25 build.

## Current baseline (updated September 23, 2026; integration branch)

- Develop from `RIGPOWER_2026-09-23_222010.html` on `codex/rigpower-integration`: combined Chunk 6B routing, E settings persistence, F live footprints, and H circuit-name assignment. The September 21 regression baseline is preserved in `_to_delete/`.
- `RIGPOWER.html` is the frozen original, not the current app. `_to_delete/` contains retired iterations, not development baselines.
- Paths now drive Auto-Cable lengths, feed ordering, and 3D geometry. Breaks force separately ordered spans; fallback positions are flagged. Read `RIGPOWER_SESSION_2026-09-23_INTEGRATION.md` for combined validation and `RIGPOWER_SESSION_2026-09-23.md` for graph/attachment limits. Both branches are integrated in the current HTML; main has not been updated.
- The app is a single HTML file with inline CSS and JavaScript. Open it in a browser; no package installation, build step, or local server is required. JSZip, Three.js r128, and fonts load from external URLs, so the current build requires network access for those dependencies.

## Resolve conflicting context

Follow the current user's instructions first. For project decisions and completion status, use the latest dated session-log entry over older handoff/reference statements. Inspect the current HTML to establish actual behavior; documentation and historical test reports are not proof that a defect is fixed in a later build. Record discrepancies rather than silently treating stale notes as current. Do not assume a recent documentation filename means every section is current.

## Working rules

- Preserve existing HTML builds. Ship changes in a new `RIGPOWER_YYYY-MM-DD_HHMMSS.html`, using the actual creation time in America/New_York.
- Keep at most four active timestamped iterations in the main folder, FIFO; the frozen original is excluded. Follow the documented retirement procedure and applicable filesystem permissions.
- Make surgical changes; avoid unrelated refactoring. Follow the session log's standing instructions, including its delegation preference where supported. Historical model names describe earlier sessions, not required dependencies.
- Avoid in-place editing of existing HTML through the historical `Edit` tool. Use scripted exact-string replacements with unique-anchor assertions to produce the new iteration; verify written bytes and any copies.
- For code changes, extract the inline application script and run `node --check`, then run focused behavioral checks appropriate to the change. Consult reference section 12 and the relevant session verification notes. Distinguish checks performed now from historical results.
- Maintain one Markdown log per work session with changes, reasons, user-versus-agent decisions, verification results, limitations, and next steps. Documentation can be updated; the iteration rule protects HTML builds.
- When shipping a new build, update this entry point's baseline and relevant handoff/status notes together. Keep all required context in tracked repository files; do not leave essential instructions only in chat.
- Changes must be committed and pushed to reach another machine. State clearly when work remains local; do not claim remote synchronization based only on local edits.
