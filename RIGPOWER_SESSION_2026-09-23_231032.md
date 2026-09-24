# RIGPOWER — Session Log · 2026-09-23_231032 (C/D + I: stock tables, breakouts, measured home runs)

Branch `feat/stock-breakouts-homeruns`, cut from `main` @ `1412b24` (both PRs merged), worktree `RigPower-wt-stock-breakouts-homeruns`.
Build: `RIGPOWER_2026-09-23_231032.html` (from `RIGPOWER_2026-09-23_222010.html`). FIFO: `RIGPOWER_2026-09-22_220732.html` → `_to_delete/`.

## 0. Standing instructions (carried forward)

Never overwrite a build; real America/New_York timestamp at creation; max 4 active iterations, FIFO to `_to_delete/`; no Edit tool on existing files — scripted unique-anchor splices, byte-verified; surgical changes; defer decisions to Dom; one log per session with **[USER]/[AGENT]** tags. **Git (Dom, Sept 23):** every new item on its own local branch in its own worktree; check Git, not the folder, for the current build; remove the Cowork-VM worktree when the item is done so the branch can be checked out on Windows.

## 1. Decisions

| Decision | Who | Detail |
|---|---|---|
| Take the next items: C/D and I | **[USER]** | |
| One shared power-jumper table for True1 and PowerCon | **[USER]** | New `stockLengths.Power`, editable on the Cables tab, default 5/10/15/25/50/100 (the old `JUMPER_STD`). |
| Add 15′ to the DMX and Ethernet defaults | **[USER]** | Defaults only. A saved project keeps its own tables. |
| Data select picks the stock: DMX → DMX table, Cat5e → Ethernet table | **[USER]** | Closes D: the selects are no longer cosmetic. |
| Home-run origins by device kind | **[USER]** | Data runs start at the nearest DMX node/splitter; power runs at the multi's breakout. |
| Power model: distro → multi (SOCA/L21-30) → **breakout** at the multi's end → True1/PowerCon runs to fixtures | **[USER]** | Dom: "the breakout lives at the end of the SOCA or L21-30. Multis have separate home runs … Multis start at power distros, and true1/powercon runs start at breakouts." |
| Breakout is a new placeable device tied to one multi | **[USER]** | Devices tab → ＋ Breakout → *Feeds multi*. Draggable in 3D like the other devices. |
| Multi length measured distro → breakout, replacing the typed home run | **[USER]** | |
| Measured data home runs replace the typed column **everywhere**, following the Data select | **[USER]** | DMX → typed DMX ignored; Cat5e → typed Ethernet ignored. The other column stays typed. |
| All of it in one chunk | **[USER]** | |
| No breakout placed → power runs fall back to the nearest distro (else rig centre), flagged, and those tails are **not** tallied | **[AGENT]** | A distro → fixture run isn't a real cable in Dom's model (it's multi + tail), so counting it would invent parts. The Auto-Cable tab lists each multi missing a breakout. |
| No node/splitter placed → data runs measured from the rig centre, flagged, **still tallied** | **[AGENT]** | The typed column is gone, so something has to be ordered; the warning says it's an estimate. |
| Multi measured along power-carrying paths when both distro and breakout attach (≤1 ft) and connect, else straight 3D line; slack applied, then built from SOCA/L21-30 stock | **[AGENT]** | Reuses 6B's `routeGraph`/`routeLink`. Break markers on the route are summed into one run. The multi still only counts when a breakout *type* is set (existing rule). No distro placed → typed length kept and marked. |
| Each cable counted exactly once | **[AGENT]** | Multis and the non-selected typed data column → Cables tab parts. Power jumpers, breakout tails, data jumpers and measured data home runs → Auto-Cable parts. CSV export now carries both, in an *AUTO-CABLE PARTS* section. |

## 2. What changed (build `RIGPOWER_2026-09-23_231032.html`)

- **Stock:** `stockLengths.Power` added. DMX/Ethernet defaults gain 15. `buildJumper` uses `_jumperSizes` when no table is passed; `computeAutoCable` sets it per family via `jumperStockFor()` and resets it before returning. `JUMPER_STD` is now only the last-resort fallback.
- **Origins:** `placedDevices`, `powerOriginSet(multiId)`, `dataOriginSet()`. `homerunOrigin`, `routePlan` and `groupCables` take an optional origin set (routePlan's cache key includes it). Without one, behaviour is exactly as before.
- **Breakout device:** `addDevice('breakout')` (`multiId`), Devices-tab panel with *Feeds multi*, yellow box in 3D (`0xf0c64a`).
- **Multis:** `measureMultiRuns()`. The Cables tab shows "measured" (with a "straight" flag when no path connects). Multis are drawn in the home-run layer as `homerun-multi` segments, labelled "Multi (distro to breakout)". They're added after the routing-status pass so they never count as a position's routing result.
- **Tally:** breakout tails → `jumperParts`; data home runs → `dataParts`. The Cables tab ignores the typed column the measured runs replace and shows the measured list on each position's first multi row. The CSV export mirrors this and adds the Auto-Cable parts.
- **Auto-Cable tab:** new *Cable Origins* box listing missing-breakout / missing-node warnings.

## 3. Verification (this session, headless Chromium, on the final file)

`node --check` OK. All four repo suites pass on `RIGPOWER_2026-09-23_231032.html`:
- `engine_test.cjs`: 14/14.
- `verify-combined.cjs`: 15/15 (E/F/H unchanged).
- `verify-routing.cjs`: 24/24.
- New `verify-stock-origins.cjs`: 20/20.

The new suite covers:
- power jumpers drawn only from the Power table; DMX from the DMX table; Cat5e from the Ethernet table; the stock override reset after each run;
- data runs starting at the node; the no-breakout fallback flagged and uncounted; breakout-origin runs, with their tails added to the jumper count exactly;
- the multi measured as a straight line, and along a connecting power path;
- the Cables tab's measured multi, and which typed data column is dropped for DMX vs Cat5e;
- CSV export sections; Devices-tab add/link/place; the 3D multi and breakout meshes;
- save/load of the breakout and Power table, and an older project keeping its own DMX table while gaining the Power default; zero page errors.

**Test changes, and why [AGENT]:** with kind-matched origins, the old rigs' single distro can no longer feed data runs. The routing and engine rigs now place a DMX node beside the distro; with that, every pre-existing assertion passes unchanged. That shows the routing engine didn't move. The one intended difference is the routing suite's 6A comparison: it now expects `dataParts` = baseline + exactly the measured data home-run pieces, and the previous build fails that check, so it really tests the change. The engine harness also stubs `jumperStockFor`, which sits outside the slice it loads.

**Found during verification:** `device_commit_files` wrote a stale copy of the new test file (an earlier header). The byte check caught it and it was fixed in place; md5 `b4e11a0d…` verified.

## 4. Limitations / notes

- **Existing projects will order differently once reopened.** Data runs no longer start at a distro, and typed DMX (or Ethernet) lengths are ignored. Place nodes/splitters and breakouts to get real numbers; until then the Auto-Cable tab lists what's missing.
- One breakout per multi (first placed wins). A breakout isn't tied to a circuit subset.
- Breakouts don't snap to the multi's position; place them where the multi ends.
- `homerun-multi` segments carry no `aId`/`bId` (same as K); isolate hides them.
- `#uniSize`, `#jumperType`, `#dataType` are still not saved with the project (from E).

## 5. Next

G (two-row sweep return leg, now touching sweep and router), J (dead code), K (`segments[]` uniformity, now including `homerun-multi`), and a real-CSV acceptance check for H. Also Dom's open slack-default call (handoff §8).
