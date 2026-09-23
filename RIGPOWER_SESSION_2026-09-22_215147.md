# RIGPOWER — Session Log · 2026-09-22_215147

Branch `fix/e-persist-cable-settings` · worktree `AV Tools and plugins/RigPower-wt-e-persist-cable-settings` · forked from `main` @ 7dd4d34.
Builds: `RIGPOWER_2026-09-22_215147.html` (item E, from `RIGPOWER_2026-09-21_204144.html`) → `RIGPOWER_2026-09-22_220732.html` (item F, from the E build).

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

## 8. Next

Still clear of 6B: **H** (circuit-driven patching) is large; **J** (dead-code removal) is small but deletes code sitting next to the live sag code 6B may touch — hold it. C/D, G, I wait for 6B. Merge notes in §4 apply to both E and F (F is 2 anchored hunks in `autoPatch` + Load).
