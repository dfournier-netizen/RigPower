# RIGPOWER — Session Log · 2026-08-24

**Session started:** Monday, August 24, 2026
**Timestamp captured at first file creation:** `2026-08-24_112141` (11:21:41 AM EDT)
**Base file:** `RIGPOWER.html` (126,373 bytes, frozen pre-merge standalone) — **not modified**
**Iterations produced this session:**

| File | Time | Bytes | Contents |
|---|---|---|---|
| `RIGPOWER_2026-08-24_112141.html` | 11:21:41 EDT | 138,172 | Chunk 1 — 3D cable layer |
| `RIGPOWER_2026-08-24_121848.html` | 12:18:48 EDT | 152,489 | Chunk 1 + Chunk 2 — nav & selection suite |
| `RIGPOWER_2026-08-24_124341.html` | 12:43:41 EDT | 168,314 | Chunks 1–3 — **all four requested adds complete** |
| `RIGPOWER_2026-08-24_162303.html` | 16:23:03 EDT | 178,732 | Chunk 4 — cable-order logic fix, run markers, per-family offsets |
| `RIGPOWER_2026-08-25_103037.html` | Aug 25, 10:30:37 EDT | 183,403 | Chunk 5 — monotonic sweep chains, coiled slack |
| `RIGPOWER_2026-09-21_204144.html` | Sep 21, 8:41:44 PM EDT | 213,717 | Chunk 6A — cable path tools, plan view, draggable devices |

**FIFO [AGENT]:** the 4-copy cap applies to *iterations*; the original `RIGPOWER.html` is protected by standing instruction §0.1 and is not counted. Evicted so far: `…_112141.html` (Chunk 1) and `…_121848.html` (Chunk 2). This environment has no delete permission for the mounted folder, so evictions are **moved to `RIGPOWER/_to_delete/`** rather than removed — delete that folder when convenient.
**Orchestrator:** Claude Opus 5 (high effort). Sub-tasks delegated to lower-tier agents.

---

## 0. Standing instructions for this and all future RIGPOWER sessions

> These are carried forward verbatim so later sessions follow the same protocol.

**User-specified, 2026-08-24:**

1. **Never overwrite the existing file** in the `RIGPOWER` subfolder of `AV Tools and plugins`. Every change ships as a **new iteration** with today's date and time appended to the filename.
2. **Take a real timestamp at the moment of file creation** — not an estimate, not a reused value from earlier in the session. (`TZ=America/New_York date +%Y-%m-%d_%H%M%S`)
3. **Iterate, don't overwrite. Maximum 4 copies total, FIFO** — oldest iteration is deleted when a fifth would be created.
4. **Use agents as much as possible.** Opus 5 is the orchestrator and planner; small, well-scoped tasks go to lower-level agents.
5. **Defer to the user for decisions and guidance.** Always ask when clarification or direction is needed.
6. **Build in chunks** so the usage limit isn't burned in one pass.
7. **Maintain a single markdown file per session** (this file) recording edits, additions, and all decision-making and reasoning — with **explicit attribution of what is user-specified vs. agent-specified.**

**Carried in from prior sessions (project memory):**

8. **Do not use the `Edit` tool on existing files in this environment.** The Windows↔sandbox filesystem bridge has silently corrupted in-place edits (reported success, file truncated/NUL-padded to its pre-edit byte length) on at least four occasions. Do surgical rewrites via scripted string replacement in the sandbox, and **byte-verify** (`wc -c`, `md5sum`) on both sides of any copy.
9. Minimal, surgical changes. No refactoring of working systems.

---

## 1. Requested adds (user-specified)

| # | Add | Status this session |
|---|---|---|
| 1 | New selection tool suite for the 3D Plot tab — lasso, rectangular, etc. | **Chunk 2 — DONE, verified** |
| 2 | Pan, orbit and other 3D navigation tools for the 3D Plot tab | **Chunk 2 — DONE, verified** |
| 3 | Graphical patch view (device grid / sort by universe) | **Chunk 3 — DONE, verified** |
| 4 | 3D cable layer with a simple rendering engine, accurate length relative to the space, including jumpers and data cables from the auto-cable engine — *"I need a way to visualize what the auto cable engine is actually doing"* | **Chunk 1 — DONE, verified** |

---

## 2. Decisions taken

Every decision below is tagged **[USER]** (Dom chose it) or **[AGENT]** (Claude decided it, within the latitude given).

### 2.1 Scope & sequencing

| Decision | Who | Detail |
|---|---|---|
| Cable rendering goes **first**, not the nav/selection work | **[USER]** | Chose "Cable rendering first" from four offered orderings. Rationale given in the request: it's the one that answers a real need — seeing what auto-cable actually computes. |
| Split into chunks: 1 = cable layer, 2 = nav + selection, 3 = patch view | **[AGENT]** | Proposed to protect the usage budget; nav and selection are grouped because they share one mouse-interaction layer and writing it twice would be waste. |
| Verification is a first-class step, run by a separate agent | **[AGENT]** | A headless Chromium harness with a synthetic rig, not eyeballing. Details in §5. |

### 2.2 Three.js version — *reversed mid-session*

| Decision | Who | Detail |
|---|---|---|
| Initially: upgrade to a modern r1xx + OrbitControls | **[USER]** (first answer) | — |
| **Final: stay on r128, do not upgrade** | **[USER]** (revised) | Dom backed up and chose the simpler path after being shown the cost. |
| The information that prompted the reversal | **[AGENT]** | Modern Three.js (r160+) dropped the UMD `<script>` build entirely — it is ESM-only. Adopting it inside a 2,320-line single classic `<script>` requires an import map plus a module/classic boundary, i.e. structural surgery on a working file. The alternatives were an r159 UMD pin (deprecated dead end, plus r155 changed light intensities and colour output so the plot would need re-tuning to look the same) or a hand-rolled shim. **Consequence:** the missing pan control and the selection marquee in Chunk 2 will be hand-rolled against the existing spherical-orbit code. Chunk 1 needed nothing newer than r128 — `TubeGeometry`, `QuadraticBezierCurve3` and `LineCurve3` all exist there and were confirmed working. |

### 2.3 Cable layer — what gets drawn

| Decision | Who | Detail |
|---|---|---|
| Draw **power jumpers, data chains, home runs, and slack/droop** | **[USER]** | All four options selected. |
| Length semantics: **both taut and ordered, toggleable** | **[USER]** | Chose "Both, toggleable" over either alone. |
| Home runs **default off**; power + data default on | **[AGENT]** | Home runs are long and visually dominate; they're the least-often-wanted layer. Toggle is one click. |
| Home-run *parts* are still **not tallied** | **[AGENT]** | The existing engine deliberately omits them to avoid double-counting the Cables tab's multicable home runs (documented limitation §9.2 of the reference). Drawing them is new; counting them is a separate decision and stays out of scope until asked. |

---

## 3. What changed in the file — Chunk 1

Eleven anchored splices, then five more for the fix pass. All applied by scripted exact-string replacement with a `count == 1` assertion per anchor, so a drifted anchor aborts rather than silently mis-patching.

### 3.1 Data plumbing — exposing the geometry the engine was throwing away

The root problem: **`computeAutoCable()` computed every cable run's endpoints and then discarded them**, returning only aggregate part counts (`"True1|25" → 4`) plus a lightweight detail array of rounded lengths. There was nothing to draw.

| Change | Where | Attribution |
|---|---|---|
| `groupCables()` now keeps each jump's endpoints — `{ft, std, a, b}` instead of `{ft, std}` — and returns the home-run's endpoints and the `origin` it used | `groupCables` | **[AGENT]** |
| `computeAutoCable()` gained a `segments[]` channel: one entry per physical run, `{kind, group\|universe, a, b, aId, bId, raw, std}`, with `kind` ∈ `power` / `data` / `homerun-power` / `homerun-data` | `computeAutoCable` | **[AGENT]** |
| Both changes are **purely additive** — existing keys, part totals, and the Auto-Cable tab's tables are untouched | — | **[AGENT]** |

### 3.2 Coordinate transform — sharing it instead of duplicating it

`renderPlot()` computed the mm→scene-unit transform (`cx, cy, minZ, SC`) as function-locals. The cable builder needs the *identical* transform or cables land off the fixtures.

- `renderPlot()` now publishes `PLOT.xform = {cx, cy, minZ, SC}`. **[AGENT]**
- `plotVec(p)` applies it: `(x−cx)·SC, (z−minZ)·SC, (y−cy)·−SC` — the same MVR-Z-up-mm → three.js-Y-up mapping the fixture meshes use. **[AGENT]**
- Deriving the transform independently was rejected — it would drift the moment the scaling rule changes. **[AGENT]**

### 3.3 The sag model — and the bug the verifier caught

This is the interesting part, and the first version was **wrong**.

**First attempt [AGENT]:** size the droop with the textbook shallow-parabola arc-length identity, `L ≈ d·(1 + 8/3·(s/d)²)`, inverted to `s = √(3·d·slack/8)`.

**What the verification agent found:** that identity is a small-angle Taylor expansion, valid only when sag/span is small. Real jumper overage doesn't land there. Rounding a 9.8 ft gap up to a 15 ft stock jumper produces a sag/span ratio of ~0.44, where the approximation falls apart. Measured result: a run labelled 15 ft was drawn as **13.73 ft of cable — an 8.47 % shortfall**, independently confirmed by numerically integrating the true parabola. Every slack-bearing segment on the test rig was off by **5.3–8.5 %**, and the error grows in exactly the regime the tool is meant to expose. Not a crash — a silent lie, and it would have undercut the entire point of the feature.

**Fix [AGENT]:** dropped the closed form. `solveSagScene()` now bisects on the **true sampled arc length** of the actual quadratic Bézier — expand the upper bound, then 24 halvings against a 32-sample arc measurement. Exact by construction rather than by approximation.

- Measured error after the fix: **≤ 0.02 %** on the same rig (from 5.3–8.5 %). Taut mode is exact to 0 %.
- Cost: ~5 ms for a 16-segment rig, ~73 ms average for a 240-segment / 120-fixture rig. Only on rebuild. Acceptable.
- **Clamp retained [AGENT]:** when the ordered length is absurdly longer than the gap — a 5 ft minimum-stock jumper across a 7 in. gap — an honest droop is a giant loop. Those runs draw at max sensible sag (`min(chord·1.6, target·0.9)`), get flagged `clamped`, and the hover readout says **"sag clamped — coil this one"**, which is what you'd actually do with it. Verified: no throw, valid geometry, drawn shorter than `std` as expected.
- Bisection termination was stress-tested against zero-length chords, `target = 1e12`, and `NaN`. All return finite in ≤ 5 ms; runaway looping is structurally impossible (40-iteration growth cap + fixed 24-iteration bisection).

### 3.4 Rendering

| Choice | Detail | Attribution |
|---|---|---|
| `TubeGeometry` along the curve | 16 tubular segments when curved, 1 when straight; radius `PLOT.span × 0.0016`. Confirmed non-degenerate at `tubularSegments = 1` on r128. Fat-line addons don't exist in r128 core. | **[AGENT]** |
| Cables live in their own `PLOT.cableGroup` | Added to the scene, **not** to `PLOT.group` — so `renderPlot()`'s wholesale clear of the fixture cloud doesn't touch them, and cables never enter `PLOT.meshes`, which means **fixture picking is completely unaffected**. Verified. | **[AGENT]** |
| Colour: power = leg colour (X blue / Y green / Z yellow, amber when unassigned); data = DMX purple or Cat5e teal; home runs = muted blue-grey at 75 % opacity, thinner | Reuses the existing `LEG_COLORS` and CSS palette so nothing new enters the visual language. | **[AGENT]** |
| Explicit geometry + material disposal on every rebuild | `clearCables()`. Verified no leak across repeated renders. | **[AGENT]** |

### 3.5 UI

Added to the 3D Plot toolbar, following the file's existing convention (`.small-cap` group label + `.btn-sm` buttons + inline active styling matching `setActive`):

- **Cables:** `Power` · `Data` · `Home runs` — independent toggles
- **Taut** / **Ordered** — mode pair
- **↻** — recalculate from current circuit assignments and patch
- A live stat readout: `13 runs · 128' true / 195' ordered · 67' slack`
- **Hover any cable** → tooltip with the run's true gap, the ordered stock length, the slack (amber when > 0), and the clamp note where it applies
- Legend gains a cable section below the fixture legend

**Legend bug, also caught in verification [AGENT]:** the first version appended its legend block with `innerHTML +=`, so every toggle click stacked another copy — unbounded growth, and a full `renderPlot()` already left two blocks (one stale). Rewritten to own exactly one `#plotCableLegend` element and replace it in place. Verified at exactly 1 across repeated renders, repeated rebuilds, and real button clicks.

---

## 4. Agent delegation — what was farmed out

| Agent | Model | Task | Outcome |
|---|---|---|---|
| `Explore` | Sonnet | Map the 2,320-line file: exact line numbers and names for the 3D plot, patch, auto-cable and shared plumbing; identify whether `computeAutoCable` retains endpoint coordinates | Delivered a precise map. **Its finding that the endpoints were discarded set the whole shape of Chunk 1.** |
| `general-purpose` | Sonnet | Headless Chromium verification: syntax check, console capture, synthetic 8-fixture rig, 10 assertions, per-segment arc-length measurement, perf | **Found both real bugs.** Neither was visible from reading the code. |
| same agent, resumed | Sonnet | Re-verify both fixes; adversarial clamp and termination testing; legend idempotency across four interaction paths; perf at 120 fixtures | All PASS. No new issues. |

Orchestration (planning, the sag model, all splice authorship, the fix design) stayed with Opus. The split reflects where judgment was actually needed versus where mechanical thoroughness was.

---

## 5. Verification record

Real Three.js r128 + JSZip from CDN in headless Chromium — not a stub. Synthetic rig: 8 fixtures in a line at 3 m spacing, 6 m trim, two power circuits, one universe, one placed distro.

| Check | Result |
|---|---|
| `node --check` on the extracted app script | PASS |
| Console + page errors on load | Zero |
| `segments[]` count and shape | PASS — 16 segments = 6 power + 2 homerun-power + 7 data + 1 homerun-data |
| Mesh count vs. enabled layers | PASS — 13 meshes with home runs off; 16 with them on |
| **Ordered-mode arc length vs. ordered stock length** | **PASS — max error 0.0199 %** (was 8.47 %) |
| **Taut-mode arc length vs. true gap** | **PASS — 0.0000 %** |
| Clamp path (0.59 ft gap → 5 ft stock) | PASS — flagged, no throw, finite geometry, honestly shorter |
| Bisection termination under adversarial input | PASS — finite in ≤ 5 ms for zero chord, `1e12` target, `NaN` |
| Legend idempotency (4 interaction paths) | PASS — exactly 1 element every time |
| Fixture picking unaffected | PASS — `PLOT.meshes.length === 8`, no cable meshes present |
| Leak on repeated `renderPlot()` | PASS — stable, group children track mesh array exactly |
| Empty-instances path | PASS — no exception |
| Perf, 16 segments | 5.1 ms average |
| Perf, 240 segments / 120 fixtures | 73.1 ms average, 157.5 ms worst — under the 250 ms bar |

---

## 6. Known edges carried forward

1. **Chains are nearest-neighbour**, unchanged from before — optimal for a row of fixtures on a truss, not a guaranteed shortest path for scattered layouts. The 3D layer now makes bad chain ordering *visible*, which is arguably its most useful side effect.
2. **Home-run parts are drawn but not tallied** — see §2.3.
3. **Sag is drawn in the vertical plane only.** A cable running straight down a truss leg droops toward the floor rather than bowing sideways. Correct for the common case, slightly odd for near-vertical runs.
4. **Clamped runs under-draw by design.** The tooltip says so.
5. **The cable layer needs the plot rendered once** to have a transform; opening the 3D Plot tab is enough.
6. **Screen-space selection is depth-blind.** A rectangle or lasso grabs everything whose projected centre falls inside it, including fixtures behind other fixtures. This is standard marquee behaviour (Vectorworks, Blender and Maya all do it), but worth knowing when selecting into a deep rig from the front — orbit to a clearer angle, or isolate first.
7. **Grow / Shrink by proximity** was offered and declined; the hook (`applySelection`) is there if it's ever wanted.
8. **Selection does not dim the cable layer** — declined as a standalone feature. Isolate is the current way to get that effect.
9. **The channel map draws one cell per row-piece of a run.** A fixture spanning a row boundary reads as two adjacent blocks rather than one wrapped shape. Inherent to a 32-wide grid; the shared colour and label make it read correctly.
10. **A single overlapped channel can only show one colour**, so it renders red rather than either owner's colour. The header count and the patch table's ⚠ overlap flag carry the detail.
11. **Drag re-address is single-fixture.** A multi-selection is not moved as a block.
12. **Chain ordering is now a strict sweep** (Chunk 5), which never doubles back but costs ~19.6% more cable than the old greedy walk — mostly on two-row positions, where a sweep interleaves the rows. A "sweep out, one return leg back" variant would recover most of that; see §11.1.
13. **Ring/cone markers anchored at a deck-level fixture** extend up to 0.12 scene units below y=0 — their own geometric radius, not sag. Number badges were lifted; the solid markers were not.
14. **Home-run parts are still not tallied**, so the 415 ft saving figure covers ordering correctness across all segments, while the Auto-Cable parts *tables* still scope to jumpers only.
15. **Paths do not affect the cable math yet** — 6A is tools only. They are drawn, measured and saved; `computeAutoCable` ignores them entirely, verified byte-identical.
16. **A path's `carries` field is stored but unused** until 6B.
17. **Swag sag defaults to 8 % of span** and is editable per path via `pa.sag` (feet), but there is no UI field for it yet — only the numeric point table and the saved JSON.
18. **A run drawn with a single point** renders as a marker rather than erroring. Harmless, but it is not a run.

---

## 8. Chunk 2 — navigation + selection suite

### 8.1 Decisions

| Decision | Who | Detail |
|---|---|---|
| **Modal tool with always-on nav** | **[USER]** | Left-drag runs the active tool (Orbit / Pan / Rect / Lasso / Paint). **Middle-drag always pans, right-drag always orbits**, whatever tool is selected — so navigation never requires switching out of a selection tool. Wheel dollies. Shift adds, Alt subtracts. Chosen over "modal only" and over a selection-first mapping that would have changed the existing orbit feel. |
| Selection ops: **All / None / Invert**, **Select Similar**, **Paint brush** | **[USER]** | Grow/Shrink-by-proximity was offered and **not** selected — left out. |
| Selection drives: **bulk assign (unchanged)**, **Isolate/hide**, **cross-tab highlight in Patch** | **[USER]** | "Selection dims the cable layer" was offered and **not** selected — left out as a standalone feature, though Isolate does hide untouched cables (see 8.3). |
| Keyboard: `1`–`5` tools, `A`/`N`/`I`/`S`/`H`/`F`, `Esc` deselects | **[AGENT]** | Scoped to the 3D tab and suppressed while focus is in any input/select/textarea. |
| Isolate also hides cables that touch no visible fixture | **[AGENT]** | Not literally requested. Isolating one circuit while leaving every other circuit's jumpers drawn would make the isolated view unreadable — the two features would fight. This is the minimum needed for Isolate to mean anything alongside Chunk 1. |

### 8.2 The interaction collision, and how it was resolved

The existing plot inferred intent from the gesture: left-drag orbited, and a press that moved **less than 6 px** counted as a click and picked a fixture. A rubber-band marquee is *also* a left-drag, so gesture-inference alone could no longer disambiguate. **[AGENT]** resolution: make the left button **modal** (it does whatever tool is active) and give navigation **dedicated buttons** that work in every mode. The 6 px threshold survives untouched — under a nav tool, a sub-6 px left press still routes to the original `pickFixture`, so the picking behavior you already have muscle memory for is byte-for-byte the same.

### 8.3 What was built

**Navigation**
- `panCamera(dx,dy)` slides the orbit target along the camera's own right/up axes, scaled by the current dolly distance so the drag feels identical at any zoom. **Pan did not exist before this chunk.**
- Orbit and wheel-dolly are unchanged r128 spherical math.

**Selection**
- `cacheProjections()` projects every *visible* fixture mesh to canvas pixels **once, at drag start**. The camera can't move during a selection drag, so one projection pass serves the whole gesture — 3.5 ms for 120 fixtures.
- **Rect** — screen-space box test. **Lasso** — `pointInPoly` ray-casting against the traced path; verified correct on a genuinely concave C-shaped path. **Paint** — a radius brush (10–120 px slider) that accumulates onto the selection as it existed when the stroke began, so re-crossing a fixture never toggles it back off. Verified monotonic in both add and subtract directions.
- **Select Similar** matches on type / position / universe / **assigned circuit** (`positionId|multiId|circuitIndex`) / CSV circuit name. Given this tool's data model this is arguably the most useful selector in the set: click one fixture, get its whole circuit. Guarded against the obvious trap — a seed whose value for the chosen attribute is `null` toasts rather than sweeping up every other null-valued fixture.
- **Isolate** hides unselected fixtures and every cable run touching none of them; survives a `buildCables()` rebuild.
- A `#plotOverlay` 2D canvas sits above the WebGL canvas for the marquee, lasso path and brush ring; cleared on mouseup.

**Cross-tab link with Patch**
- Rows for 3D-selected fixtures get an amber left-bar and tint. A **"3D selection only"** checkbox filters the table to them.
- Clicking a row (anywhere outside the editable cells) drives the 3D selection; Shift-click extends. Clicking into a universe/address field does **not** disturb the selection.

### 8.4 Verification — Chunk 2

Full 16-item suite, real Three.js r128 in headless Chromium, 12-fixture two-position rig plus a 120-instance perf rig. **All 16 PASS. No bugs found.**

Highlights: orbit/pick/6 px threshold unregressed · middle-pan and right-orbit override correctly from inside a selection tool · rect add/subtract chains to the right counts · concave lasso excludes the fixture in the notch · paint monotonic both directions · Select Similar by circuit returns exactly that circuit's 4 fixtures and the null-key case is safe · Isolate survives a cable rebuild · overlay draws and fully clears · keys suppressed in inputs and on other tabs · patch cross-link correct in both directions · zero exceptions with `state.instances=[]` · hidden fixtures cannot be marquee-selected while isolated.

Chunk 0/1 regression re-run inside the same suite: ordered-mode cable arc length still **0.0245 %** error, one `#plotCableLegend`, no mesh leak.

*Process note: the verifying agent hit a flaky failure on the navigation items and correctly traced it to **its own harness** reading `mesh.position.project(camera)` in the gap between `updateCam()` and the next render frame, racing a stale `matrixWorldInverse` — not an app defect. Real interaction has no such gap. Recorded here because a future session re-running that suite will otherwise re-discover it: force `camera.updateMatrixWorld(true)` before reading projected coordinates in test code.*

---

## 9. Chunk 3 — graphical patch view (universe channel map)

### 9.1 Decisions

| Decision | Who | Detail |
|---|---|---|
| **32 × 16 block grid** per universe, not a linear strip | **[USER]** | Chose the compact square block over a horizontal 512-wide track and over a both-modes toggle. It's the console/patch-sheet look: you scan a *shape*, so holes announce themselves. |
| Interactions: **click → select**, **hover detail**, **drag to re-address**, **free-gap sizes** | **[USER]** | All four selected, including the drag re-address, which was flagged as much the largest piece of work in the chunk. |
| Runs **follow the 3D plot's colour mode** (leg / position / type) | **[USER]** | Chosen over a fixed by-type or by-position scheme, for one mental model across both views. In leg mode the map will show you a universe that's crossing phases. |
| Colour-mode buttons appear in *both* tabs and stay in sync | **[AGENT]** | "Follow the plot" is useless if you have to leave the Patch tab to change it. Either tab's buttons set `PLOT.colorMode` and refresh both views. |
| A **spare empty universe** is always appended to the list | **[AGENT]** | Without one there is nowhere to drag a fixture *out* to. Costs one extra block; makes "move this to a fresh universe" a drag instead of a typed edit. |
| The existing **Universe Map usage bars are kept**, not replaced | **[AGENT]** | Standing instruction §0.9 — minimal, surgical. The bars are a one-glance summary; the map is the audit tool. They answer different questions. |

### 9.2 The one interesting implementation choice

A literal 512-cell grid per universe is the obvious build and the wrong one: 512 DOM nodes × N universes, re-rendered on every address edit and every drag frame, with no room to letter a run.

**[AGENT]:** consecutive channels sharing an owner are **coalesced into a single CSS-grid cell spanning them** (`grid-column: span N`). A universe holding 20 fixtures draws roughly 100 elements instead of 512, and a wide run has room for its FID. Because every row is still exactly 32 uniform columns, nothing is lost — the grid geometry is unchanged, so **pointer → channel is pure arithmetic off the container's bounding rect**, not `elementFromPoint`. That matters for the drag: hit-testing against coalesced cells would have been ambiguous, whereas arithmetic gives exact per-channel resolution regardless of how the cells happen to be merged.

Verification confirmed the coalescing is lossless: the per-channel owner array reconstructed from the rendered DOM matched the computed occupancy for all 512 channels in all three test universes, with every row's spans summing to exactly 32.

A fixture spanning a row boundary produces one cell per row. Free gaps are labelled with the **full span length at every piece** — a 24-channel hole straddling channel 32 renders as two cells both reading `24`, not `8` and `16`. That was tested explicitly.

### 9.3 What was built

- **Per universe:** header with used/total, percentage, an overlap warning with the exact channel count, and the three largest free gaps as `24ch @ 25` chips. Left gutter labels each row's first channel.
- **Runs** carry the fixture's FID when wide enough; hover gives a tooltip with FID, type, mode, position, circuit, universe/address range and footprint.
- **Free gaps** are hatched and labelled with their size — so "where does a 16-channel fixture fit" is a glance, not arithmetic.
- **Overlaps** render red across exactly the intersecting channels.
- **Click** a run to drive the shared selection (shift extends) — the same selection the 3D plot and the patch table use, so the map is a third view onto it.
- **Drag** a run to re-address: live green/red ghost, a readout showing the proposed `U1 @ 200–215 free`, grab-offset preserved (grab the middle of a run and the run moves, not its start), clamped to the universe bound, refused on collision with a warn toast, committed only on a clean drop. Drag across grids to change universe. Esc cancels.
- Respects `#uniSize`, so a 256-channel universe draws 8 rows and clamps accordingly.

### 9.4 Verification — Chunk 3

Full 16-item suite plus a Chunk 0–2 regression pass. **All 16 PASS. No bugs found.** Test rig deliberately built with a row-straddling 24-channel hole and a real 8-channel overlap.

Highlights: coalescing lossless across 1,536 channels · gap labels show the full span on both row-pieces · overlap cells match ground truth exactly · `instanceColors()` agrees with `applyColorMode()` for every instance in all three colour modes (they build their palettes independently, so this was the drift risk — zero disagreements) · grab offset honoured (grabbed at +8, dropped over 300, landed at 292) · collision refused and address left unchanged · cross-universe and drag-into-spare-universe both correct, with a fresh spare appended after · clamp to 497 at 512 and 241 at 256 · Esc leaves no stray ghost cells · dragged fixture not double-drawn · `host._wired` prevents double-binding across 5 re-renders · zero exceptions on empty state, null address, pre-existing over-range fixture, stray mouseup, and zero footprint.

Perf at 120 instances / 8 universes: full map render **10.9 ms**, per-drag-frame repaint **0.5 ms**.

*Process note: the verifier's first pass failed items 7–10 uniformly — traced to **its own harness** computing click coordinates for grids that sat below the test viewport's fold on a 2,650 px page. Not an app defect; a real user scrolls. Fixed by scrolling the target grid into view before synthesising pointer events. Recorded so a future session re-running that suite doesn't rediscover it.*

---

## 10. Chunk 4 — the droop was a symptom, not a rendering bug

Dom's note on seeing the first render: *"things are a bit ugly — let's clean up that crazy curve. lower the overall curve, and look into those crazy long curves and see whats up there."* Plus two adds: start/end markers per cable, and offsetting cables by type so power and data are separable.

**The important outcome: the "crazy curves" were not a drawing problem. The visualisation was working — it was showing a real defect in the cable-ordering logic that had been invisible while the output was a table of numbers.** That is exactly what the feature was built for.

### 10.1 Diagnosis (delegated, 90-fixture synthetic rig matching Dom's real export)

| Cause | Evidence | Verdict |
|---|---|---|
| **`roundUpStd` ordered ONE stock length per run** | Stock table jumps 50 → 100 with nothing between, so every 46–77 ft home run was ordered as a flat **100 ft** — up to **117% over**. 30 segments had `std ≥ 2 × raw`. | **Genuine defect** |
| **The +1 ft slack floor** | `max(gap × 1.10, gap + 1)`. A 4.67 ft truss hop needs 5.67 → skips the 5 ft jumper, takes a 10 ft. **114% over on the shortest, most numerous runs.** | **Genuine defect** |
| **Data chains grouped by universe alone** | `autoPatch` packs universes by channel count with no position awareness, so 3 of 4 universes straddled two trusses. The chain then made a real **39.7 ft leap** from one truss to the next — and it was the *last* hop in the chain, the classic greedy-nearest-neighbour stranding signature. Power never had this problem because power groups are keyed to a position. | **Genuine defect** |
| Every group home-running to one distro | 71.6% of all drawn length was home run, not jumper. | Correct behaviour, amplified by the two defects above |
| Greedy nearest-neighbour chain order | Chain totals ran 33–63% over a naive nearest-neighbour bound. | Real but secondary — documented, not fixed |

And the sag was doing precisely what it was told: draw 100 ft of cable between two points 46 ft apart. The deepest curve dipped **30 ft below the floor plane — more than the entire rig height.**

### 10.2 Decisions

| Decision | Who | Detail |
|---|---|---|
| **Don't damp the curve — fix the logic** | **[USER]** | Offered a droop slider, coil markers, or both. Dom rejected all three: *"that's way too much waste — if we have overages that are that large, we should readjust our logic."* Correct call, and the reason this chunk is an engine fix rather than a cosmetic one. |
| **Route auto-cable through `buildRun`** | **[USER]** | The app already contained a correct least-overage multi-piece solver — in the Cables tab. Auto-cable had its own naive one. Two algorithms for the same job in one file; auto-cable got the worse one. Now there is one. |
| **Slack allowance becomes user-editable** | **[USER]** | Percentage + minimum-feet fields in the Auto-Cable tab, default 10% / 0.5 ft. Dom sets the dress allowance, not the model. |
| **Split data chains by position** | **[USER]** | Mirrors what power already does. Chose this over fixing `autoPatch` upstream, which would have changed the patch itself and burned universes faster. |
| Floor clamp on sag | **[AGENT]** | Cable lies *on* the deck; it does not tunnel under it. Needed regardless of the ordering fix. |
| Offsets: lateral **and** vertical, with a slider | **[USER]** | Power below and to one side, data above and to the other, home runs lower still. Slider because the right separation depends on fixture spacing. |
| Markers: directional, numbered, origin emphasised | **[USER]** | All three. Ring at each run's source, cone at its destination, octahedron at the device everything feeds back to, optional numbered badges. Numbers default **off** — at 90 fixtures they are noise until you want them. |

### 10.3 Result

| Measure | Before | After |
|---|---|---|
| Total cable ordered, all 180 segments | 2,615 ft | **2,200 ft** |
| True measured distance | 1,648 ft | 1,648 ft |
| **Saving** | — | **415 ft (15.9%)** |
| Worst single-run overage | 100 ft ordered for a 46 ft gap (117%) | multi-piece builds, e.g. 77 ft → 50+25+5 |
| Deepest curve below the deck | −30 ft (≈120% of rig height) | **0.000 — provably none** |
| Data groups spanning two positions | 3 of 4 | **0 of 7** |

The parts tables are also now more useful: a run is tallied **per piece**, so an 80 ft build contributes one 50, one 25 and one 5 rather than a single fictitious 80 ft cable.

### 10.4 Three bugs in my own work, all caught in verification

1. **`buildRun` takes an integer target.** It does an integer DP and iterates `for(s=target; s<=cap; s++)`. I was handing it a fractional `need` (5.137), so every lookup indexed `dp[]` at a non-integer, found nothing, returned `{ok:false, reason:'unreachable'}`, and my fallback branch would have ordered **every single cable as a multiple of 100 ft** — catastrophically worse than the bug I was fixing. Caught before the file was written. Fix: pass `Math.ceil(need)`, which is *exact* rather than approximate — all stock sizes are integers, so every achievable total is an integer, so the smallest achievable total ≥ `need` is identical to the smallest ≥ `ceil(need)`. Verified by brute force against 56 targets: zero mismatches.

2. **My own new offset defeated my own new floor clamp.** The per-family vertical offset was applied to the endpoints *before* `cableCurve` computed its floor guard, so a deck-level distro was already below y=0 before any sag was solved. Fixed by flooring both endpoints after the offset.

3. **The floor clamp formula was wrong for asymmetric runs — twice.** I asserted a quadratic Bézier's lowest point is `midY − h/2`. That is only true when both endpoints are at the same height. For a floor-to-truss home run the minimum sits elsewhere on the curve entirely, and runs still tunnelled to −0.51 after the first "fix". The verifier caught it and proposed `maxH = midY`, which is safe but over-conservative — it would have halved legitimate sag on every mid-air run. I solved it exactly instead:

   > With the control point dropped by `h` from the endpoint midpoint, `B(t).y = y0 + 2t(y1−y0) + t²(y0−2y1+y2)` where `y1 = (y0+y2)/2 − h`. Substituting gives `A = 2h`, `B = (y2−y0) − 2h`; requiring the vertex value `y0 − B²/(4A) ≥ 0` reduces, using `y0 + d = y2`, to
   > **`h ≤ (√y0 + √y2)² / 2`**

   For equal-height ends this returns `2·midY` — identical to the old symmetric answer, so no legitimate sag is lost. For a run off the deck (`y0 = 0`) it returns `y2/2`, putting the curve's minimum exactly on the floor. Proven numerically over eight endpoint pairs: minimum y = 0.000000 in every case, i.e. **tight, not slack**. Verified rig-wide afterwards: 0 of 180 curves below the floor, and no new clamping on equal-height runs (power 20→20, data 25→25, home runs 19→31 — the increase is correct, those are the floor-anchored runs the old formula was wrongly letting through unflagged).

### 10.5 One thing Dom should know

**At the approved 10% / 0.5 ft default, a 4.67 ft truss hop still orders a 10 ft jumper.** The `Math.max` of the two rules means the 0.5 ft floor is not what binds at that length — the 10% is (4.67 × 1.10 = 5.14, just past the 5 ft cable). Lowering the percentage *alone* to 5% does not help either, because then the 0.5 ft floor takes over (5.17). Getting a 5 ft jumper on that hop needs **both** dialled down — roughly 5% with a 0.25 ft minimum.

The fields are right there in the Auto-Cable tab, and this is a domain judgement about how much dress a jumper needs, not a modelling one — so the default Dom approved was left in place rather than silently overridden. Flagged here so the choice is deliberate.

### 10.6 Verification

Four rounds against the 90-fixture rig. Final state: **all items pass, zero console errors, zero page errors.**

`buildJumper` swept over 1,622 fractional gaps — zero unreachable, and brute-force-confirmed optimal. Per-piece parts tallies sum exactly. Zero cross-position data groups. 180/180 segments carry a matched ring+cone with cone alignment dot > 0.99. Offsets perpendicular at every slider scale, with the near-vertical-run fallback firing correctly. No mesh, geometry or texture leak across eight rebuild cycles. Isolate correctly hides the markers belonging to hidden segments (9 shown, 560 hidden, 0 mismatches). `buildCables()` 24–45 ms at 749 meshes. Chunk 2 and Chunk 3 suites both rerun clean.

Two further defects found and fixed along the way: `clearCables()` was disposing `THREE.Sprite`'s *shared static* geometry on every rebuild (harmless today, a footgun tomorrow), and number badges centred on a floor-level connection point put half their own quad under the deck — they now float just above the joint, which also stops them covering it.

---

## 11. Chunk 5 — two auto-cable rules from the field

Dom, as the domain expert, stated two rules the engine was violating:

> *"Runs should never double back on themselves — logic and efficiency dictate how cable is run, and runs to a position should always come from the same direction."*
>
> *"Any slack is coiled up at the start or termination point of the cable — I'd never have 20' of slack swagging down from a fixture, and sometimes that wouldn't even be possible."*

### 11.1 Rule A — monotonic sweep

**Decisions**

| Decision | Who | Detail |
|---|---|---|
| **Strict monotonic sweep** | **[USER]** | Chosen over "monotonic with one return leg" and over "keep greedy but seed from the feed end". Doubling back becomes structurally impossible rather than merely discouraged. |
| Feed direction **auto-derived**, to be **overridden by cable paths later** | **[USER]** | *"auto derive, but once we add cable paths as a concept, that'll override — cable paths will serve as the defining rule set for where cable is allowed to run."* Noted as the architecture for the coming path suite; nothing about the auto-derivation should assume it is final. |
| Axis + feed end computed **once per position**, not per group | **[AGENT]** | This is what actually implements "always from the same direction". If every circuit derived its own axis, two circuits on the same truss could disagree — which is exactly what was happening. |
| Horizontal axis by **2×2 PCA**, not by larger-extent | **[AGENT]** | A truss is rarely aligned to X or Y. PCA handles diagonal positions; verified exact on +X, +Y and 45° synthetic trusses. |

**Implementation.** `positionAxes()` builds, per position and cached in `_posAxisCache` (reset at the top of every `computeAutoCable`), a principal horizontal axis and a feed `sign` set by whichever extreme fixture is nearer the feeding device. `sweepOrder()` then sorts a group along that shared axis, tie-breaking on perpendicular → height → id so a second row stays adjacent instead of being revisited. `groupCables` calls it in place of `chainOrder`, which is retained unused for A/B comparison.

**Proof it works.** The metric I originally proposed for "same direction" — the sign of the first chain member's axis projection — turned out to be the wrong test, and the verifying agent said so and substituted the right one. A circuit occupying the far half of a truss has a positive projection at its first fixture while still walking the same way as every other circuit; the projection is centroid-relative, not direction-relative. The load-bearing measurement is the sign of each chain's own **walk direction**, `along(last) − along(first)`:

| | Positions with circuits walking in opposite directions |
|---|---|
| Greedy `chainOrder` (before) | **4 of 4** |
| `sweepOrder` (after) | **0 of 4** |

Monotonicity itself: 29 groups checked, **0 violations**. The old signature defect — universe 2's 39.7 ft hop landing at rank 20 of 20, the classic stranded-last-fixture return trip — is gone; the new worst hop is 19.5 ft at rank 1 of 5, a genuine gap between the first two fixtures rather than a double-back, and only 3 of 29 longest-hops fall in their chain's last quarter.

**The honest cost.** The sweep orders **more** cable than greedy did: Σ raw 1,648 → 1,971 ft (+19.6%), Σ ordered 2,200 → 2,570 ft. Greedy was "cheaper" only because it was free to zigzag. Most of the gap comes from two-row positions: a strict sweep advancing along the axis interleaves front row and back row as it goes, where a human would run one row out and the other back — which is precisely the "monotonic, but allow a return leg" option that was offered and declined. Worth revisiting if the number matters; recorded here so the trade is visible rather than buried.

### 11.2 Rule B — coiled slack

**Decisions**

| Decision | Who | Detail |
|---|---|---|
| Coil at the **termination** end | **[USER]** | — |
| **One standard coil size**, no scaling | **[USER]** | *"just denoting the location is fine"* — the hover readout carries the exact figures. |
| Visibility **toggle** | **[USER]** | New `Coils` button; on by default. |
| The sag model is **replaced, not damped** | **[AGENT]** | Chunk 4 solved sag so the drawn arc equalled the ordered length. Rule B says that model is simply wrong about the physical world: surplus is coiled, not hung. So `cableCurve` no longer solves for length at all. |

**Implementation.** `taut` mode draws dead-straight runs (pure topology). The old `ordered` mode is relabelled **Hang** and now draws a fixed natural hang — control-point drop of `chord × 0.07` — still bounded by the exact `(√y₀ + √y₂)²/2` floor guarantee from Chunk 4. Surplus appears as a standard-size torus at the termination end, axis along the run, whenever `std − raw > 0.5 ft`.

`solveSagScene`, `sagArc` and `curveLen` are now dead for rendering — confirmed zero callers. Left in place rather than deleted, per standing instruction §0.9.

**Verified.** Max sag/chord across every curved segment is exactly 0.07000 — bounded by the constant, no longer by the surplus. 180/180 coils present where slack exceeds the threshold, all within 2.2× their own radius of the termination and all axis-aligned to the run (dot > 0.99); the ≤0.5 ft branch confirmed by synthetic segments at 0.3 and 0.6 ft slack. Taut mode: 0 of 180 segments curved. Floor guarantee intact — global min y is one tube radius.

### 11.3 Verification

**All 11 items PASS, no bugs found.** PCA exact on +X / +Y / 45° trusses, and safe on the degenerate cases (single fixture, coincident pair, circular cluster with no dominant axis — no NaN, no throw). Moving the distro past the far end of the rig flips all four positions' feed `sign` and reverses the chains, confirming the cache genuinely resets per run. Isolate keeps coils in sync with their segments (0 of 180 wrong). Mesh count 749 → 929, exactly +180 coils. Chunk 2 and Chunk 3 suites clean. `computeAutoCable()` 2.2–4.7 ms including the PCA; `buildCables()` 28–46 ms.

---

## 12. Chunk 6A — cable path tools

Dom's framing, which made this an architecture change rather than a feature:

> *"Cable paths will serve as the defining rule set for where cable is allowed to run. Make this its own suite of tools where I can define cable break locations, hopovers, truss swags (a spot where cable swags from truss to truss, unsupported in the middle), and other plot notes. Make sure I'm able to accurately place these paths in 3D space."*

### 12.1 Decisions

| Decision | Who | Detail |
|---|---|---|
| **Everything routes through paths** | **[USER]** | Chose full graph routing over "home runs only" and over "direction only". The most rigorous reading, and the most work — which is why it splits (below). |
| **Split 6A tools / 6B routing** | **[USER]** | Agreed to judge the drawing tools before the math underneath them gets rewired. 6A ships with **zero** auto-cable engine changes, verified byte-identical. |
| **Unrouted positions fall back and are flagged** | **[USER]** | A position no path reaches keeps today's derived feed axis and straight-line lengths, and gets marked. The tool stays usable from day one and you can always tell a routed number from an estimated one. (6B implements the flagging; 6A is the fallback by construction, since the engine is untouched.) |
| Snap to **fixtures/devices, position axes, deck/trim heights, other path points** | **[USER]** | All four. The last one matters structurally — two paths that nearly touch are not connected in a routing graph. |
| Paths are **typed, defaulting to "both"** | **[USER]** | A `carries` field of power / data / both, so a separate data route can be drawn where you'd actually keep them apart. |
| Semantics confirmed: **swag** = unsupported truss-to-truss span, **hopover** = crossing an obstruction, **break** = forced cable termination point, **note** = annotation with no math | **[USER]** | Confirmed all four readings rather than guessing at the domain terms. |
| Device dragging folded into 6A | **[AGENT]** | It needs the identical screen→world plane-raycast plumbing, and was already on the list. Cheap once the plumbing exists. |

### 12.2 What had to be built from scratch

**Screen → world did not exist anywhere in the file.** Every existing interaction is either forward projection (3D → screen, as in `cacheProjections`) or object picking. Placing a point accurately needs the inverse. `screenToRig()` raycasts against a horizontal `THREE.Plane` at the current draw height and inverts `plotVec`. Round-trip error measured at **0 px** across 168 sample points in both camera modes at three draw heights.

**A true orthographic plan view.** The existing `Top` preset only swung the perspective camera overhead — still foreshortened, so a fixture at the screen edge is not at its true plan (x, y), which is useless for accurate placement. `PLOT.perspCam` now holds the perspective camera and `PLOT.camera` is always the *active* one, swapped by `setViewMode()`. Keeping the active camera on `PLOT.camera` means every existing reader — raycasts, projections, the render loop — needed no change at all. Verified genuinely orthographic: two points at the same (x, y) and very different heights project to identical screen coordinates.

### 12.3 What shipped

- **Path model**: `state.paths` of `{id, name, kind, carries, pts[], pos, text, locked, sag?}`. Kinds: run (many points), swag (2), hopover (2), break (1), note (1).
- **Path tool** (key 7): click to place, Enter to finish, Backspace to undo a point, Esc to cancel; single-point kinds commit on the first click. Live polyline preview on the overlay with the snapped cursor and a label naming what it caught.
- **Move tool** (key 6): drag a device or a path point in the draw plane. Moving a distro re-runs `buildCables()`, because it changes every home-run origin and therefore every feed axis.
- **Snapping** to fixtures, placed devices, other path points, and a position's principal axis — reusing `positionAxes()` rather than re-deriving it. Snap radius scales with the rig (≈549 mm at the test rig's scale).
- **Draw height** as a feet field plus quick picks generated from the rig's own distinct trim heights.
- **Rendering**: runs and hopovers as one tube per leg; breaks as octahedra; notes as a sphere with a canvas-sprite label; vertex beads on every point so they're visible and grabbable.
- **Swags get a real catenary.** Chunk 5 removed hanging sag from jumpers and home runs because surplus is coiled — but an unsupported truss-to-truss span genuinely hangs, and the extra length is real cable. `swagCurve()` uses the same exact `(√y₀ + √y₂)²/2` floor bound from chunk 4, and `pathLengthFt()` measures a swag's **drawn arc**, not its chord. A 30 ft swag at the default 8 % sag measures 30.50 ft. **This is what finally gave `curveLen()` a job** — it had been dead since the chunk-4 sag solver was superseded.
- **Paths tab**: a table with editable name / kind / carries / serves / note, and a numeric X/Y/Z **point table in feet** for the selected path — the guarantee behind "accurately place these paths in 3D space."

### 12.4 Three bugs, one of them the worst of the session

**1. A page-load crash that silently disabled the cable engine. [CRITICAL]**

`setViewMode('persp')` is called at top level, but `PLOT.renderer` is null until the lazy `initPlot()` runs when the Plot tab is first opened. The resulting `TypeError` was uncaught in the page's single top-level script — and because of JavaScript's temporal dead zone, **every `let`/`const` declared after that point never initialised for the life of the page.** `PM_COLS`, `JUMPER_STD`, `cableSlack`, `_posAxisCache` all became permanently unreadable. Clicking Auto-Patch on a fresh load threw `ReferenceError: Cannot access 'PM_COLS' before initialization`; so did the entire cable engine.

The insidious part: **any test that opened the Plot tab first would never see it.** It only reproduces on the exact real-use sequence of loading the page and going straight to Auto-Patch. Chunk 6A's own code was fine; it was unreachable through normal use.

Fixed with three guards — `resizePlot()` early-returns without a renderer or a wrap element, `setViewMode()` only touches the camera plumbing when `PLOT.inited`, and `updateCam()` early-returns without a camera.

**2. A pre-init plan-mode selection was silently discarded. [MODERATE, self-inflicted]**

Gating `setViewMode` on `PLOT.inited` fixed the crash but left the camera assignment standing — and `initPlot()` then unconditionally overwrote `PLOT.camera` with the new perspective camera. `PLOT.viewMode` still read `'plan'`, the toolbar still showed "PLAN · orthographic", and the camera in use was perspective. The UI claimed accurate plan coordinates while quietly giving foreshortened ones. Fixed by reconciling in `initPlot()`: `if(PLOT.viewMode==='plan') PLOT.camera=ensureOrtho();`

**3. A toolbar reflow that moved the canvas mid-draw. [COSMETIC]**

`#pathStat`'s text grows when a draft starts ("0 paths" → "drawing Run · 1 pt · Enter to finish…"), which at narrower viewport widths wrapped the toolbar and shifted the plot canvas down ~33 px on the first click. Found because it made the verifier's own test fail, and the verifier correctly traced it to its own precomputed expectations rather than blaming the app. Fixed by reserving width on the element. Confirmed at 0 px delta afterwards.

### 12.5 Verification

All 13 items pass against the real, unmodified file, plus the Chunk 2/3/4/5 suites re-run clean.

Highlights: `computeAutoCable()` output **byte-identical** before and after creating paths of all five kinds, which is the proof that 6A left the engine alone · screen→world round-trip 0 px error, 168 samples × 2 modes × 3 heights · snapping exact on fixtures, devices and path points, with axis snap returning `"axis · LX1"` · path tool end-to-end with Backspace and Esc · swag arc 30.50 ft over a 30 ft chord, collapsing to exactly 30.00 at zero sag, floor clamp holding at deck level · move tool drags devices and path points and no-ops on empty space · mesh counts exact (run = 2N−1, swag = 1 tube + N beads), no leak over 8 rebuild cycles · persistence round-trips including a project saved before paths existed · no throw on empty instances, single-point runs, coincident points, or plan mode before the first render.

Perf: `buildPaths()` 21 ms for 40 paths / 300 points; `screenToRig` + `snapPoint` **0.033 ms per call** at 120 fixtures, which matters because it runs on every mousemove with the path tool.

---

## 13. Next chunks

**All four requested adds are complete, plus the Chunk 4 follow-up.** Candidates carried forward, none committed to:

- **Circuit-driven patching** — §9.1 of the technical reference, and still the biggest open gap: CSV circuit values are stored and displayed but don't auto-assign fixtures to SOCA circuits. Needs a parser for the circuit-naming convention (`L1-7`, `SOCA 2.3`) mapped onto position → multi → circuit. With Select Similar now able to grab a circuit in one click, this would close the loop.
- **Home-run parts tally** — currently drawn in 3D but deliberately not counted, to avoid double-counting the Cables tab's multicable home runs. Unifying the two is a clean follow-up, and now that both sides use `buildRun` the two tallies are finally speaking the same language.
- **Chunk 6B — the routing engine.** The other half of cable paths, and the one that changes the math:
  - A routing **graph** built from path points, with junctions where paths meet (which is why point-to-point snapping matters).
  - **Polyline-aware segments.** The single biggest structural change in the file so far: `cableCurve()` takes exactly two points and `segments[]` assumes a straight run between two fixture instances. A path-routed cable bends, so either each path leg becomes its own segment — which collides with `ai`/`bi`/`chainLen`, currently meaning *fixture chain* index, not path-leg index — or `cableCurve` learns to take a point list. These are separate concepts and must stay separate.
  - **A fourth render family.** `cableFamily()` maps anything that isn't `power` or `homerun*` to `data`, silently. A swag is none of the three; it needs handling in `cableFamily`, `CABLE_OFFSET`, the colour/label branch in `buildCables`, and `addCableMarkers`'s `isHome` test. The failure mode is plausible-looking wrong colours, not a crash.
  - **Two seams that must agree.** Feed direction (in `positionAxes`) and home-run length (in `groupCables`) are separate hooks in different functions. A path that changes one without the other produces a chain starting at the right end but reporting the wrong length. Decide which path applies to which position/group *before* touching either.
  - **Unrouted flagging** — mark positions falling back to the derived axis, in the Auto-Cable stats and tinted in the plot.
  - Swag arc length should count toward the cable order (6A measures it; nothing orders it yet).
- **Two-row sweep with a return leg** — recover the ~19.6% the strict sweep costs; see §11.1.
- **Tune the slack allowance** — see §10.5. A domain call, not a modelling one.
- **Grow / Shrink by proximity** — offered in Chunk 2 and declined; `applySelection` is the hook if it's ever wanted.
- **Selection dims the cable layer** — offered in Chunk 2 and declined; Isolate currently covers the use case.
- **Auto-pack a universe from the map** — a "close the gaps" action now that gaps are visible and drag-to-re-address exists.

---

*Log maintained per standing instruction §0.7. Attribution: **[USER]** = Dom's explicit decision; **[AGENT]** = Claude's decision within delegated latitude.*
