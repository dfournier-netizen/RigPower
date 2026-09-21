# RIGPOWER — Technical Reference & Handoff

> **Merged (July 4, 2026):** RIGPOWER now lives inside **DLux Rackmaster v6.0+** as the
> LIGHTING workspace (shadow-DOM isolated, libs vendored inline). This file remains the
> authoritative reference for the lighting-domain logic; see the Rackmaster project notes
> for the merge architecture. The standalone `RIGPOWER.html` here is frozen at pre-merge.

A single-file, browser-based **lighting power and cable calculator** for live-production
lighting design. It ingests industry-standard rig files (MVR / GDTF), models power
distribution and DMX data, visualizes the rig in 3D, and computes the cable order
(multicables, jumpers, and data cable) needed to build the show.

This document is a complete handoff. It describes what the tool does, how it is built,
the domain reasoning behind each feature, and every hard-won implementation detail — so
the software can be understood, extended, or **merged into another codebase** without
re-deriving the lighting-industry logic from scratch.

---

## 1. What it is, in one paragraph

RIGPOWER is a self-contained `RIGPOWER.html` file (~126 KB, no build step, no server, no
install — double-click to run in any modern browser). It is aimed at a professional
lighting designer/programmer's real workflow: import the rig that was drawn in
Vectorworks, confirm fixture wattages, lay out power distribution across SOCAPex and
L21-30 multicables, balance the electrical phases, patch DMX universes, and generate the
actual cable pick list (including jumpers between fixtures and data runs) based on true
3D distances. It intentionally avoids external dependencies beyond two CDN libraries
(JSZip for reading the zip-based rig files, Three.js for the 3D plot).

---

## 2. Intended user & domain context

The user is a **professional lighting programmer/designer** working primarily with
**grandMA3** consoles and **Vectorworks Spotlight**. This tool is meant to be used during
pre-production and load-in. The user is a domain expert; the tool encodes their
conventions rather than teaching them the craft.

Key domain concepts the tool models (important for anyone extending it):

- **Fixture**: a lighting instrument (moving light, LED wash, strobe, etc.). Each fixture
  type has a **wattage** (power draw) and a **DMX footprint** (how many control channels
  it occupies), which depend on the fixture's selected **DMX mode**.
- **Position**: a physical location in the rig where fixtures hang (e.g. "SR Truss",
  "SL Pillars", "LX1"). Fixtures are grouped by position.
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

These are the crux of the tool and the least obvious part of the domain. All findings
below were verified against real files exported from Vectorworks 31.5 (grandMA3-compatible).

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
fields into the MVR on export. This is why the **CSV bridge** (section 7) exists.

---

## 4. Architecture & tech stack

- **Single self-contained HTML file.** All CSS and JS inline. No bundler, no framework.
- **Dependencies (CDN only):**
  - `JSZip 3.10.1` — unzipping MVR/GDTF archives in the browser.
  - `Three.js r128` — the 3D plot. (Note: r128 has no bundled `OrbitControls`; the tool
    hand-rolls spherical-coordinate orbit. Avoid r142+-only geometries.)
- **UI:** industrial dark theme, "Archivo" + "Spline Sans Mono" fonts, amber accent, with
  X/Y/Z leg colors blue/green/yellow. Console-inspired, high-contrast, legible under load-in
  lighting conditions.
- **No browser storage APIs** (localStorage/sessionStorage are not used and are, in fact,
  unavailable in the artifact sandbox). All state is in-memory; persistence is via
  explicit JSON **Save/Load** and CSV export.
- **Rendering model:** plain DOM construction via a small `$`/`$$` helper. Each tab has a
  `renderX()` function. The tab dispatcher wraps renders in try/catch so a single bad
  record can never blank a tab (it shows an error toast instead). `renderCalc` additionally
  uses a **generation token** to cancel stale async refreshes and **self-heals** missing
  stock-length keys.

### 4.1 In-memory state shape
```js
let state = {
  fixtures: [],   // {id,name,mode,watts,count,footprint,manual,_profile,_stub}
  positions: [],  // {id,name,tag,collapsed,multis:[]}
  instances: [],  // one per physical fixture in 3D (see below)
  devices: [],    // {id,kind,name,x,y,z,placed,outputs,inputs,voltage}
};
// Non-state globals persisted alongside it:
let stockLengths = { SOCA:[5,15,25,50,100], L2130:[5,10,15,25,50,100],
                     DMX:[5,10,25,50,100], Ethernet:[5,10,25,50,100] };
```

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
             circuit, userField1, // from CSV bridge (null until imported)
             assigned:            // links a physical fixture to a power circuit:
               { positionId, multiId, circuitIndex } | null }
```

The **fixtures[]** array is the *type library* (one row per fixture model, carries
wattage/footprint/mode). The **instances[]** array is *every physical unit* (carries 3D
position and patch). A circuit's `slots` reference fixtures by name and aggregate by
quantity — this is the power-math model. `instance.assigned` is the bridge from a physical
unit in the 3D plot to a specific power circuit.

---

## 5. Feature-by-feature reference

Tabs: **Import · Fixtures · Power Calc · 3D Plot · Summary · Cables · Patch · Auto-Cable · Devices.**

### 5.1 Import
- Drag/drop `.mvr` and `.gdtf` files (and a separate `.csv` dropzone — section 7).
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

### 5.4 3D Plot (Three.js)
- Renders every instance from real MVR coordinates (mm, Z-up → mapped to a centered,
  Y-up scene scaled to ~10 units). Floor fixtures sit at ground, trusses elevated.
- **View presets:** Perspective / Top / Front; drag-orbit, scroll-zoom, Fit.
- **Color modes:** by Leg (X/Y/Z once assigned) / by Position / by Type, with a legend.
- **Click a fixture** → info panel to assign it to a Position → Multi → Circuit (writes into
  that circuit's slots). **Shift/Ctrl-click** for multi-select and bulk assign.
- **Devices** (distros/nodes/splitters) render as distinct boxes.
- Click-vs-drag is distinguished by straight-line distance from mousedown (>6px = drag);
  selection fires on mouseup for reliable modifier capture.

### 5.5 Summary + Auto-Balance
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

### 5.6 Cables
- **Editable stock lengths** per type (SOCAPex / L21-30 / DMX / Ethernet).
- Per multi: home run → **build** (e.g. `150′ → 100′ + 50′`), the breakout, and the data
  builds.
- **Cable-build solver** (`buildRun`): given a target length and stock sizes, find the
  build with **least overage first, then fewest cables**. Round *up* to ≥ target.
  Examples: `150′ → 100′+50′` (exact), `75′ → 50′+25′` (exact, beats one wasteful 100′),
  `160′ → 100′+50′+…` to the least-overage exact/near-exact combination. Implemented as a
  DP over achievable sums up to `target + maxStock`.
- Aggregated **cable-part totals** by type & length, and **breakout totals**.

### 5.7 Patch (DMX-512)
- Auto-populates universe/address from the MVR on import (absolute-address decode).
- **Auto-patch**: packs fixtures by Position → Type into universes, sequential addresses,
  respecting each fixture's footprint, never overlapping, rolling to the next universe when
  one fills. Warns before overwriting imported/manual addresses.
- Manual override on every universe/address; **overlap** and **>512** warnings; a
  per-universe channel-usage map. Columns include FID and (from CSV) Circuit.

### 5.8 Auto-Cable (jumpers + data)
The "auto cable" goal: from the 3D layout, compute the jumper and data cabling.
- **Power jumpers** (True1 or PowerCon): fixtures on the **same circuit** (same
  position+multi+circuit) are chained together.
- **Data jumpers** (DMX or Cat5e): fixtures on the **same universe** are chained.
- **No loops.** Per group, order fixtures into an **open chain** starting from the fixture
  nearest the home-run origin, then nearest-neighbor to the far end.
- **Home-run origin** = the nearest **placed device** (from the Devices tab); falls back to
  the rig centroid at floor level with a note if no device is placed.
- Each gap's true 3D distance is rounded up to the nearest stock length with **+10% overage
  or +1 ft minimum** (`roundUpStd`). Results shown as part-count tables per type & length.

### 5.9 Devices
- Add **Power Distro** (configurable multi outputs + voltage), **DMX Node**, **DMX
  Splitter** (configurable input/output ports).
- Place via X/Y/Z (entered in feet, stored in mm). Placed devices anchor cable home-runs
  and appear in the 3D plot.

---

## 6. Cable / power constants (as delivered)

```
SOCA legs (circuit 1..6):   X Y Z X Y Z
L21-30 legs (circuit 1..3): X Y Z
Slots per circuit:          4
Default stock (ft):
  SOCAPex   5, 15, 25, 50, 100
  L21-30    5, 10, 15, 25, 50, 100
  DMX       5, 10, 25, 50, 100
  Ethernet  5, 10, 25, 50, 100
Jumper standard lengths:    5, 10, 15, 25, 50, 100
SOCA breakouts:   SOCA→True1, SOCA→PowerCon, SOCA→Edison, SOCA→Edison Breadbox
L21-30 breakouts: Edison Breadbox (110v), Twistlock Breadbox (208v), True1 Fanout (120v)
```

---

## 7. CSV bridge (circuit / mode / footprint import)

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
  (e.g. `Mode 1 / 32`, `56Ch Mode / 56`, `32ch`). `parseUserFieldModeFootprint()` extracts
  both from such strings.
- **Not yet built:** circuit data is stored/displayed but does not yet *auto-assign*
  fixtures to SOCA circuits based on the imported circuit name. Mapping the user's circuit
  naming convention onto the multi/circuit structure is the natural next step, once real
  circuit-value formats are known.

---

## 8. Persistence & export

- **Save/Load project**: full `state` plus `stockLengths` (as `_stock`) to/from a JSON
  file. Load **merges** stock onto defaults (so older projects self-heal missing keys) and
  back-fills `instances`/`devices` arrays.
- **CSV export**: power-by-position, fixtures, multicables (with builds + data), and cable
  part totals.

---

## 9. Known limitations & natural next steps

Carry these forward — they are the honest edges of the current build:

1. **Circuit-driven patching not wired.** CSV circuit values are stored/shown but don't yet
   auto-assign fixtures to SOCA circuits. Needs a parser for the user's circuit-naming
   convention (e.g. `L1-7`, `SOCA 2.3`) mapped onto position→multi→circuit.
2. **Home-run lengths vs. multicable lengths.** Auto-cable computes home-run distances
   internally but only tallies *jumper* parts, to avoid double-counting with the Cables
   tab's multicable home runs. Unifying these is a clean follow-up.
3. **Adapters/breakout counts** are modeled in dropdowns but the auto-cable tables count
   cable, not adapter quantities (e.g. a 2-fer when fixtures share a drop).
4. **Multi-break fixtures**: only the first `<Address break>` is read.
5. **Real fixture models in 3D**: fixtures are spheres; MVR bundles `.glb` geometry that
   could be rendered.
6. **Box/rubber-band select** in 3D isn't implemented (modifier-click only).
7. **Nearest-neighbor jumper chains** are optimal for fixtures in a row (the common truss
   case) but not a guaranteed shortest path for scattered layouts.
8. **Devices** carry port configs but aren't yet *wired* to fixtures/circuits for full
   end-to-end routing.
9. **Instance-per-slot identity**: a circuit slot aggregates by fixture type + qty (correct
   for power math) rather than tracking each individual physical unit within a slot.

---

## 10. Notes for merging into another codebase

If lifting logic out of the single file, the cleanly-separable, dependency-light pieces are:

- **MVR/GDTF parsing** (`parseMVR`, `parseGDTFBlob`, `buildGeomIndex`, `modePower`,
  `resolvePower`, `resolveFootprint`, `parseMatrixOrigin`, `extractFixtureField`,
  `parseUserFieldModeFootprint`). Pure except for JSZip + DOMParser. This is the highest-
  value, hardest-to-rederive code — the geometry-reference power walk and the stub/refine
  logic especially.
- **Cable-build solver** (`buildRun`) and **jumper math** (`roundUpStd`, `chainOrder`,
  `groupCables`, `computeAutoCable`) — pure functions, no DOM.
- **Phase balancer** (`balanceMulti`, `rebalanceAll`) — pure except it mutates `state`.
- **Auto-patch** (`autoPatch`) and **address decode** — pure logic.
- **CSV bridge** (`parseCSVText`, `autoDetectCols`, `buildMergePlan`, `applyCSVPlan`).

Coupling to watch for when merging:
- Everything reads/writes the module-global **`state`** object and **`stockLengths`**;
  a merge should either keep that shape or introduce an adapter layer.
- Rendering is DOM-string based and tab-scoped; the compute functions are cleanly separable
  from the `renderX()` functions.
- Leg/phase naming is **X/Y/Z** throughout (the user's convention) — map to L1/L2/L3 if the
  other system uses that.
- Units: 3D coordinates are **millimeters** internally (from MVR); the UI converts to feet
  for display (÷304.8). Cable lengths are in **feet**.
- Fixture identity is **by name** across the library and circuit slots; instances reference
  fixtures by `type` (the name). Keep names stable or introduce IDs when merging.

---

## 11. Provenance / development notes

- Built iteratively with real-hardware/real-file validation. All parsing claims above were
  verified against actual Vectorworks 31.5 MVR exports and standalone manufacturer GDTFs
  (Elation KL Fresnel, Martin ERA 800, Chauvet Rogue Outcast 2X Wash, Chroma-Q Color Force
  II 48, GLP JDC1).
- The two sample MVRs differed: one 64-fixture rig, one 44-fixture rig; the latter carried
  one genuine (non-stub) Elation GDTF, confirming the refine path.
- Neither sample MVR contained circuit or user-field data — the exhaustive tag/attribute
  inventory that motivated the CSV bridge is documented in section 3.4.
- Deliverable filename: **`RIGPOWER.html`**.
