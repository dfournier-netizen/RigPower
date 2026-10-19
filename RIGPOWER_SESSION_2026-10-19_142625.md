# RIGPOWER session log — 2026-10-19_142625 (America/New_York)

Branch: `ci/release-workflow` (cut from `main` at `1412b24`). No HTML build changed.

## Standing instructions (carried forward)

- Never overwrite an HTML build; ship changes as `RIGPOWER_YYYY-MM-DD_HHMMSS.html` using the real America/New_York creation time. Max four active iterations, FIFO.
- Build each item on its own branch; never switch branches in the shared `RigPower/` checkout.
- One session log per session; tag every decision [USER] or [AGENT].
- Three.js stays on r128.

## Work

Added `.github/workflows/release.yml`: pushing a `v*` tag selects the newest `RIGPOWER_YYYY-MM-DD_HHMMSS.html`, runs the syntax check, engine, routing and combined suites, then publishes it as `RIGPOWER-<tag>.html` on a GitHub Release. Pull requests that change the workflow run the checks without publishing.

## Decisions

- [USER] Releases trigger on `v*` tags; the release asset is the newest timestamped HTML renamed `RIGPOWER-<tag>.html`.
- [USER] Delivered on its own `ci/release-workflow` branch for Dom to push and PR from Windows.
- [AGENT] All four existing checks gate publishing; browser suites run on the runner's Google Chrome.
- [AGENT] The workflow also runs on PRs that touch it, so the pipeline is proven before the first tag.
- [AGENT] Branch committed in an off-mount clone and pushed into the local repo, so the shared checkout and its HEAD were never touched.

## Verification (this session)

- `main` clean and level with `origin/main` as of last fetch (no credentials here to fetch).
- `RIGPOWER_2026-09-23_222010.html`: inline script `node --check` passes; `tests/engine_test.cjs` 14/14 pass.
- Workflow YAML parses; its selection, syntax and engine steps dry-run cleanly.
- Not run here: `verify-routing.cjs` and `verify-combined.cjs` (sandbox lacks Chrome system libraries). The PR run is their first check.

## Open edges

- `feat/stock-breakouts-homeruns` (`d9ce5f1`) exists only locally; not on GitHub.
- `AGENTS.md` "Current baseline" still says `main` is `7dd4d34` pending review; integration has since merged (`1412b24`). Not changed this session.
