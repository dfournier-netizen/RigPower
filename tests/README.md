# Routing verification

The application has no build step. These optional development checks need Node.js; the browser suite also needs Playwright and Chrome. Set `NODE_PATH` to your installed package directory, or `RIGPOWER_PLAYWRIGHT` to the Playwright package. `RIGPOWER_BROWSER` can select another installed Playwright browser channel.

From the repository root:

```text
node tests/engine_test.cjs <new-build.html>
node tests/verify-routing.cjs <new-build.html> RIGPOWER_2026-09-21_204144.html
```

The engine suite isolates routing functions and uses a stub stock builder. The browser suite loads the real app, Three.js r128, and stock solver, compares no-path output against the preserved baseline, and exercises routing and renderer integration. Network access to the app's CDN dependencies is required. Browser launch may require appropriate local permissions.

For syntax checking, extract the inline application script (the script without a `src` attribute) to a temporary JavaScript file and run `node --check` on it.

`tools/engine_patch.py` and `tools/render_patch.py` preserve the scoped changes as unique-anchor transformations for review and later integration. Apply engine first, renderer second, with distinct input/output files. They target the September 21 baseline; do not blindly apply them to another branch. The other agent's E/F/H changes must be integrated into a single new HTML iteration and tested together.
