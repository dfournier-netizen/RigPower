# RIGPOWER — Session Log · 2026-09-22_215147

Branch `fix/e-persist-cable-settings` · worktree `AV Tools and plugins/RigPower-wt-e-persist-cable-settings` · forked from `main` @ 7dd4d34.
Builds: `RIGPOWER_2026-09-22_215147.html` (item E, from `RIGPOWER_2026-09-21_204144.html`) → `RIGPOWER_2026-09-22_220732.html` (item F, from the E build) → `RIGPOWER_2026-09-22_233803.html` (item H, from the F build).

## 0. Standing instructions (carried forward)

1. Never overwrite a build; ship a new `RIGPOWER_YYYY-MM-DD_HHMMSS.html` with a real America/New_York timestamp taken at creation.
2. Max 4 timestamped iterations in the main folder, FIFO; retired builds go to `_to_delete/`. The frozen `RIGPOWER.html` is excluded.
3. Opus orchestrates; delegate scoped work where supported. Defer decisions to Dom.
4. Build in chunks. Minimal, surgical changes; no refactoring of working systems.
5. Never use the Edit tool on existing files; scripted exact-string splices with unique-anchor asserts, then byte-verify.
6. One markdown log per session; tag every decision **[USER]** or **[AGENT]**.
7. Work on a branch in its own git worktree when another agent is active on the repo.

## 1. Scope

| Decision | Who | Detail |
|---|---|---|
| Skip 6B (another agent owns it); take the next item on a fresh branch | **[USER]** | |
| Use a separate git worktree, not a checkout in the shared folder | **[USER]** | Also chosen independently by the agent; main folder stays on `main`. |
| Pick "whatever is most out of the way of 6B" | **[USER]** | |
| → Handoff item **E** (persist cable-layer prefs + slack) | **[AGENT]** | Touches only Save/Load. C/D (stock lengths) was ranked first but edits `groupCables`/`buildJumper`, which 6B rewires; two-row sweep lives in `sweepOrder`. |
| Do **not** update `AGENTS.md` / handoff baseline pointer on this branch | **[AGENT]** | 6B will edit the same lines. Reconcile at merge time (see §4). |

## 2. What changed

- **Save** (`#btnSaveProj`): project JSON now also carries `_cable` (copy of `PLOT.cable`: power/data/homerun layers, taut/ordered mode, offset, ends/numbers/origins/coils markers), `_showPaths`, and `_slack` (`{pct, minFt}`). Same underscore-meta convention as `_stock`.
- **Load** (`#btnLoadProj`): new `restoreCablePrefs(obj)`, called right after the `_stock` restore; meta keys are then deleted so they never enter `state`.
  - Only keys already present in `PLOT.cable` are accepted, and only with a matching type (finite for numbers). `mode` must be `taut` or `ordered`. Slack values must be finite and ≥ 0. **[AGENT]** — a hand-edited or future-version file can't inject junk, and future keys (e.g. from 6B) degrade gracefully.
  - Files saved before item E carry none of these keys → current settings are left as they are.
  - Syncs the UI: `syncCableButtons()`, `#cabOffset` slider, `#slackPct`, `#slackMin`.
- No other code touched. Diff vs baseline: 3 hunks, +23/−1 lines.

## 3. Verification (performed this session, Chromium via Playwright)

`node --check` on the extracted inline script: OK. 13/13 behavioral checks pass:
save writes all three keys · saved values match UI edits · restore of `PLOT.cable`, `showPaths`, slack · slider/fields/button states restored · no meta keys leak into `state` · `computeAutoCable()` identical before save and after reload · plot tab opens after load with no errors · legacy (pre-E) file leaves defaults untouched · junk values rejected key-by-key (only the one valid key applied) · `computeAutoCable()` on a legacy file **identical to the unmodified 09-21 baseline build** · fresh page → demo → Auto-Cable with no errors (6A TDZ crash regression) · zero page errors throughout.

## 4. Limitations / notes for merge

- Loading a project does not rebuild the 3D plot if it's already open (pre-existing behavior for all loaded state); the restored prefs apply on the next plot render / tab switch / Refresh.
- Transient UI (tool, brush, selection, isolate, snap toggles, draw height, view mode) is still intentionally not saved.
- **Merge with 6B:** both branches fork from `RIGPOWER_2026-09-21_204144.html`, so each produces its own build. The item-E splice is three anchored hunks in Save/Load and should re-apply cleanly on the 6B build (script-driven). If 6B adds new `PLOT.cable` keys, they're persisted automatically. Update `AGENTS.md` baseline + handoff §2 (mark E done) after the merge.
- Committed locally only. `git fetch` failed from the Cowork VM (no GitHub credentials), so **nothing is pushed**.

## 5. Next (as of item E)

Remaining low-overlap candidates while 6B is in flight: **F** (auto-patched instances freeze their footprint; `autoPatch` only). C/D and G should wait for 6B.

---

## 6. Correction to §3 (E verification) **[AGENT]**

The demo rig has **no instances** (instances only come from MVR import), so the §3 `computeAutoCable()` equality checks compared empty output. Re-run with a synthetic 48-instance rig (4 positions × 12, five types, footprints 1/5/13/32/8) auto-patched first: output 26 KB, **identical to the 09-21 baseline** on the same project, identical across save/reload, and confirmed to change when slack changes. All 13 E checks pass on both the E and F builds.

## 7. Item F — auto-patched instances froze their footprint

| Decision | Who | Detail |
|---|---|---|
| Roll into F on the same branch/worktree | **[USER]** | |
| Fix direction: instances always read the fixture type's **live** footprint | **[AGENT]** | Matches manually-patched instances and every existing reader (`instFootprint`, and the `it.footprint‖fixtureFootprint` fallbacks in the patch view). The frozen snapshot was the outlier. |
| Strip stale `footprint` from instances on Load | **[AGENT]** | Otherwise projects saved before the fix keep the divergence forever. No UI ever set a per-instance footprint, so the only source of that key was the auto-patch snapshot. |

**Changes** (build `RIGPOWER_2026-09-22_220732.html`, 2 hunks):
- `autoPatch()`: no longer writes `it.footprint`. Packing still uses `fixtureFootprint(type)`, so assigned addresses are unchanged.
- Load: `obj.instances.forEach(it => delete it.footprint)` after the item-E restore.

**Consequence Dom should know:** widening a type's footprint after auto-patching now immediately shows the overlap in the channel map (red), instead of silently keeping the old width. That's the point of the fix, but it means re-running Auto-Patch (or re-addressing) after footprint edits.

**Verification (this session):** `node --check` OK; bug reproduced on the E build (type footprint 1→8, auto-patched instance still reads 1) and fixed on F (reads 8) · F writes no instance footprint · F auto-patch addresses identical to E's (48 instances, by name) · legacy file saved from E (all instances carry the snapshot) with a type footprint edited: F load strips every snapshot, instances read the new value, all 48 addresses kept · resave has no instance footprint · patch view renders, zero page errors.

## 8. Next (as of item F)

Still clear of 6B: **H** (circuit-driven patching) is large; **J** (dead-code removal) is small but deletes code sitting next to the live sag code 6B may touch — hold it. C/D, G, I wait for 6B. Merge notes in §4 apply to both E and F (F is 2 anchored hunks in `autoPatch` + Load).

---

## 9. Item H — circuit-driven assignment

| Decision | Who | Detail |
|---|---|---|
| Roll into H on the same branch | **[USER]** | |
| Circuit names come in **both** forms | **[USER]** | Form A `SOCA 2.3` / `L21-30 1.2` / `2.3` (multi #, circuit) and form B `L1-7` (circuit counted across the position's multis). |
| Missing multi/circuit → **flag and skip**, never auto-build | **[USER]** | |
| Fixtures already assigned by hand are **never changed**; disagreements listed | **[USER]** | |
| Trigger: **button + preview**, re-runnable | **[USER]** | Patch tab → "⇢ Assign from circuit names". |
| Both forms resolve against the fixture's **own hanging position** (`it.pos`); form B's letters+number are a consistency check (`L1`≈`LX1`, `E2`≈`ELEC2`: same number, one letter-run a prefix of the other) | **[AGENT]** | A fixture fed from another position's multi is flagged, not silently cross-wired. Revisit if that's a real pattern in your rigs. |
| Form A multi number = the UI's ordinal (all multis on the position, as labelled "SOCAPex #N"); a type prefix must match that multi's type | **[AGENT]** | Matches what the 3D assign dropdown shows. `SOCA 2.x` pointing at an L21-30 is flagged, not reinterpreted as "2nd SOCA". |
| Flag when the target circuit already holds 4 other fixture types | **[AGENT]** | `adjustCircuitCount` needs a matching or empty slot; without one the fixture would be linked but its watts silently never counted. Pre-existing limit of the slot model (ref §9 item 20), now surfaced instead of hidden. |
| Bare numbers (`7`) and anything else unparsed → "unrecognised format" | **[AGENT]** | No guess at a third convention. |

**Changes** (build `RIGPOWER_2026-09-22_233803.html`, 3 anchored insertions, nothing existing modified):
- Patch toolbar: new button.
- New `#ckModal` preview, placed outside `<main>` (the CSV modal lives inside the Import view and would be hidden from the Patch tab).
- Logic block after the Patch button wiring: `parseCircuitName`, `resolveCircuitName`, `planCircuitAssign`, `applyCircuitAssign`, `openCircuitAssign`. Apply sets `it.assigned` + `adjustCircuitCount(+1)` — the same two steps as the 3D "Assign all here" — then refreshes leg colours and any visible Calc/Summary.
- Engine untouched: power grouping already keys on `it.assigned`, so Auto-Cable picks up the new assignments with no change. No overlap with 6B.

**Verification (this session, Chromium):** `node --check` OK · parser on 12 inputs (both forms, prefixes, whitespace, junk) · resolution on a seeded 48-instance demo rig: 7 correct targets across SOCA and L21-30 multis and sequential numbering; 7 unresolved with the right reason each (beyond built circuits, type mismatch, multi not built, circuit out of range, wrong position, unrecognised, slots full); hand-assigned fixture with a different target kept unchanged; matching one reported as "already match" · Patch-sheet Circuit entry feeds the plan · modal counts/rows, Cancel applies nothing · Apply: exactly 7 assigned, total watts rise by exactly the 7 fixtures' watts, leg follows the circuit · re-run is a no-op with Apply disabled · assignments survive save · E suite 14/14 and F suite 9/9 on the H build; `computeAutoCable()` identical to the F build · zero page errors.

**Not tested:** real Vectorworks/Lightwright circuit names — none exist in the repo. First real CSV should be run through the preview before trusting it; unresolved reasons will show where the parser needs widening.

## 10. Next

Low-overlap items are exhausted: C/D, G, I, J all touch code 6B is rewiring. Also still to do before a release: update the `AGENTS.md` baseline and handoff §2 (E, F, H done) at merge time.

**FIFO note:** the next build on this branch would retire `RIGPOWER_2026-09-21_204144.html` — the documented baseline and 6B's fork point. Decide at merge whether to exempt it.

---

## 11. Documentation sync after integration — September 23, 2026, 22:38 EDT

Branch `docs/post-integration-sync`, cut from `codex/rigpower-integration` @ `1990b9f`, in worktree `RigPower-wt-docs-post-integration-sync`. Documentation only: no HTML build created, touched or retired.

| Decision | Who | Detail |
|---|---|---|
| Review handoff and notes against the combined build | **[USER]** | |
| Build new items on a local Git branch; check the local Git repo for fresh builds | **[USER]** | Standing rule. Added to `AGENTS.md` working rules and handoff §4 (rules 10–11). |
| Do the docs fix on its own branch, not on the integration branch | **[AGENT]** | Follows the rule above; `codex/rigpower-integration` stays exactly as reviewed. |
| Add a dated **§0 Current status** to the handoff instead of rewriting §1–§2 | **[AGENT]** | Surgical; the older sections stay as history, and the banner already said so. |
| Inline dated status notes in the reference instead of a Revision 3 | **[AGENT]** | Revision 3 (folding in 6A/6B/E/F/H) is a bigger job for Dom to call. |

**Checked on the combined build (`RIGPOWER_2026-09-23_222010.html`, from Git):** inline script passes `node --check`; `restoreCablePrefs` and the `_slack` save key present (E); no `it.footprint=fp`, Load strips it (F); `openCircuitAssign`, `#btnCktAssign` and `#ckModal` present (H). Behavioural suites were not re-run here; the integration log records them.

**Stale items found and fixed:**
- Handoff: build pointer, iteration table, to-do states and "fastest path" all described August 25 → new §0 with the current build, active iterations, an A–K status table and the current way in. §4 gains the Git rules.
- `AGENTS.md`: step 3 still said the handoff predates Chunk 6A → points to §0. It said main hadn't been updated but didn't say the integration branch is pushed → now says both. Added the Git branch, fresh-build and lock-file rules.
- Integration log: "nothing is pushed" is contradicted by `origin/codex/rigpower-integration` = `1990b9f` → dated correction appended (original sentence kept).
- Reference: §4.2 instance `footprint`, §7 "not yet built", §8.2 "not saved", §9 items 3/4/5/9/10/11 → dated status notes.
- Project notes: §6 still listed 6A/paths/H as future work → status note. §5 folder map → adds `tests/`, `tools/`, and the Git note.

**Found, not changed (for Dom):**
- Dead code (J) is unchanged, and the in-file 6A comment claiming `curveLen()` has a job is now false. A code fix, so it's for a build session.
- K (`segments[]` uniformity) needs rechecking against 6B's routed home-run segments.
- The Codex worktrees under `C:/Users/CDT_LD/.codex/worktrees/` show as "prunable" from the Cowork VM because it can't see Windows paths. They are live; don't prune from there.
- Older session logs (`…_08-24_112141.md` §13, and this log's §§4, 10 on push status and FIFO) are records of their time and were left as written.
