# RIGPOWER — Project Notes

**Written:** Monday, September 21, 2026, 7:50:00 PM EDT
**Scope:** what this is for, how it's organised, and the principles that decide what belongs in it.
**Companion:** `RIGPOWER_HANDOFF_2026-09-21_195000.md` (current state and to-do)

---

## 1. What it is

A single-file, browser-based **lighting power and cable calculator** for live production. Double-click the HTML, no install, no server, no build step. It ingests the rig you drew in Vectorworks, models the power distribution and DMX data, shows it in 3D, and produces the cable order you actually take to the shop.

The user is a working corporate lighting designer and master electrician. The tool encodes their conventions rather than teaching the craft — it assumes you know what a SOCApex is and that legs are X/Y/Z, not L1/L2/L3.

---

## 2. Goals

### The purpose

**Turn a drawn rig into a correct cable order, and make the reasoning visible enough to argue with.**

Both halves matter equally, and the second half is the one that's easy to under-serve. The 3D cable layer was built to answer *"I need a way to visualize what the auto cable engine is actually doing"* — and within one session of existing it had exposed a defect that made the tool over-order cable by up to 117% on long runs. That is the goal working as intended: the visualization is not decoration on top of the math, it is how the math gets audited.

### Design principles

**Correctness over convenience, but ask before assuming.** Where the model and the real world disagree, the real world wins — even when that costs efficiency. The chain-ordering sweep orders 19.6% more cable than a greedy nearest-neighbour walk, and it's the right answer anyway, because cable doesn't zigzag down a truss. The person to ask is the one holding the wrench.

**One algorithm per job.** The worst defect found so far was two different cable-build solvers in the same file — a correct one in the Cables tab and a naïve one in Auto-Cable. Duplicated logic drifts, and the drift is silent. There is still one live instance of this (`stockLengths` vs `JUMPER_STD`; handoff §2.C).

**Physical honesty in the render.** Cable lies on the deck, it doesn't tunnel under it. Twenty feet of slack is coiled at a termination, not swagged from a fixture — often it physically couldn't be. Each of these started as a rendering choice and turned out to be a modelling claim.

**Surgical changes.** This file works and is used on jobs. No refactoring of working systems, no speculative restructuring. Additions are additive: `computeAutoCable` gained a `segments[]` channel without disturbing a single existing key or table.

**Prove it, don't eyeball it.** Every chunk is verified by a headless browser suite with a synthetic rig and explicit numeric assertions. Six real defects were found that way, several of which were invisible from reading the code and one of which would have been catastrophic.

### Explicit non-goals

- **Not a drafting tool.** Vectorworks draws the rig; this consumes it. Cable paths (planned) are a routing constraint layer, not a CAD surface.
- **Not a console.** It produces patch and paperwork; grandMA3 runs the show.
- **No build step, ever.** The single-file, double-click-to-run property is a feature, not an accident — it works on a shop laptop with no network and no admin rights.
- **No browser storage.** All state is in memory; persistence is explicit JSON save/load and CSV export.

---

## 3. Structure

### The file

One HTML document, ~3,500 lines, all CSS and JS inline. Two CDN dependencies: **JSZip** (MVR/GDTF are zip archives) and **Three.js r128** (the 3D plot).

**Three.js is pinned at r128 deliberately.** Modern Three is ESM-only, which would force an import map and a module/classic boundary into one large classic `<script>`. That was evaluated and rejected. New 3D work is hand-rolled against the existing spherical-orbit code.

### The nine tabs, as a workflow

```
Import → Fixtures → Power Calc → Summary → Cables
             ↓           ↓                     ↑
          Patch      3D Plot ────────→ Auto-Cable
                         ↑                     ↑
                      Devices ─────────────────┘
```

| Tab | Job |
|---|---|
| **Import** | Drop MVR / GDTF / worksheet CSV. Builds the fixture library, positions, and 3D instances. |
| **Fixtures** | The type library — wattage, DMX footprint, mode, and where each value came from (manual / GDTF / stub). |
| **Power Calc** | Per position: add SOCApex or L21-30 multis, fill circuit slots, see live watts and amps. |
| **Summary** | Total draw, X/Y/Z leg balance, and the auto-balance solver. |
| **Cables** | Multicable home runs and the aggregated cable part totals. |
| **3D Plot** | The rig in space. Navigation, selection, circuit assignment, and the cable layer. |
| **Patch** | DMX-512 patch sheet plus the graphical channel map. |
| **Auto-Cable** | Jumpers and data runs computed from the 3D layout. |
| **Devices** | Distros, DMX nodes, splitters. Placed devices anchor every home run. |

### The two data models

This is the distinction that trips people up, so it's worth stating plainly:

- **`fixtures[]` is the type library** — one row per fixture *model*, carrying wattage and footprint. This is what the power math sums.
- **`instances[]` is every physical unit** — one entry per fixture in the rig, carrying 3D coordinates, DMX patch, and its circuit assignment.

A circuit slot references fixtures **by name and quantity** (correct for power math), while `instance.assigned` is the bridge from a specific physical unit in the 3D plot to a specific circuit. Fixture identity is by name throughout.

### Units

**Millimetres, Z-up** internally — that's what MVR gives. The UI displays feet (÷304.8). Cable lengths are feet. The mm→scene transform is computed once by `renderPlot()` and published as `PLOT.xform`; anything drawing into the 3D scene reuses it rather than re-deriving it.

### The auto-cable pipeline

The heart of the tool, and where four of the five chunks of recent work landed:

```
group instances     power by position|multi|circuit
                    data  by universe + position
      ↓
positionAxes()      one feed axis + feed end per POSITION (not per circuit)
      ↓
sweepOrder()        strict monotonic sort — doubling back is impossible
      ↓
groupCables()       chain → home run + per-gap jumps
      ↓
buildJumper()       slack allowance → least-overage multi-piece build
      ↓
computeAutoCable()  parts tallies + segments[] geometry channel
      ↓
buildCables()       tubes, markers, coils in the 3D plot
```

Two structural choices worth preserving:

**The feed axis is per position, not per group.** That is what makes "every run enters a truss from the same end" true. If each circuit derived its own axis, circuits on the same truss would disagree — which is exactly what was happening before.

**`segments[]` is the contract between engine and renderer.** The engine used to compute every run's endpoints and throw them away, keeping only aggregate counts. Exposing that geometry is what made the 3D cable layer possible, and it stays purely additive to the existing return shape.

### Domain model

- **Position** — a physical hanging location (LX 1, SR Truss, Floor). Fixtures group by it; it now also carries a cable feed direction.
- **Multicable** — SOCApex (6 circuits) or L21-30 (3 circuits).
- **Circuit → leg** — fixed by the connector pinout, never reassigned by hand. SOCA: X Y Z X Y Z. L21-30: X Y Z. Balancing permutes which *group* sits on which circuit; it never rewires a pin.
- **Home run** — distro to the first fixture in a chain.
- **Jumper** — fixture to fixture along a truss.
- **Universe** — one DMX-512 line, 512 channels.

---

## 4. Conventions

| | |
|---|---|
| **Legs** | X / Y / Z, never L1/L2/L3 — the user's convention, consistent throughout |
| **Leg colours** | X blue `#4aa3e0` · Y green `#43d18a` · Z yellow `#f0c64a` |
| **Theme** | Industrial dark, amber accent, Archivo + Spline Sans Mono. Built to stay legible under load-in lighting. |
| **Rendering** | Plain DOM construction via `$`/`$$`. Each tab has a `renderX()`. The tab dispatcher wraps renders in try/catch so one bad record can't blank a tab. |
| **Persistence** | Explicit JSON save/load and CSV export. No `localStorage` — unavailable in the artifact sandbox and unwanted regardless. |
| **User Field 1** | The user's Vectorworks convention for fixture mode and footprint as plaintext (`Mode 1 / 32`, `56Ch Mode / 56`). Parsed on CSV import. |

---

## 5. Where it lives

```
AV Tools and plugins/RIGPOWER/
  RIGPOWER.html                         frozen pre-merge original — never modified
  RIGPOWER_<date>_<time>.html           iterations, 4 max, FIFO
  RIGPOWER_REFERENCE.md                 original technical reference (partly stale)
  RIGPOWER_SESSION_<stamp>.md           per-session decision log
  RIGPOWER_HANDOFF_<stamp>.md           current state + to-do
  RIGPOWER_PROJECT_NOTES_<stamp>.md     this file
  _to_delete/                           FIFO evictions awaiting manual deletion
```

**Context worth knowing:** RIGPOWER was merged into **DLux Rackmaster v6.0+** as the LIGHTING workspace (shadow-DOM isolated, libraries vendored inline) in July 2026. The standalone here is frozen at pre-merge and is where lighting-domain development continues. Any merge back needs to account for that.

### Why iterations, not overwrites

Every change ships as a new timestamped file, capped at four, oldest-first. The reasons compound:

- This tool goes on jobs. A regression discovered at load-in needs a known-good file, immediately.
- The Windows↔sandbox bridge in this environment has **silently corrupted in-place edits** at least four times — reporting success while truncating and NUL-padding the file to its pre-edit length. Writing fresh files and byte-verifying both sides is the mitigation.
- A visible chain of iterations plus a per-session log makes it possible to answer "why does it do that?" months later.

---

## 6. What the next sessions are for

**Near:** drag devices and distros in 3D with a top-down view. Device placement sets every home-run origin and therefore every feed direction, so making it direct manipulation is the shortest path between a question and its answer.

**The significant one:** **Cable Paths** — a routing constraint suite where paths define *where cable is allowed to run*, carrying break locations, hopovers, truss swags, and plot notes, all placeable accurately in 3D.

This reframes the architecture rather than extending it. The auto-derived feed axis becomes the fallback for positions with no path defined, and run length starts following the permitted route rather than the straight line between fixtures. It also restores catenary sag in the one place it's physically real — an unsupported truss-to-truss swag — having correctly removed it everywhere else.

**Longstanding:** circuit-driven patching, the oldest open gap. CSV circuit values are captured and displayed but don't yet auto-assign fixtures to SOCA circuits.

---

## 7. How to work on it

The full protocol is in the handoff, §4. The short version:

Ask before assuming — the user is the domain expert and corrections from them are usually the most valuable input in the session. Build in chunks. Verify with a real headless browser and explicit numeric assertions, not by eye. Never use the `Edit` tool on an existing file here. Keep changes surgical. Log every decision with attribution, so a future session can tell what was chosen from what was inferred.
