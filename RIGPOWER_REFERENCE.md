# RIGPOWER — Technical Reference & Handoff

> **Combined build - September 23, 2026:** `RIGPOWER_2026-09-23_222010.html` integrates Chunk 6B routing with E (settings persistence), F (live footprint updates and legacy migration), and H (circuit-name assignment). See `RIGPOWER_SESSION_2026-09-23_INTEGRATION.md` for current verification and remaining limitations. Older build pointers, roadmap status, and line references below are historical.


> **Revision 2 — September 21, 2026.** Folds in chunks 1–5 (3D cable layer, navigation and
> selection suite, graphical patch view, cable-ordering logic fix, monotonic sweep chains and
> coiled slack). Sections 4, 5, 6, 8, 9, 10 and 11 were substantially rewritten; section 12 is
> new. Sections 2, 3 and 7 are unchanged from revision 1 and remain accurate.
>
> **Merged (July 4, 2026):** RIGPOWER also lives inside **DLux Rackmaster v6.0+** as the
> LIGHTING workspace (shadow-DOM isolated, libs vendored inline). This file remains the
> authoritative reference for the lighting-domain logic; see the Rackmaster project notes
> for the merge architecture. The Rackmaster copy is **behind** this one — it predates
> chunks 1–5.
>
> **Current build:** `RIGPOWER_2026-08-25_103037.html` — 183,403 bytes, 3,477 lines.
> Line numbers below refer to that file. The original `RIGPOWER.html` (126,373 bytes) is
> frozen pre-merge and is never modified.

A single-file, browser-based **lighting power and cable calculator** for live-production
lighting design. It ingests industry-standard rig files (MVR / GDTF), models power
distribution and DMX data, visualizes the rig and its cabling in 3D, and computes the cable
order (multicables, jumpers, and data cable) needed to build the show.

This document is a complete handoff. It describes what the tool does, how it is built, the
domain reasoning behind each feature, and every hard-won implementation detail — so the
software can be understood, extended, or **merged into another codebase** without re-deriving
the lighting-industry logic from scratch.

---

## 1. What it is, in one paragraph

RIGPOWER is a self-contained HTML file (~183 KB, no build step, no server, no install —
double-click to run in any modern browser). It is aimed at a professional lighting
designer/programmer's real workflow: import the rig that was drawn in Vectorworks, confirm
fixture wattages, lay out power distribution across SOCAPex and L21-30 multicables, balance
the electrical phases, patch DMX universes, and generate the actual cable pick list —
including jumpers between fixtures and data runs — based on true 3D distances. Since
revision 1 it also **renders that cabling in 3D at true scale**, which is how a significant
defect in the ordering math was found (§12.1). It intentionally avoids external dependencies
beyond two CDN libraries (JSZip for reading the zip-based rig files, Three.js for the 3D plot).

---

## 2. Intended user & domain context

*(Unchanged from revision 1.)*

The user is a **professional lighting programmer/designer** working primarily with
**grandMA3** consoles and **Vectorworks Spotlight**. This tool is meant to be used during
pre-production and load-in. The user is a domain expert; the tool encodes their conventions
rather than teaching them the craft.

Key domain concepts the tool models (important for anyone extending it):

- **Fixture**: a lighting instrument (moving light, LED wash, strobe, etc.). Each fixture
  type has a **wattage** (power draw) and a **DMX footprint** (how many control channels
  it occupies), which depend on the fixture's selected **DMX mode**.
- **Position**: a physical location in the rig where fixtures hang (e.g. "SR Truss",
  "SL Pillars", "LX1"). Fixtures are grouped by position. *(As of chunk 5 a position also
  carries a derived cable **feed axis** and **feed end** — see §5.9.)*
- **Multicable (multi)**: a bundled power cable feeding several circuits from a distro.
  Two types are modeled:
  - **SOCAPex ("SOCA")**: 6 circuits per cable.
  - **L21-30**: 3 circuits per cable.
- **Circuit**: a single power channel within a multi that feeds one or more fixtures.
- **Phase / Leg (X, Y, Z)**: three-phase power. Balancing load evenly across X/Y/Z is an
  electrical requirement. In this tool the legs are named X/Y/Z (not L1/L2/L3) per the
  user's convention. Circuit→leg mapping is **fixed by the physical connector pinout**:
  - SOCA: circuits 1..6 → legs **X, Y, Z, X, Y, Z**
  - L21-30: circuits 1..3 → legs **X, Y, Z**
- **Breakout / Fan-out**: an adapter at the end of a multicable that splits it into
  individual fixture connectors (True1, PowerCon, Edison).
- **Home run**: the long cable run from the distro/dimmer back to the multicable's
  starting point.
- **Jumper**: a short cable hopping power from one fixture to the next along a truss
  (True1 or PowerCon).
- **Data cable**: DMX (5-pin) or Cat5e/Ethernet, carrying control signal.
- **Universe**: one DMX-512 line = **512 channels**. Fixtures are patched into universes
  without overlapping, respecting each fixture's footprint.
- **Distro / Node / Splitter**: physical devices. A power **distro** feeds multicables;
  a DMX **node** (gateway) converts network universes to physical DMX outputs; a
  **splitter** fans one DMX line to many.

---

## 3. File formats (MVR / GDTF) — parsing reference

*(Unchanged from revision 1. All findings verified against real files exported from
Vectorworks 31.5, grandMA3-compatible.)*

These are the crux of the tool and the least obvious part of the domain.

### 3.1 MVR (My Virtual Rig)
- An **MVR is a ZIP archive** containing `GeneralSceneDescription.xml` plus bundled
  `.gdtf` fixture files.
- Fixtures live in the XML under `Scene > Layers > Layer > ChildList > Fixture`.
- Each `<Fixture>` carries:
  - `<GDTFSpec>` — the filename of its GDTF profile (e.g. `Custom@Astera_TitanTube.gdtf`).
  - `<GDTFMode>` — the DMX mode name. **grandMA3/Vectorworks re-exports often write a
    generic `"DMX Mode"` placeholder here**, which won't match the real mode names inside
    the GDTF (see stub warning below).
  - `<Matrix>` — a 4×3 transform; the **last three numbers are the X/Y/Z origin in
    millimeters, Z-up**. Rig extents in the sample were ~72 ft × 69 ft × 15 ft.
  - `<FixtureID>` and `<UnitNumber>` — console/paperwork identifiers. In the sample files
    UnitNumber == FixtureID, all unique, all populated. **UnitNumber is the CSV join key.**
  - `<Addresses><Address break="0">N</Address>` — the DMX address as an **absolute**
    number. Decode: `universe = floor((N-1)/512)+1`, `channel = ((N-1)%512)+1`.
    Verified examples: `1249 → U3@225`, `1633 → U4@97`, `48 → U1@48`.
  - `<Position>` — a UUID reference to an `AUXData > Position` node (name = the lighting
    position). **Only ~half the fixtures had a Position ref**; the rest fall back to their
    enclosing `<Layer>` name for grouping.
- **Positions** are defined in `Scene > AUXData > Position` (uuid → human name).
- **Grouping strategy the tool uses**: group fixtures by Position ref first, then fall
  back to Layer name, so nothing is orphaned.

### 3.2 GDTF (General Device Type Format)
- A **GDTF is also a ZIP**, containing `description.xml`.
- **Wattage lives on `<Beam PowerConsumption="...">`** inside the geometry tree — NOT in
  a Properties block (an early wrong assumption). Multi-emitter fixtures reference one
  beam many times via `<GeometryReference>`.
- **Correct power = per DMX mode.** For a given mode, walk the mode's referenced geometry
  tree, resolving every `<GeometryReference>` back to its target, and **sum each `<Beam>`
  instance's PowerConsumption** (counting the referenced Beam target itself). This
  correctly handles: cell-based fixtures (12× beams sum), and multi-mode fixtures (each
  mode references different beams and must not be summed together).
- **DMX footprint = the max `Offset` value** across the mode's `<DMXChannel>` elements
  (NOT the channel count). Example: the Chauvet Rogue "56Ch Mode" has 33 logical channels
  but spans 56 addresses due to coarse/fine pairs and gaps → footprint 56.
- Verified per-mode power on real files: Elation KL Fresnel 500 W, Martin ERA 800 = 800 W,
  Chauvet Rogue Outcast 2X Wash = 475 W, Chroma-Q Color Force II 48 = 160 W.

### 3.3 The "stub" problem (critical)
grandMA3/Vectorworks **re-export fixtures into the MVR as simplified `Custom@…` GDTFs**
that carry a **generic 1000 W placeholder** beam and a mode literally named `"DMX Mode"`.
The real per-mode power only exists in the **standalone manufacturer GDTFs**. RIGPOWER
therefore:
- Marks such fixtures with a **`_stub`** flag and shows a **"stub"** badge + a toast
  prompting the user to drop the manufacturer GDTFs.
- **Refines by name-match**: when a standalone manufacturer `.gdtf` is dropped, it
  name-matches (loose, normalized) against fixtures already in the rig and overrides their
  wattage + footprint + mode. Refined fixtures get a **`_profile`** flag and a "GDTF"
  badge.
- Fixtures whose wattage the user typed by hand get a **`manual`** flag (an ✎ badge) and
  are **protected** from any auto-refine.

### 3.4 What MVR/GDTF do NOT carry
Confirmed by exhaustive tag/attribute inventory of two real exports: **MVR/GDTF contain
no circuit information and no user/custom fields.** The MVR schema has no `<Circuit>` or
user-field element, and Vectorworks does not write Spotlight's circuit name or user
fields into the MVR on export. This is why the **CSV bridge** (§7) exists.

---

## 4. Architecture & tech stack

- **Single self-contained HTML file.** All CSS and JS inline. No bundler, no framework.
- **Dependencies (CDN only):**
  - `JSZip 3.10.1` — unzipping MVR/GDTF archives in the browser.
  - `Three.js r128` — the 3D plot.
- **UI:** industrial dark theme, "Archivo" + "Spline Sans Mono" fonts, amber accent, with
  X/Y/Z leg colors blue/green/yellow. Console-inspired, high-contrast, legible under load-in
  lighting conditions.
- **No browser storage** (localStorage/sessionStorage are not used and are unavailable in
  the artifact sandbox). All state is in-memory; persistence is explicit JSON **Save/Load**
  and CSV export (§8).
- **Rendering model:** plain DOM construction via a small `$`/`$$` helper (line 673). Each tab
  has a `renderX()` function. The tab dispatcher (684–693) wraps renders in try/catch so a
  single bad record can never blank a tab. `renderCalc` additionally uses a **generation
  token** to cancel stale async refreshes and **self-heals** missing stock-length keys.

### 4.1 Three.js is pinned at r128 — deliberately

This was evaluated and the pin was chosen with the trade understood. Modern Three.js
(r160+) **dropped the UMD `<script>` build entirely; it is ESM-only.** Adopting it inside a
3,477-line single classic `<script>` requires an import map plus a module/classic boundary —
structural surgery on a working file. The alternatives considered and rejected:

- **r159 UMD pin** — last release shipping `build/three.min.js`. Deprecated dead end, and
  r155 changed light intensities and color output, so the plot would need re-tuning to look
  the same.
- **ESM shim with an import map** — workable, but introduces a module boundary for no
  functional gain given what the tool needs.

**Consequence:** all navigation, selection and cable-layer work is hand-rolled against the
existing spherical-orbit code. Everything needed exists in r128 and is confirmed working:
`TubeGeometry`, `TorusGeometry`, `ConeGeometry`, `OctahedronGeometry`,
`QuadraticBezierCurve3`, `LineCurve3`, `Sprite` + `CanvasTexture`. Note r128 has no bundled
`OrbitControls`; the tool hand-rolls spherical-coordinate orbit plus pan. Avoid r142+-only
geometries.

### 4.2 In-memory state shape

```js
// line 664
let state = {
  fixtures: [],   // type library:  {id,name,mode,watts,count,footprint,manual,_profile,_stub}
  positions: [],  // {id,name,tag,collapsed,multis:[multi]}
  instances: [],  // one per physical fixture in 3D (see below)
  devices: [],    // {id,kind,name,x,y,z,placed,outputs,inputs,voltage}
};
```

> **Note:** the in-file comment on `state` is stale and under-describes the real shape.
> `fixtures[]` items also carry `footprint`; `instances[]` items also carry `universe`,
> `address`, `circuit`, `userField1`, and sometimes `footprint` (see §9.6).

**Position → multi → circuit → slot hierarchy:**
```js
position = { id, name, tag, collapsed, multis: [multi] }
multi    = { id, type:'SOCA'|'L21-30', volts:120|208,
             homerun:<ft>, dmx:<ft>, eth:<ft>, breakout:<string>,
             circuits: [circuit] }
circuit  = { leg:'X'|'Y'|'Z',            // FIXED by pinout, never reassigned by hand
             slots: [ {fix:<fixtureName>, qty:<n>}, ... 4 slots ] }
```

**Instance (one per physical fixture, from the MVR):**
```js
instance = { id, name, type:<fixtureName>, pos:<positionName>,
             x, y, z,             // millimeters, Z-up, from MVR Matrix
             fid,                 // FixtureID
             universe, address,   // DMX patch (decoded from MVR or set here)
             footprint,           // per-instance snapshot, set by autoPatch only (§9.6)
             circuit, userField1, // from CSV bridge (null until imported)
             assigned:            // links a physical fixture to a power circuit:
               { positionId, multiId, circuitIndex } | null }
```

The **fixtures[]** array is the *type library* (one row per fixture model, carries
wattage/footprint/mode). The **instances[]** array is *every physical unit* (carries 3D
position and patch). A circuit's `slots` reference fixtures by name and aggregate by
quantity — this is the power-math model. `instance.assigned` is the bridge from a physical
unit in the 3D plot to a specific power circuit.

### 4.3 Module-level state outside `state`

Everything here is **module-level and outside `state`, therefore NOT saved** (§8.2).

| Symbol | Line | Purpose |
|---|---|---|
| `stockLengths` | 624 | Editable per-type stock lengths — **Cables tab only** (§9.1) |
| `JUMPER_STD` | 2957 | Hard-coded stock ladder — **Auto-Cable only** (§9.1) |
| `cableSlack` | 2962 | `{pct:10, minFt:0.5}` — auto-cable slack allowance |
| `PLOT` | 1542 | All 3D state: renderer, camera, meshes, `selectedSet`, `xform`, `cable{}`, tool state |
| `PMAP` | 2500 | Channel-map drag state |
| `_posAxisCache` | 3021 | Per-position feed axes; reset at the top of every `computeAutoCable()` |
| `CSVSTATE` | 3322 | CSV import staging |
| `gdtfProfiles` | 1285 | Parsed standalone GDTF profiles, for refine-by-name |

`PLOT.cable` holds the cable-layer settings:
```js
cable:{ power:true, data:true, homerun:false, mode:'ordered',
        offset:1, ends:true, numbers:false, origins:true, coils:true }
```

### 4.4 The coordinate transform — share it, never re-derive it

3D coordinates are **millimeters, Z-up** internally (from MVR). The UI converts to feet for
display (÷304.8). Cable lengths are in **feet**.

`renderPlot()` computes the mm→scene transform and **publishes it** as
`PLOT.xform = {cx, cy, minZ, SC}` (where `SC = 10 / spanMM`, scaling the rig's largest
bounding-box dimension to 10 scene units). Anything drawing into the 3D scene must reuse it:

```js
// plotVec(), line 1759 — MVR Z-up mm  ->  three.js Y-up scene units
new THREE.Vector3( (p.x - cx) * SC,
                   (p.z - minZ) * SC,      // Y-up comes from MVR Z, floored so deck sits at y=0
                   (p.y - cy) * -SC )
```

Deriving the transform independently would drift the moment the scaling rule changes.

---

## 5. Feature-by-feature reference

Tabs: **Import · Fixtures · Power Calc · 3D Plot · Summary · Cables · Patch · Auto-Cable · Devices.**

| Tab | Section id | Render fn | Line |
|---|---|---|---|
| Import | `#view-import` | — (drop handlers) | 281 |
| Fixtures | `#view-fixtures` | `renderFixtures()` | 709 |
| Power Calc | `#view-calc` | `renderCalc()` | 866 |
| 3D Plot | `#view-plot` | `renderPlot()` | 1658 |
| Summary | `#view-summary` | `renderSummary()` | 1014 |
| Cables | `#view-cables` | `renderCables()` | 1065 |
| Patch | `#view-patch` | `renderPatch()` | 2781 |
| Auto-Cable | `#view-autocable` | `renderAutoCable()` | 3188 |
| Devices | `#view-devices` | `renderDevices()` | 2883 |

### 5.1 Import
- Drag/drop `.mvr` and `.gdtf` files (and a separate `.csv` dropzone — §7).
- Builds the fixture library, positions, and 3D instances from an MVR; refines wattage from
  standalone GDTFs.
- A **parse log** reports counts (fixtures matched, 3D instances, pre-addressed from MVR,
  circuit/user-field found or not) and any stub warning.
- "Load demo rig" and "Start blank" buttons for exploring without files.

### 5.2 Fixtures
- The type library: name, mode, **watts** (editable → sets `manual` lock), **footprint**
  (DMX channels), a **Source** badge (manual / GDTF / stub), and count.
- ↺ revert button on manually-locked rows re-derives from a matching loaded profile.

### 5.3 Power Calc
- Per position: add SOCAPex or L21-30 multis.
- Per multi: **voltage** (120/208, cascades to circuits), **home run (ft)** numeric input
  with a live cable-build preview, **breakout** dropdown, **DMX (ft)** and **Enet (ft)**
  data-run inputs.
- Per circuit: leg pill (X/Y/Z), **4 fixture slots** (type × qty), live watts & amps.
- Watts = Σ(fixture.watts × qty). Amps = watts ÷ volts.

### 5.4 3D Plot — core

Renders every instance from real MVR coordinates. Floor fixtures sit at ground, trusses
elevated. Fixtures are spheres; devices (distros/nodes/splitters) are colored boxes.

- **View presets:** Perspective / Top / Front (`.plotview`), plus **Fit view** (`#btnFit`).
- **Color modes:** by Leg (X/Y/Z once assigned) / by Position / by Type, with a legend
  (`.plotcolor` → `applyColorMode()`, 1714). The Patch tab's Channel Map mirrors this mode
  and its buttons stay in sync with these.
- **Click a fixture** → info panel to assign it to a Position → Multi → Circuit (writes into
  that circuit's slots). Multi-select supports bulk assign.
- Click-vs-drag is distinguished by straight-line distance from mousedown (**>6 px = drag**);
  selection fires on mouseup for reliable modifier capture. **This threshold and the
  `pickFixture` path survived the chunk-2 rewrite unchanged.**

### 5.5 3D Plot — navigation & selection *(chunk 2)*

**The interaction collision and its resolution.** The plot originally inferred intent from the
gesture: left-drag orbited, a sub-6 px press picked. A rubber-band marquee is *also* a
left-drag, so gesture inference alone could no longer disambiguate. The resolution was to make
the left button **modal** and give navigation **dedicated buttons that work in every mode**.

| | |
|---|---|
| **Left button** | Runs the active tool: Orbit / Pan / Rect / Lasso / Paint |
| **Middle drag** | **Always** pans, whatever tool is active |
| **Right drag** | **Always** orbits, whatever tool is active |
| **Wheel** | Dolly |
| **Shift / Alt** | Add to / subtract from selection |

- `panCamera(dx,dy)` (2076) slides the orbit target along the camera's own right/up axes,
  scaled by dolly distance so the drag feels identical at any zoom. **Pan did not exist
  before chunk 2.**
- `cacheProjections()` (2087) projects every *visible* fixture mesh to canvas pixels **once,
  at drag start** — the camera cannot move during a selection drag, so one pass serves the
  whole gesture (3.5 ms for 120 fixtures).
- **Rect** — screen-space box test. **Lasso** — `pointInPoly` ray-casting (2099), verified
  correct on concave paths. **Paint** — a radius brush (10–120 px) that accumulates onto the
  selection as it existed when the stroke began, so re-crossing a fixture never toggles it off.
- **Select Similar** (`selectSimilar`, 2171) matches on type / position / universe /
  **assigned circuit** (`positionId|multiId|circuitIndex`) / CSV circuit name. Given the data
  model this is the highest-leverage selector: click one fixture, get its whole circuit. Guarded
  so a seed with a `null` value for the chosen attribute toasts rather than sweeping up every
  other null-valued fixture.
- **Isolate** (`applyIsolate`, 2185) hides unselected fixtures **and every cable run touching
  none of them** — leaving other circuits' jumpers drawn would make an isolated view
  unreadable. Survives a `buildCables()` rebuild.
- A `#plotOverlay` 2D canvas above the WebGL canvas draws the marquee, lasso path and brush ring.

**Keyboard** (active only when the 3D tab is up, focus is not in an input/select/textarea, and
no Ctrl/Cmd is held — handler at 2437):

| Key | Action |
|---|---|
| `1`–`5` | Orbit / Pan / Rect / Lasso / Paint |
| `a` | Select all |
| `n` or `Esc` | Select none |
| `i` | Invert |
| `s` | Select similar |
| `h` | Toggle isolate |
| `f` | Fit view |

**Selection is shared across three views** — the 3D plot, the Patch sheet, and the Channel
Map all read and write `PLOT.selectedSet`, routed through `afterSelectionChange()` (2139).

### 5.6 3D Plot — the cable layer *(chunks 1, 4, 5)*

Renders what the auto-cable engine computed, at true scale. **This is the feature that
exposed the ordering defect in §12.1.**

**Toolbar:** `Power` / `Data` / `Home runs` layer toggles (home runs default off — they are
long and visually dominate); `Taut` / `Hang` mode; `Ends` / `Nos` / `Origin` / `Coils` marker
toggles; a separation slider; a recalculate button; and a live readout
(`13 runs · 128' true / 195' ordered · 67' slack`).

**Geometry.** `buildCables()` (1939) consumes `computeAutoCable().segments` (§5.9) and builds
a `TubeGeometry` per run into `PLOT.cableGroup` — a group added directly to the scene, **not**
to `PLOT.group`, so `renderPlot()`'s wholesale clear of the fixture cloud never touches it,
and cables never enter `PLOT.meshes` (which means **fixture picking is completely
unaffected**). `clearCables()` (1923) disposes geometry and material on every rebuild —
with a `c.type!=='Sprite'` guard, because `THREE.Sprite` shares one static geometry globally.

**Color.** Power = leg color (falling back to amber when unassigned); data = DMX purple or
Cat5e teal; home runs = muted blue-grey at 75% opacity and thinner.

**Per-family offsets** (`cableOffsetVec`, 1836). Power and data run the same physical path, so
drawn on the fixture centres neither is readable. Each family gets a lateral (perpendicular,
horizontal) and vertical nudge, scaled by the slider:

```js
const CABLE_OFFSET={ power:{lat:-1, vert:-0.85}, data:{lat:1, vert:0.85}, homerun:{lat:0, vert:-1.7} };
```

A near-vertical run has no meaningful horizontal perpendicular; the code falls back to world X.
**Both endpoints are floored to y ≥ 0 after the offset** — a deck-level distro would otherwise
be pushed under the floor before the sag clamp ever saw it (§12.3).

**Markers** (`addCableMarkers`, 1869): a torus ring at each run's source and a cone at its
destination (showing chain flow), an octahedron at the device each chain home-runs back to,
optional numbered chain badges (canvas-texture sprites, cached per number in `_numTex`;
lifted above the joint so they neither cover it nor put half their quad under the deck), and
a **coil** torus at the termination when `std − raw > 0.5 ft`.

**Hover** (`cableHover`, 2042) gives the run's true gap, the ordered stock length, the build
(`50'+25'+5'`), the slack, and its link index in the chain.

**Sag model — see §12.2 and §12.3.** Short version: surplus is **coiled at the termination**,
not swagged from a fixture. `taut` mode draws dead-straight `LineCurve3`; `hang` mode drops the
control point by `chord × NATURAL_SAG (0.07)`, bounded by an exact floor guarantee.

### 5.7 Summary + Auto-Balance
- Total draw, X/Y/Z leg stat cards, animated balance bars, a live **imbalance** readout,
  and a per-position table (watts per leg, amps @120 and @208).
- **⚖ Auto-balance phases** (the electrically important feature): reassigns which circuit
  each fixture *group* sits on to even out X/Y/Z load — **without changing the fixture
  groupings the user intentionally chose.**
  - A circuit's leg is fixed (physical pin). Balancing permutes **which group occupies
    which circuit slot**, effectively moving a group to a different leg.
  - Solved per-multi as a **leg-assignment problem**: assign each group to X/Y/Z subject to
    each leg's slot **capacity** (SOCA = 2 slots/leg, L21-30 = 1/leg), minimizing the
    max−min phase spread. Because placement is computed directly (not by manual swapping),
    **no group is ever lost or misplaced even when every slot is full** — this is the
    "towers of Hanoi" concern, solved structurally.
  - `instance.assigned.circuitIndex` values are re-pointed after a rebalance so 3D-plot
    assignments continue to reference their group.

### 5.8 Cables
- **Editable stock lengths** per type (SOCAPex / L21-30 / DMX / Ethernet) via `#stockEditors`.
  **Caution:** these do not reach the Auto-Cable tab — see §9.1.
- Per multi: home run → **build** (e.g. `150′ → 100′ + 50′`), the breakout, and the data builds.
- **Cable-build solver** (`buildRun`, 627): given a target length and stock sizes, find the
  build with **least overage first, then fewest cables**. Round *up* to ≥ target.
  Examples: `150′ → 100′+50′` (exact), `75′ → 50′+25′` (exact, beats one wasteful 100′).
  Implemented as a DP over achievable sums up to `target + maxStock`. **The target must be an
  integer — see §12.4.**
- Aggregated **cable-part totals** by type & length, and **breakout totals**.

### 5.9 Auto-Cable *(substantially rewritten in chunks 4 and 5)*

From the 3D layout, compute the jumper and data cabling.

**Grouping.**
- **Power jumpers**: fixtures on the **same circuit** (same position + multi + circuit).
- **Data jumpers**: fixtures on the **same universe AND the same position**. Grouping on
  universe alone let a chain leap ~40 ft from one truss to the next whenever `autoPatch`
  packed a universe across a position boundary. Power never had this problem because power
  groups are keyed to a position; the data key now mirrors it
  (`universe + '␟' + pos`).

**Chain ordering — strict monotonic sweep.** *Rule (from the user): a run never doubles back
on itself, and every run to a position enters from the same end.* Greedy nearest-neighbour
honoured neither — it stranded fixtures into long return hops, and each circuit picked its own
start, so two circuits on one truss could be fed from opposite ends.

- `positionAxes()` (3022) computes, **once per position from all of that position's fixtures**
  (not per group — this is what makes "same direction" true), a principal horizontal axis by
  2×2 PCA, and a feed `sign` set by whichever extreme fixture is nearer `homerunOrigin()`.
  Cached in `_posAxisCache`, reset at the top of every `computeAutoCable()`. PCA rather than
  larger-extent because a truss is rarely aligned to X or Y; verified exact on +X, +Y and 45°
  trusses, and safe on degenerate cases (single fixture, coincident pair, circular cluster).
- `sweepOrder()` (3064) sorts a group along that shared axis, tie-breaking on perpendicular →
  height → id so a second row stays adjacent instead of being revisited. **Monotonic by
  construction — doubling back is impossible, not merely unlikely.**
- `chainOrder()` (2995) is the legacy greedy walk, retained for A/B but **dead** (§9.5).

**Home-run origin** (`homerunOrigin`, 3082) = the nearest **placed device** (Devices tab) to the
group centroid; falls back to the rig centroid at floor level with a note if no device is placed.

**Lengths.** Each gap goes through `buildJumper()` (2969) → `slackTarget()` (2963) →
`buildRun()` — the **same least-overage multi-piece solver the Cables tab uses**. Slack
allowance is user-editable (`cableSlack`, default 10% / 0.5 ft minimum, fields on the tab).

**Parts are tallied per piece**, so an 80 ft build contributes one 50, one 25 and one 5 rather
than a fictitious single 80 ft cable.

**The `segments[]` contract.** `computeAutoCable()` (3122) returns, alongside the part tallies
and detail arrays, a geometry channel consumed by the 3D layer:

```js
{ kind,                       // 'power' | 'data' | 'homerun-power' | 'homerun-data'
  a, b,                       // endpoint objects with .x/.y/.z (mm, Z-up)
  aId, bId,                   // instance ids
  raw,                        // true 3D gap, ft
  std,                        // ordered/built total, ft
  pieces,                     // [50,25,5]
  ai, bi, chainLen,           // chain indices
  group        // power kinds only:  positionId|multiId|circuitIndex
  universe, pos              // data kinds only
}
```

> **The contract is not uniform:** home-run kinds **omit `aId`**, because their "a" endpoint
> is a device or the rig centroid, not a fixture instance. Current consumers guard this; any
> new consumer must.

`cableFamily(kind)` (1934) collapses the four kinds to three render families: `power`, `data`,
and anything starting with `homerun`.

### 5.10 Patch (DMX-512)
- Auto-populates universe/address from the MVR on import (absolute-address decode).
- **Auto-patch** (`autoPatch`, 2467): packs fixtures by Position → Type into universes,
  sequential addresses, respecting each fixture's footprint, never overlapping, rolling to the
  next universe when one fills. Warns before overwriting imported/manual addresses.
  **Not position-aware at universe boundaries** — a universe can straddle two trusses, which is
  why data chains split by position (§5.9).
- Manual override on every universe/address; **overlap** and **>512** warnings; a per-universe
  channel-usage bar. Columns include FID and (from CSV) Circuit.
- **Cross-linked with the 3D selection:** selected fixtures get an amber row bar, a
  "3D selection only" checkbox filters to them, and clicking a row (outside the editable cells)
  drives the 3D selection back. Shift-click extends.

### 5.11 Patch — the Channel Map *(chunk 3)*

A graphical patch view: one **32-wide block per universe**, every channel drawn, in a panel
below the patch sheet.

**The implementation choice that matters.** A literal 512-cell grid per universe is the obvious
build and the wrong one — 512 DOM nodes × N universes, re-rendered on every address edit and
every drag frame, with no room to letter a run. Instead, **consecutive channels sharing an owner
are coalesced into a single CSS-grid cell spanning them** (`grid-column: span N`). A universe
holding 20 fixtures draws ~100 elements instead of 512, and a wide run has room for its FID.
Because every row is still exactly 32 uniform columns, nothing is lost: **pointer → channel is
pure arithmetic off the container's bounding rect** (`pmChanFromPoint`, 2655), not
`elementFromPoint`. That is what makes the drag exact — hit-testing against coalesced cells
would have been ambiguous. Verified lossless: the per-channel owner array reconstructed from
the rendered DOM matches computed occupancy across all channels, with every row's spans summing
to exactly 32.

- **Per universe:** header with used/total, percentage, an overlap warning with exact channel
  count, and the three largest free gaps as `24ch @ 25` chips. A left gutter labels each row's
  first channel.
- **Runs** carry the fixture's FID when wide enough; hover gives FID, type, mode, position,
  circuit, range and footprint.
- **Free gaps** are hatched and labelled with the **full span length at every piece** — a
  24-channel hole straddling channel 32 renders as two cells both reading `24`, not `8` and `16`.
- **Overlaps** render red across exactly the intersecting channels.
- **Click** a run to drive the shared selection; shift extends.
- **Drag** a run to re-address it: live green/red ghost, a readout showing the proposed range,
  **grab-offset preserved** (grab the middle of a run and the run moves, not its start), clamped
  to the universe bound, refused on collision with a warn toast, committed only on a clean drop.
  Drag across grids to change universe. A **spare empty universe** is always appended so a run
  can be dragged out into a fresh one. `Esc` cancels.
- Colors follow `PLOT.colorMode` via `instanceColors()` (2504), and the color-by buttons appear
  in both tabs and stay in sync.
- Respects `#uniSize`, so a 256-channel universe draws 8 rows and clamps accordingly.

### 5.12 Devices
- Add **Power Distro** (configurable multi outputs + voltage), **DMX Node**, **DMX Splitter**
  (configurable input/output ports).
- Place via X/Y/Z (entered in feet, stored in mm). Placed devices anchor cable home runs and
  appear in the 3D plot.
- **Device placement drives feed direction.** `homerunOrigin()` picks the nearest placed device,
  and that choice sets each position's feed end (§5.9) — so moving a distro re-routes every
  chain. Placement is currently numeric entry only; direct manipulation is the next planned work
  (§9.10).

---

## 6. Cable / power constants (as delivered)

```
SOCA legs (circuit 1..6):   X Y Z X Y Z
L21-30 legs (circuit 1..3): X Y Z
Slots per circuit:          4

Default stock (ft) — stockLengths, line 624, EDITABLE, Cables tab only:
  SOCAPex   5, 15, 25, 50, 100
  L21-30    5, 10, 15, 25, 50, 100
  DMX       5, 10, 25, 50, 100
  Ethernet  5, 10, 25, 50, 100

JUMPER_STD — line 2957, HARD-CODED, Auto-Cable only:
  5, 10, 15, 25, 50, 100

cableSlack — line 2962, editable on the Auto-Cable tab:
  { pct: 10, minFt: 0.5 }        target = max(ft*(1+pct/100), ft+minFt)

NATURAL_SAG   0.07    control-point drop as a fraction of chord, 'hang' mode
CABLE_OFFSET  power {lat:-1, vert:-0.85} · data {lat:1, vert:0.85} · homerun {lat:0, vert:-1.7}
PM_COLS 32 · PM_GUTTER 30      channel-map grid

LEG_COLORS    X #4aa3e0 · Y #43d18a · Z #f0c64a
CABLE_DATA_COLORS  DMX #a06cd5 · Cat5e #3dd6c4
CABLE_HOME_COLOR   #6d7c8f

SOCA breakouts:   SOCA→True1, SOCA→PowerCon, SOCA→Edison, SOCA→Edison Breadbox
L21-30 breakouts: Edison Breadbox (110v), Twistlock Breadbox (208v), True1 Fanout (120v)
```

---

## 7. CSV bridge (circuit / mode / footprint import)

*(Unchanged from revision 1.)*

Because MVR/GDTF carry no circuit or user-field data, RIGPOWER imports it from a
Vectorworks/Lightwright **worksheet CSV**.

- Dropzone on the Import tab (requires an MVR imported first, to have fixtures to match).
- **Robust CSV parse** (handles quoted fields, embedded commas/quotes).
- **Column auto-detection** by header keyword across many variants (e.g. Unit Number/U#/Unit;
  Circuit Name/Ckt; User Field 1/UF1; DMX Mode/Mode; Hanging Position/Pos; Instrument
  Type/Type; Footprint/Channels; Wattage). A **mapping UI** shows the guesses + a sample
  value per column and lets the user correct any mapping.
- **Join key: Unit Number** (falls back to Fixture ID). Unmatched rows are reported.
- **Conflict review** before applying: if the CSV disagrees with a *real* MVR/GDTF value
  (e.g. CSV says 44Ch, GDTF says 56Ch), each conflict is listed with a keep-MVR / use-CSV
  choice (plus "all CSV" / "all MVR"). Stub values (placeholder footprint 1, blank fields)
  are filled silently. MVR position is treated as authoritative (CSV position only fills if
  missing).
- Applied circuit data appears in the Patch tab's **Circuit** column and flows into the
  auto-cable grouping. Mode/footprint/wattage update the fixture library.

### The user's Vectorworks convention (important)
- The user uses **"User Field 1"** as a plaintext note for **fixture mode and footprint**
  (e.g. `Mode 1 / 32`, `56Ch Mode / 56`, `32ch`). `parseUserFieldModeFootprint()` (1489)
  extracts both from such strings.
- **Not yet built:** circuit data is stored/displayed but does not yet *auto-assign*
  fixtures to SOCA circuits based on the imported circuit name (§9.9).

---

## 8. Persistence & export

### 8.1 What is saved

**Save/Load project** (3217 / 3223): full `state` plus `stockLengths` (as `_stock`) to/from a
JSON file. Load **merges** stock onto defaults (so older projects self-heal missing keys) and
back-fills `instances`/`devices` arrays, then re-renders Fixtures and Power Calc; other tabs
render lazily on click from live `state`.

Persisted: `fixtures`, `positions` (incl. all multis/circuits/slots), `instances` (incl.
coordinates, universe, address, circuit, userField1, assigned), `devices` (incl. **positions
and `placed`** — devices live inside `state`), and `stockLengths`.

**CSV export**: power-by-position, fixtures, multicables (with builds + data), and cable part
totals.

### 8.2 What is NOT saved — a known gap

`PLOT` and `cableSlack` are module-level and outside `state`, so **nothing added in chunks 1–5
for cable-layer tuning survives a save/reload**:

- `PLOT.cable` — layer visibility, taut/hang, offset, marker and coil toggles. Resets to the
  declared defaults.
- `cableSlack` — `{pct, minFt}`. A project-specific slack tolerance reverts to 10% / 0.5 ft.
- `#uniSize`, `#jumperType`, `#dataType`, `#slackPct`, `#slackMin` — plain DOM, reset on reload.
- Transient UI (`PLOT.tool`, `brush`, `selectedSet`, `isolate`, `colorMode`) — reasonable to
  lose, but selection is central to the workflow, so worth stating.

Fixture/position/patch/device data is fully durable. Fixing this means moving `cableSlack` and
`PLOT.cable` into the saved payload (a `_ui` key alongside `_stock` would match the existing
pattern).

---

## 9. Known limitations & natural next steps

Carry these forward — they are the honest edges of the current build.

### Defects

1. **`stockLengths` and `JUMPER_STD` can silently disagree.** *(confirmed, not hypothetical)*
   The Cables tab lets the user edit stock per type. Auto-cable ignores it: `groupCables()`
   calls `buildJumper(raw)` and `buildJumper(homerunFt)` with **no `sizesIn` argument** (3111,
   3116), so `buildJumper` always falls back to the hard-coded `JUMPER_STD`. Strip 15 ft and
   25 ft from DMX stock and the Cables tab respects it while Auto-Cable keeps building short
   jumpers from 15s and 25s. Both UIs say "DMX" and both call the same `buildRun` solver.
   **Fix: thread the per-type stock list through.**
2. **The Jumper/Data type selects are cosmetic.** True1 ↔ PowerCon and DMX ↔ Cat5e only change
   a string key in the parts tables (`jumperType+'|'+p`). Lengths always come from `JUMPER_STD`.
   A maintainer will reasonably assume "Cat5e" pulls an Ethernet stock table. It does not.
   Natural to fix alongside item 1.
3. **Cable-layer settings and slack tolerance are not persisted** — §8.2.
4. **Auto-patched instances freeze their footprint.** `autoPatch()` writes `it.footprint` per
   instance (2483); manual address edits never do. Edit a fixture type's footprint later and
   manually-patched instances pick it up live while auto-patched ones keep the stale snapshot.
5. **Dead code sits next to live code with no marker.** Verified zero callers:
   `solveSagScene` / `sagArc` / `curveLen` (1766–1791, the chunk-4 sag solver, superseded by
   `cableCurve`'s closed-form math at 1801), `chainOrder` (2995), and `fixSeq`/`posSeq`/`multiSeq`
   (670 — vestigial; ids come from `uid()`). The sag trio is the real risk: it computes the same
   visual via different math, directly above the function actually used. Someone will fix the
   wrong one.
6. **`segments[]` is not uniform** — home-run kinds omit `aId` (§5.9).

### Behavioural limits

7. **The sweep costs ~19.6% more cable than greedy** (Σ raw 1,648 → 1,971 ft on the 90-fixture
   test rig). Greedy was cheaper only because it could zigzag. Most of the gap is two-row
   positions, where a monotonic sweep interleaves front and back rows as it advances. A
   "sweep out, one return leg back" variant would recover most of it; it was offered and
   declined, and is recorded here because the number is real.
8. **Home-run parts are drawn but not tallied**, to avoid double-counting the Cables tab's
   multicable home runs. Now that both sides use `buildRun`, unifying them is clean.
9. **Circuit-driven patching not wired.** CSV circuit values are stored and shown but don't
   auto-assign fixtures to SOCA circuits. Needs a parser for the user's circuit-naming
   convention (e.g. `L1-7`, `SOCA 2.3`) mapped onto position → multi → circuit. Select Similar
   can now grab a whole circuit in one click, which closes half the loop. **Still the oldest
   open gap.**
10. **Device placement is numeric entry only.** Direct manipulation (drag in 3D plus a top-down
    view) is the next planned work, and is the plumbing prerequisite for cable paths (§9.11).
11. **Cable paths — the planned architecture change, not yet built.** The user's framing,
    recorded verbatim because it supersedes rather than extends: *"Cable paths will serve as the
    defining rule set for where cable is allowed to run… cable break locations, hopovers, truss
    swags (a spot where cable swags from truss to truss, unsupported in the middle), and other
    plot notes… accurately place these paths in 3D space."* Implications: paths **override** the
    auto-derived feed axis (§5.9), which becomes the fallback for positions with no path; run
    length follows the permitted route rather than the straight-line gap, changing `groupCables`
    at its core; and catenary sag returns in the one place it is physically real — an
    unsupported truss-to-truss swag.
12. **Screen-space selection is depth-blind** — a marquee grabs fixtures behind other fixtures.
    Standard marquee behaviour; orbit or isolate first.
13. **Channel-map drag re-address is single-fixture** — a multi-selection is not moved as a block.
14. **A fixture spanning a channel-map row boundary** renders as two adjacent blocks. Inherent to
    a 32-wide grid; shared colour and label make it read correctly.
15. **An overlapped channel can only show one colour**, so it renders red rather than either
    owner's.
16. **Ring/cone markers at deck-level fixtures** extend ~0.12 scene units below y=0 — their own
    geometric radius, not sag. Number badges were lifted; solid markers were not.
17. **Multi-break fixtures**: only the first `<Address break>` is read.
18. **Real fixture models in 3D**: fixtures are spheres; MVR bundles `.glb` geometry that could
    be rendered.
19. **Adapters/breakout counts** are modeled in dropdowns but the auto-cable tables count cable,
    not adapter quantities (e.g. a 2-fer when fixtures share a drop).
20. **Instance-per-slot identity**: a circuit slot aggregates by fixture type + qty (correct for
    power math) rather than tracking each individual physical unit within a slot.

---

## 10. Notes for merging into another codebase

If lifting logic out of the single file, the cleanly-separable, dependency-light pieces are:

- **MVR/GDTF parsing** (`parseMVR`, `parseGDTFBlob`, `buildGeomIndex`, `modePower`,
  `resolvePower`, `resolveFootprint`, `parseMatrixOrigin`, `extractFixtureField`,
  `parseUserFieldModeFootprint`). Pure except for JSZip + DOMParser. This is the
  highest-value, hardest-to-rederive code — the geometry-reference power walk and the
  stub/refine logic especially.
- **Cable-build solver** (`buildRun`) and **auto-cable math** (`slackTarget`, `buildJumper`,
  `positionAxes`, `sweepOrder`, `homerunOrigin`, `groupCables`, `computeAutoCable`) — pure
  functions apart from reading `state`. **Take `buildRun` and `buildJumper` together**; the
  whole point of chunk 4 was that there must be exactly one build solver.
- **Phase balancer** (`balanceMulti`, `rebalanceAll`) — pure except it mutates `state`.
- **Auto-patch** (`autoPatch`) and **address decode** — pure logic.
- **CSV bridge** (`parseCSVText`, `autoDetectCols`, `buildMergePlan`, `applyCSVPlan`).
- **Channel-map rendering** (`pmOccupancy`, `pmGaps`, `pmGridHTML`, `pmBlockHTML`) — pure
  string/array work, no THREE dependency, portable to any DOM.

Coupling to watch for when merging:
- Everything reads/writes the module-global **`state`** object and the config globals in §4.3;
  a merge should either keep that shape or introduce an adapter layer.
- Rendering is DOM-string based and tab-scoped; the compute functions are cleanly separable
  from the `renderX()` functions.
- Leg/phase naming is **X/Y/Z** throughout (the user's convention) — map to L1/L2/L3 if the
  other system uses that.
- Units: 3D coordinates are **millimeters** internally; the UI converts to feet (÷304.8).
  Cable lengths are in **feet**. The mm→scene transform is published as `PLOT.xform` (§4.4) —
  reuse it, never re-derive it.
- Fixture identity is **by name** across the library and circuit slots; instances reference
  fixtures by `type` (the name). Keep names stable or introduce IDs when merging.
- The 3D layer depends on `segments[]` (§5.9), not on any renderer internals — that boundary
  is the clean seam between engine and view.

---

## 11. Provenance / development notes

- Built iteratively with real-hardware/real-file validation. All parsing claims in §3 were
  verified against actual Vectorworks 31.5 MVR exports and standalone manufacturer GDTFs
  (Elation KL Fresnel, Martin ERA 800, Chauvet Rogue Outcast 2X Wash, Chroma-Q Color Force
  II 48, GLP JDC1).
- The two sample MVRs differed: one 64-fixture rig, one 44-fixture rig; the latter carried
  one genuine (non-stub) Elation GDTF, confirming the refine path.
- Neither sample MVR contained circuit or user-field data — the exhaustive tag/attribute
  inventory that motivated the CSV bridge is documented in §3.4.
- **Chunks 1–5 (Aug 24–25, 2026)** were each verified by a headless Chromium suite against a
  synthetic 90-fixture rig built to match a real export (4 positions, 70×70 ft, trims
  15/20/25 ft, 26 floor fixtures + 64 across three trusses, patched with the app's own
  `autoPatch()`). The suites assert numeric behaviour, not appearance. Six real defects were
  found that way, several invisible from reading the code — see §12.
- Full decision log, with every choice tagged user-specified or agent-specified:
  `RIGPOWER_SESSION_2026-08-24_112141.md`.

### 11.1 Working protocol for this file

1. **Never overwrite an iteration.** Every change ships as a new file with date and time
   appended; max 4 iterations, FIFO.
2. **Take a real timestamp at the moment of file creation.**
3. **Never use the `Edit` tool in this environment.** The Windows↔sandbox bridge has silently
   corrupted in-place edits — reported success, file truncated and NUL-padded to its pre-edit
   length — on at least four occasions. Do scripted exact-string replacement with a
   `count == 1` assertion per anchor (so a drifted anchor aborts before anything is written),
   and **byte-verify** (`wc -c`, `md5sum`) on both sides of any copy.
4. **The file contains literal glyphs, not HTML entities** — `↻`, `′`, `—`. Anchor on the real
   characters; pull exact bytes with `repr()` rather than trusting a `sed` dump's apparent
   indentation.
5. **Verify by extracting the inline script and running `node --check`** before shipping.
6. **Minimal, surgical changes.** No refactoring of working systems.

---

## 12. Hard-won implementation details

The things that cost the most to get right, or that were wrong and shipped before being caught.
Read this section before touching the cable engine.

### 12.1 The ordering defect the 3D layer exposed

`roundUpStd` originally picked **one** stock length ≥ need. With a table that jumps 50 → 100
with nothing between, a 46–77 ft home run was ordered as a flat **100 ft** — up to 117% over.
Separately, the slack rule `max(ft × 1.10, ft + 1)` had a **+1 ft floor** that pushed a 4.67 ft
truss hop past the 5 ft jumper onto a 10 ft — 114% over on the shortest and most numerous runs.

Meanwhile the Cables tab already contained `buildRun`, a correct least-overage multi-piece
solver. **Two algorithms for the same job in one file, and auto-cable had the worse one.**

Routing auto-cable through `buildRun` cut the test rig from **2,615 ft → 2,200 ft, a 415 ft /
15.9% saving**, and a 77 ft run now builds as 50+25+5 rather than a single 100.

> **Lesson worth keeping:** the defect was invisible while the output was a table of numbers.
> It became obvious the moment the same data was drawn at true scale. The 3D cable layer is not
> decoration on the math; it is how the math gets audited.

**Still open:** the slack default. At 10% / 0.5 ft a 4.67 ft hop *still* orders a 10 ft jumper —
the 10% binds, not the floor. Lowering the percentage alone does not help, because then the
0.5 ft floor takes over (`slackTarget` is a `Math.max` of the two). Getting a 5 ft jumper on that
hop needs roughly 5% **and** a 0.25 ft minimum. That is a domain judgement about how much dress a
jumper needs, so the default was left for the user to set.

### 12.2 Sag: the model was replaced, not tuned

Chunk 1 solved sag numerically so the drawn arc length *equalled* the ordered stock length —
the sag literally was the waste. Visually this produced curves plunging a full rig-height below
the floor, and the user's correction was that the premise is wrong:

> *"Any slack is coiled up at the start or termination point of the cable — I'd never have 20'
> of slack swagging down from a fixture, and sometimes that wouldn't even be possible."*

So `cableCurve` no longer solves for length at all. `taut` draws a `LineCurve3`; `hang` drops
the control point by `chord × NATURAL_SAG (0.07)`. Surplus becomes a standard-size **coil**
torus at the termination when `std − raw > 0.5 ft`. `solveSagScene` / `sagArc` / `curveLen`
remain in the file but are dead (§9.5).

**Catenary sag is not gone forever** — it is correct for an unsupported truss-to-truss swag,
which is exactly what the planned cable-path suite introduces (§9.11).

### 12.3 The floor bound — derive it, don't guess it

A cable must never be drawn through the deck. The obvious guard is "the curve's lowest point is
`midY − h/2`, so require `h ≤ 2·midY`." **That is only true when both endpoints are at the same
height.** For a floor-to-truss home run the minimum sits elsewhere on the curve entirely. This
error shipped twice before a verification pass caught it, with runs still tunnelling to −0.51
scene units after the first "fix".

The exact bound, derived rather than guessed. With the control point dropped by `h` from the
endpoint midpoint, `B(t).y = y0 + 2t(y1−y0) + t²(y0−2y1+y2)` where `y1 = (y0+y2)/2 − h`.
Substituting gives `A = 2h`, `B = (y2−y0) − 2h`; requiring the vertex value `y0 − B²/(4A) ≥ 0`
reduces, using `y0 + d = y2`, to:

> **`h ≤ (√y₀ + √y₂)² / 2`**

For equal-height endpoints this returns `2·midY` — the naïve symmetric answer, so no legitimate
sag is lost. For a run off the deck (`y₀ = 0`) it returns `y₂/2`, putting the curve's minimum
exactly on the floor. Verified numerically over eight endpoint pairs: minimum y = 0.000000 in
every case. **Tight, not conservative** — a proposed `h ≤ midY` would have been safe but halved
sag on every mid-air run.

A related trap: the **per-family draw offset is applied to the endpoints before `cableCurve`
runs**, so a deck-level distro was pushed under the floor before the clamp ever saw it. Both
endpoints are now floored to y ≥ 0 after the offset.

### 12.4 `buildRun` takes an integer target

`buildRun` does an **integer DP** and iterates `for (s = target; s <= cap; s++)`. Handing it a
fractional target (e.g. `need = 5.137`) indexes `dp[]` at non-integers, finds nothing, and
returns `{ok:false, reason:'unreachable'}` — which would have sent every run to `buildJumper`'s
fallback branch and **ordered every cable as a multiple of 100 ft**, catastrophically worse than
the bug being fixed. Caught before the file was written.

`buildJumper` therefore passes `Math.ceil(need)`. This is **exact, not an approximation**: all
stock sizes are integers, so every achievable total is an integer, so the smallest achievable
total ≥ `need` is identical to the smallest ≥ `ceil(need)`. Confirmed by brute force against 56
targets — zero mismatches — and a 1,622-value fractional sweep with zero unreachable results.

### 12.5 Three.js r128 practicalities

- `TubeGeometry` with `tubularSegments = 1` is **not** degenerate — verified valid for straight
  runs.
- `THREE.Sprite` instances **share one static geometry object**. `clearCables()` must skip it
  (`c.type !== 'Sprite'`) or every rebuild disposes global shared state.
- Canvas-texture number badges are cached per number in `_numTex`; disposing the sprite material
  does not dispose the cached texture, which is what you want.
- Marker orientation: for a cone, `setFromUnitVectors(new Vector3(0,1,0), dir)`; for a torus,
  `setFromUnitVectors(new Vector3(0,0,1), dir)`.

### 12.6 Verification harness notes

The suites run real Three.js r128 from CDN in headless Chromium. Two environment traps that
cost time and will recur:

- Chromium's handshake to the session's local proxy fails (`ERR_CONNECTION_RESET` /
  `ERR_CERT_AUTHORITY_INVALID`) even though curl through the same proxy succeeds. Launch with
  `proxy:{server:'direct://'}`, `--no-proxy-server`, `--ignore-certificate-errors`.
- Reading `mesh.position.project(camera)` in the gap between `updateCam()` and the next render
  frame races a stale `matrixWorldInverse`. Force `camera.updateMatrixWorld(true)` before
  reading projected coordinates in test code. Real interaction has no such gap.
- Synthesised pointer events need the target scrolled into view first; the channel-map grids sit
  below the fold on a tall page.

And one methodological note worth keeping. When verifying "every run enters a position from the
same direction," the first metric proposed — the sign of the first chain member's axis
projection — **was the wrong test**: it is centroid-relative, not direction-relative, so a
circuit occupying the far half of a truss reads "inconsistent" while walking the same way as
everything else. The load-bearing metric is the sign of each chain's own walk direction,
`along(last) − along(first)`, which showed 4 of 4 positions inconsistent under greedy ordering
and 0 of 4 under the sweep. **Check that a metric measures what you think before trusting a pass.**
