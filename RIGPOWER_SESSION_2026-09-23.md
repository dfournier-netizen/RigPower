# RIGPOWER session - September 23, 2026

## Scope and isolation

[USER] Scheduled Chunk 6B for 2 AM Eastern: connect path tools to the routing engine, verify a new iteration, and commit it on an isolated branch without pushing or merging.

[AGENT] Working branch: `codex/rigpower-6b-routing`. Worktree: `C:/Users/CDT_LD/.codex/worktrees/rigpower-6b-routing/RigPower`, based on main commit `7dd4d34`. The shared main checkout and other agent branch are untouched.

[AGENT] Independent agents own engine implementation, renderer integration, and browser verification. Implementation patches are applied to a new file; the September 21 baseline is preserved.

## Design decisions

[USER] All cable routing should use paths where possible; disconnected positions retain the existing calculation with explicit fallback indicators. Breaks force terminations; notes are annotations; power/data path permissions apply.

[AGENT] Preserve power/data/home-run cable identity. A physical cable carries a list of typed route legs, including swag, rather than overloading fixture-chain indices with path-leg indices. Forced breaks create separately ordered physical spans.

[AGENT] Shared trunks need an explicitly empty serves field. Clearing the field must remain effective after dragging points.

## Verification and delivery

Final build: `RIGPOWER_2026-09-23_130022.html` (225,116 bytes).
SHA-256 before Git newline normalization: `B75C288A6B36E910B984F99A72C7F9FF87DD3875F7A7F5F1D9A91B09116624A6`.

[AGENT] The overnight attempt stopped on the account usage limit after initial integration checks; the user requested continuation later September 23. The final timestamp records actual file creation at 13:00:22 Eastern.

Verified against the exact final filename:
- Extracted inline JavaScript: `node --check` passes.
- `tests/engine_test.cjs`: 14 focused engine scenarios pass. This suite isolates routing and uses a stub stock builder.
- `tests/verify-routing.cjs`: 24 real-Chrome checks pass with real Three.js r128 and the app's stock solver; zero page exceptions.
- Browser checks cover fresh-page calculation before opening Plot, unchanged no-path ordering/lengths/stock, route bends, reversed feeds, typed paths, T junctions, actual `brk` UI, separately ordered breaks, swag arc/floor, markers, isolation, path-edit callbacks, shared paths, malformed paths, branch fallback, and fallback tint clearing.
- Performance sample: 90 fixtures / nine swags / 180 cable spans / 4,259 meshes: 94.2 ms calculation, 160 ms plot build on this machine. This is a synthetic test, not a guarantee for arbitrarily large graphs.
- Copy to final build and FIFO retirement verified by SHA-256. September 21 baseline preserved. Retired `RIGPOWER_2026-08-24_124341.html` to `_to_delete/`, leaving four active timestamped builds.

## Routing contract and limits

[AGENT] Compatible paths honor power/data/both and their optional serves position. Empty serves means shared; clearing it survives dragging. For each position and cable family, the selected reachable origin and graph-distance ordering are shared across its groups. Route segments retain fixture-chain `ai`/`bi`/`chainLen`; `routeLegs` and `routePoints` describe geometry. Break spans have `breakIndex`/`breakCount`, independent slack and stock rounding, while retaining fixture IDs for selection/isolation.

[AGENT] Explicit vertices within 1 mm join and split straight legs (including T junctions). A geometric crossing without a vertex is not a junction. Fixture/device tails can attach within 1 ft; these tails count toward cable length. Break markers attach within 1 mm. These conservative tolerances are implementation choices, not newly supplied user requirements.

[AGENT] Missing/disconnected paths, fixtures beyond the attachment limit, and branching traversals requiring a return leg fall back to the existing sweep. All fixtures at a position must connect for its family to route; mixed-position circuits also fall back. The report gives reasons, fallback cables are orange, and affected fixtures receive an orange emissive tint without replacing their normal palette or selection highlight.

[AGENT] Swag geometry uses the existing quadratic sag shape sampled at 128 intervals, not a mathematical catenary. The same rig-space points drive length and rendering before or after Plot initialization. The deck is physical z=0; the plot no longer treats the lowest elevated fixture as the deck. The model is a cable-length estimate, not structural rigging analysis.

[AGENT] Home-run parts remain excluded from the jumper parts totals, as before, to avoid double-counting the Cables tab. Routing updates their geometry and measured/ordered length but does not unify the two tally systems. Auto-Cable stock selection still uses its existing stock policy (C/D remain separate work).

## Defects caught during this work

- The notes called the break kind `break`, but the actual UI stores `brk`. The engine accepts both; the browser test now uses the actual selector value.
- Invalid path vertices must reject a path, not be removed and silently joined across the gap.
- A mixed-position power circuit must report fallback even when one of its position plans is routable.
- Path measurement must not depend on whether a renderer transform exists.
- A patch anchor matched both the cable renderer and another helper. Unique-anchor assertions stopped application before any baseline write; the anchor was narrowed and all checks rerun.

## Review and integration

[USER] Commit verified changes to this isolated branch; do not push or merge automatically. The shared main checkout and the other worktree are not modified.

The other branch, `fix/e-persist-cable-settings`, has a locally visible tip `e01a8b1` and its own builds/session log for E (settings persistence), F (footprints), and H (circuit-name assignment). Those features are NOT part of this routing build. Recheck that branch's current tip at integration time.

Because each branch creates a differently named HTML file, a clean Git merge does not combine their application changes. Create one new timestamped combined iteration, port both sets of changes against the common September 21 baseline, and run both branches' verification. Pay attention to path mutation handlers, save/load initialization, shared UI fields, documentation baseline pointers, and duplicate FIFO retirements. Preserve the September 21 baseline until regression/integration checks are complete.

`tools/engine_patch.py` and `tools/render_patch.py` preserve this branch's changes as unique-anchor scripts (engine first). They target the old baseline and must be reviewed before applying to another build. `tests/README.md` documents verification dependencies and commands.

Next work: review this build, integrate E/F/H into one tested iteration, then prioritize remaining C/D stock-source consistency and home-run tally unification. No automatic push or merge has occurred.
