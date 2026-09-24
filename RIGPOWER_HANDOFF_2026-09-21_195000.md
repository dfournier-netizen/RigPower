# RIGPOWER — Handoff & To-Do

> **Combined build - September 23, 2026:** `RIGPOWER_2026-09-23_222010.html` integrates Chunk 6B routing with E (settings persistence), F (live footprint updates and legacy migration), and H (circuit-name assignment). See `RIGPOWER_SESSION_2026-09-23_INTEGRATION.md` for current verification and remaining limitations. Older build pointers, roadmap status, and line references below are historical.


**Written:** Monday, September 21, 2026, 7:50:00 PM EDT
**Current build:** `RIGPOWER_2026-08-25_103037.html` — 183,403 bytes, 3,477 lines
**Base (frozen, never modified):** `RIGPOWER.html` — 126,373 bytes, pre-merge standalone
**Companion docs:** `RIGPOWER_PROJECT_NOTES_2026-09-21_195000.md` (structure & goals) · `RIGPOWER_SESSION_2026-08-24_112141.md` (full decision log for chunks 1–5) · `RIGPOWER_REFERENCE.md` (original technical reference — **partially stale, see §7**)

All facts below were verified against the current file by a fresh inventory pass, not recalled.

---

## 1. Where things stand

Five chunks of work landed across the Aug 24–25 sessions. Everything is verified by a headless Chromium suite against a synthetic 90-fixture rig built to match a real export (4 positions, 70×70 ft, trims 15/20/25 ft).

| Chunk | What | State |
|---|---|---|
| 1 | 3D cable layer — renders what auto-cable computes | Done, verified |
| 2 | 3D navigation + selection suite | Done, verified |
| 3 | Graphical patch view (universe channel map) | Done, verified |
| 4 | Cable-order **logic fix** + run markers + per-family offsets | Done, verified |
| 5 | Monotonic sweep chains + coiled slack | Done, verified |

**The headline from chunk 4:** the cable *ordering* engine was defective, and the 3D layer built in chunk 1 is what exposed it. Auto-cable picked a single stock length per run, so with a table that jumps 50 → 100 ft a 46–77 ft home run was ordered as a flat 100 ft — up to 117% over. Routing it through `buildRun` (the correct least-overage multi-piece solver the Cables tab already had) cut **2,615 ft → 2,200 ft, a 415 ft / 15.9% saving** on the test rig.

**Chunk 5 applied two field rules:** runs never double back (strict monotonic sweep along a per-position feed axis — 4 of 4 positions previously had circuits walking in opposite directions; now 0 of 4), and surplus is coiled at the termination rather than swagged.

### Iteration files on disk

| File | Contents |
|---|---|
| `RIGPOWER_2026-08-24_121848.html` | Chunks 1–2 |
| `RIGPOWER_2026-08-24_124341.html` | Chunks 1–3 |
| `RIGPOWER_2026-08-24_162303.html` | Chunk 4 |
| `RIGPOWER_2026-08-25_103037.html` | **Chunk 5 — current** |
| `_to_delete/RIGPOWER_2026-08-24_112141.html` | Chunk 1, FIFO-evicted; safe to delete |

4 of 4 iteration slots used. The next build evicts `…_121848.html`.

---

## 2. To-do, ranked

### Committed next — Dom has specified these

**A. Drag devices and distros in the 3D plot, plus a top-down view.** *(next chunk)*
Device positions are currently typed as X/Y/Z in feet on the Devices tab. Everything downstream depends on them — `homerunOrigin()` picks the nearest placed device, and that choice sets each position's feed direction — so moving a distro by hand is the fastest way to see the cabling consequence. This is also the plumbing prerequisite for B: both need a top-down mode and a 3D drag layer.

**B. Cable Paths — a routing constraint suite.** *(the big one)*
Dom's framing, recorded verbatim because it changes the architecture rather than adding a feature:

> *"Once we add cable paths as a concept, that'll override. Cable paths will serve as the defining rule set for where cable is allowed to run. Make this its own suite of tools where I can define cable break locations, hopovers, truss swags (a spot where cable swags from truss to truss, unsupported in the middle), and other plot notes. Make sure I'm able to accurately place these paths in 3D space."*

Implications to carry forward:
- Paths **supersede** the auto-derived feed axis from chunk 5. `positionAxes()` becomes the fallback for positions with no path, not the primary.
- Path objects need: ordered 3D waypoints, a type (run / hopover / swag / break / note), and an association to one or more positions.
- Run length must follow the **path**, not the straight-line gap — which changes `groupCables` from "distance between fixtures" to "distance along the permitted route."
- Placement accuracy in 3D is a stated requirement: snapping to truss lines, to fixtures, and to a ground plane, with numeric entry as a fallback.
- Swags are load-bearing information, not decoration — an unsupported truss-to-truss span is where catenary sag is actually *real*, unlike the fixture-to-fixture runs where chunk 5 correctly removed it.

### Real defects found in the inventory — none of these have been reported by use yet

**C. `stockLengths` and `JUMPER_STD` can silently disagree.** *(confirmed, not hypothetical)*
The Cables tab lets you edit stock lengths per type. Auto-cable ignores them: `groupCables()` calls `buildJumper(raw)` with no `sizesIn`, so it always falls back to the hard-coded `JUMPER_STD = [5,10,15,25,50,100]`. Strip 15 ft and 25 ft out of your DMX stock and the Cables tab will respect it while the Auto-Cable tab keeps building short jumpers from 15s and 25s. Both UIs say "DMX" and both call the same solver. **Fix: pass the right per-type stock list into `buildJumper`.**

**D. The Jumper/Data type selects are cosmetic.** True1 ↔ PowerCon and DMX ↔ Cat5e only change a string key in the parts tables (`jumperType+'|'+p`). Lengths always come from `JUMPER_STD` regardless. A future maintainer will reasonably assume "Cat5e" pulls an Ethernet stock table. It doesn't. Fixing C and D together is the natural move.

**E. Cable-layer settings and slack tolerance are not saved.** Save/Load writes `{...state, _stock: stockLengths}`. `PLOT.cable` (layer visibility, taut/hang, offset, marker toggles) and `cableSlack` (`{pct, minFt}`) are module-level and outside `state` — so a dialled-in render and a project-specific slack tolerance are lost on every reload. Device positions *are* saved (devices live in `state`). Transient UI (tool, brush, selection, isolate) is fine to lose; slack and layer prefs are not.

**F. Auto-patched instances freeze their footprint.** `autoPatch()` writes `it.footprint` per instance; manual address edits never do. Edit a fixture type's footprint later and manually-patched instances pick it up live while auto-patched ones keep the stale snapshot. Silent divergence.

### Improvements, no urgency

**G. Two-row sweep with a return leg.** The strict sweep never doubles back but costs **+19.6% cable** versus the old greedy walk (Σ raw 1,648 → 1,971 ft). Most of that is two-row positions: a monotonic sweep interleaves front and back rows as it advances, where you'd run one row out and the other back. The "monotonic, but allow one return leg" variant was offered and declined; recorded here because the number is real and recoverable.

**H. Circuit-driven patching.** Still the oldest open gap (`RIGPOWER_REFERENCE.md` §9.1). CSV circuit values are stored and shown but don't auto-assign fixtures to SOCA circuits. Needs a parser for the circuit-naming convention (`L1-7`, `SOCA 2.3`) mapped onto position → multi → circuit. Select Similar can now grab a whole circuit in one click, which closes half the loop.

**I. Home-run parts tally.** Home runs are drawn in 3D but deliberately not counted, to avoid double-counting the Cables tab's multicable home runs. Now that both sides use `buildRun`, the two tallies finally speak the same language and could be unified.

**J. Dead code.** Verified zero callers: `solveSagScene`, `sagArc`, `curveLen` (the chunk-4 sag solver, superseded by `cableCurve`'s closed-form math), `chainOrder` (superseded by `sweepOrder`), and `fixSeq`/`posSeq`/`multiSeq` (vestigial; IDs come from `uid()`). The sag trio is the risk — it sits directly above the live sag code with no "unused" marker, computing the same visual via different math. Someone will fix the wrong one.

**K. `segments[]` is not uniform.** Home-run kinds omit `aId` (their "a" endpoint is a device or the rig centroid, not an instance). Guarded correctly today, but any new consumer that assumes `aId` exists will break.

---

## 3. Architecture as it stands

Single self-contained HTML file. No build step, no server, no framework. Two CDN dependencies: **JSZip 3.10.1** and **Three.js r128**.

**Three.js stays at r128.** Dom considered and rejected upgrading: modern Three (r160+) is ESM-only, which would force an import map and a module/classic boundary into one 3,477-line classic `<script>`. All new 3D work is hand-rolled against the existing spherical-orbit code. `TubeGeometry`, `QuadraticBezierCurve3`, `LineCurve3`, `Sprite` + `CanvasTexture` all exist in r128 and are confirmed working.

### Tabs → render functions

| Tab | Section | Render fn | Line |
|---|---|---|---|
| Import | `#view-import` | — (drop handlers) | 281 |
| Fixtures | `#view-fixtures` | `renderFixtures()` | 709 |
| Power Calc | `#view-calc` | `renderCalc()` | 866 |
| **3D Plot** | `#view-plot` | `renderPlot()` | 1658 |
| Summary | `#view-summary` | `renderSummary()` | 1014 |
| Cables | `#view-cables` | `renderCables()` | 1065 |
| **Patch** | `#view-patch` | `renderPatch()` | 2781 |
| **Auto-Cable** | `#view-autocable` | `renderAutoCable()` | 3188 |
| Devices | `#view-devices` | `renderDevices()` | 2883 |

Bolded tabs changed structurally in chunks 1–5.

### State

```js
let state = {
  fixtures: [],   // type library: {id,name,mode,watts,count,footprint,manual,_profile,_stub}
  positions: [],  // {id,name,tag,collapsed,multis:[{id,type,volts,homerun,dmx,eth,breakout,circuits}]}
  instances: [],  // one per physical unit: {id,name,type,pos,x,y,z,fid,universe,address,
                  //   circuit,userField1,footprint?,assigned:{positionId,multiId,circuitIndex}}
  devices: [],    // {id,kind,name,x,y,z,placed,outputs,inputs,voltage}
};
```

Module-level config **outside** `state` (see defect E — none of this is saved):

| Symbol | Line | Purpose |
|---|---|---|
| `stockLengths` | 624 | Editable per-type stock — **Cables tab only** |
| `JUMPER_STD` | 2957 | Hard-coded stock — **Auto-Cable only** |
| `cableSlack` | 2962 | `{pct:10, minFt:0.5}` |
| `PLOT` | 1542 | All 3D state: camera, meshes, selection, `cable{}` settings, tool, overlay |
| `PMAP` | 2500 | Channel-map drag state |
| `_posAxisCache` | 3021 | Per-position feed axes; reset at the top of every `computeAutoCable()` |

Coordinates are **millimetres, Z-up** internally (from MVR). The UI shows feet (÷304.8). Cable lengths are feet. `PLOT.xform = {cx, cy, minZ, SC}` is published by `renderPlot()` so the cable layer lands on exactly the same transform as the fixture meshes — **do not re-derive it.**

### The auto-cable pipeline

```
state.instances
  ↓ group: power by position|multi|circuit · data by universe+position
positionAxes()      per-position PCA → feed axis + feed end (cached)
  ↓
sweepOrder()        strict monotonic sort along that axis — cannot double back
  ↓
groupCables()       chain → homerun + per-gap jumps
  ↓ buildJumper() → slackTarget() → buildRun()   least-overage multi-piece
computeAutoCable()  → { jumperParts, dataParts, powerDetail, dataDetail, segments[] }
  ↓
buildCables()       segments[] → tubes + markers + coils in PLOT.cableGroup
```

`segments[]` is the contract between the engine and the renderer. Each entry: `kind` (`power` / `data` / `homerun-power` / `homerun-data`), `a` / `b` endpoints, `aId` / `bId`, `raw` (true gap ft), `std` (ordered ft), `pieces[]`, `ai` / `bi` (chain indices), `chainLen`, plus `group` (power) or `universe` + `pos` (data). **`aId` is absent on home-run kinds.**

### Sag model, current

`cableCurve()` — **taut** mode draws a `LineCurve3`; **hang** mode drops the control point by `chord × NATURAL_SAG (0.07)`. Surplus is *not* expressed as sag; it becomes a standard-size coil torus at the termination when `std − raw > 0.5 ft`.

Sag is bounded by an exact closed form derived in chunk 4, so no curve ever tunnels below the deck:

> **`h ≤ (√y₀ + √y₂)² / 2`**

For equal-height endpoints this returns `2·midY` (the naïve symmetric answer). For a run off the deck (`y₀ = 0`) it returns `y₂/2`, putting the curve's minimum exactly on the floor. Verified numerically: minimum y = 0.000000 across eight endpoint pairs — tight, not conservative. **The common mistake is assuming the low point of a quadratic Bézier is `midY − h/2`; that is only true when both ends are at the same height.** That error shipped twice before being caught.

---

## 4. Working protocol — follow this

From Dom, standing:

1. **Never overwrite** the existing file. Every change ships as a new iteration with date and time appended.
2. **Take a real timestamp at the moment of file creation.** `TZ=America/New_York date +%Y-%m-%d_%H%M%S`
3. **Max 4 iterations, FIFO.** This environment has no delete permission for the mounted folder — move evictions to `_to_delete/` and say so.
4. **Use agents.** Opus orchestrates and plans; scoped tasks go to cheaper agents. Verification especially.
5. **Defer to Dom for decisions.** Ask when direction is needed.
6. **Build in chunks** to protect the usage budget.
7. **One markdown session log per session**, tagging every decision `[USER]` or `[AGENT]`.

From prior sessions:

8. **Never use the `Edit` tool on existing files here.** The Windows↔sandbox bridge has silently corrupted in-place edits — reported success, file truncated and NUL-padded to its pre-edit length — on at least four occasions. Do scripted string replacement in the sandbox and **byte-verify** (`wc -c`, `md5sum`) on both sides of any copy.
9. **Minimal, surgical changes.** No refactoring of working systems.

### The splice pattern that works

Every edit this session was applied as a Python script doing exact-string replacement with a `count == 1` assertion per anchor, so a drifted anchor aborts the whole script before anything is written rather than silently mis-patching. This caught several anchor mismatches with zero damage. Two traps:

- **The file contains literal glyphs, not HTML entities** — `↻`, `′`, `—`. Anchor on the real characters. Pull the exact bytes with `python3 -c "print(repr(open(f).read()[i:j]))"` rather than trusting a `sed` dump's apparent indentation.
- **Verify by extracting the inline script and running `node --check`** before shipping.

### Verification

A headless Chromium harness (real Three.js r128 from CDN, proxy bypassed via `proxy:{server:'direct://'}` + `--no-proxy-server`) builds a synthetic rig and asserts behaviour. Reusable suites live in the sandbox as `master_test.js` (chunk 2), `master_test3.js` (chunk 3), `chunk4_test.js`, `chunk8_verify_a/b.js` — **these are sandbox-only and do not survive the session.** Recreate from the assertion lists in the session log if needed.

Two harness gotchas that cost time and will recur:

- Reading `mesh.position.project(camera)` in the gap between `updateCam()` and the next render frame races a stale `matrixWorldInverse`. Force `camera.updateMatrixWorld(true)` before reading projected coordinates in test code.
- Synthesised pointer events need the target scrolled into view first; the channel-map grids sit below the fold on a tall page.

---

## 5. What verification actually caught

Recorded because it argues for keeping the verification step, and because each was invisible from reading the code:

- **The sag arc-length formula was a small-angle approximation**, wrong by 5–8.5% at the sag ratios real jumper overage produces — a silent lie that would have undercut the whole point of the feature.
- **`buildRun` takes an integer target.** It does an integer DP and iterates `for(s=target; s<=cap; s++)`. Handing it a fractional `need` made every lookup miss, returned `unreachable`, and would have sent every cable to the fallback branch — **ordering every run as a multiple of 100 ft**, catastrophically worse than the bug being fixed. Caught before the file was written.
- **The floor clamp was defeated by its own sibling feature** — the per-family draw offset moved endpoints below the deck before the clamp saw them.
- **The floor clamp formula was wrong for asymmetric runs, twice.** See §3.
- **The legend appended instead of replacing**, stacking a duplicate block on every toggle click.
- **`clearCables()` disposed `THREE.Sprite`'s shared static geometry** on every rebuild.

One verifier finding worth internalising: when asked to prove "every run enters a position from the same direction," the proposed metric (sign of the first chain member's axis projection) was **the wrong test** — it is centroid-relative, not direction-relative. The agent said so and substituted the right one (sign of each chain's own walk direction). Check that a metric measures what you think before trusting a pass.

---

## 6. Known limitations

1. Screen-space selection is depth-blind — a marquee grabs fixtures behind other fixtures. Standard behaviour; orbit or isolate first.
2. Drag re-address in the channel map is single-fixture; a multi-selection is not moved as a block.
3. A fixture spanning a channel-map row boundary renders as two adjacent blocks. Inherent to a 32-wide grid.
4. An overlapped channel can only show one colour, so it renders red rather than either owner's.
5. The cable layer needs the plot rendered once to have a transform — opening the 3D Plot tab is enough.
6. Ring/cone markers anchored at deck-level fixtures extend ~0.12 scene units below y=0 — their own geometric radius, not sag. Number badges were lifted; solid markers were not.
7. Multi-break fixtures: only the first `<Address break>` is read.
8. Fixtures render as spheres. MVR bundles `.glb` geometry that could be used.

---

## 7. Staleness in `RIGPOWER_REFERENCE.md`

That document remains the authority on MVR/GDTF parsing, the CSV bridge, and domain concepts — none of which changed. These sections are now **out of date**:

| Section | Status |
|---|---|
| §5.4 3D Plot | Superseded — no mention of pan, the tool suite, selection, isolate, or the cable layer |
| §5.7 Patch | Incomplete — no channel map |
| §5.8 Auto-Cable | **Wrong** — describes the single-stock `roundUpStd` rounding and nearest-neighbour chains, both replaced |
| §6 constants | Incomplete — no `cableSlack`, `NATURAL_SAG`, `CABLE_OFFSET` |
| §9 limitations | Items 6 (box select) and 7 (nearest-neighbour chains) are resolved |

Left unedited deliberately, per standing instruction 9. Folding chunks 1–5 into it is a clean follow-up if you want one authoritative document instead of three.

---

## 8. Fastest path back in

1. Open `RIGPOWER_2026-08-25_103037.html` in a browser. Load demo rig or drop an MVR.
2. **3D Plot tab** — this is where everything new lives. Tool row: Orbit / Pan / Rect / Lasso / Paint (keys `1`–`5`). Middle-drag always pans, right-drag always orbits. Cable row: Power / Data / Home runs, Taut / Hang, marker toggles, separation slider.
3. **Patch tab, Channel Map panel** — drag a run to re-address it.
4. **Auto-Cable tab** — the Slack % and ft-min fields are the tuning knobs; see §2.C for what they do and don't reach.
5. `RIGPOWER_SESSION_2026-08-24_112141.md` has the full reasoning for every decision, tagged by who made it.

**One thing Dom flagged as an open judgement call:** at the default 10% / 0.5 ft slack, a 4.67 ft truss hop still orders a 10 ft jumper — the 10% is what binds, not the floor. Lowering the percentage alone doesn't help, because the 0.5 ft floor takes over. Getting a 5 ft jumper on that hop needs roughly 5% *and* a 0.25 ft minimum. That's a call about how much dress a jumper needs, so the default was left alone rather than silently changed.
