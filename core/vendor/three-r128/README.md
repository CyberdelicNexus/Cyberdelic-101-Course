# three.js r128 add-ons (vendored)

The interactive simulations need `OrbitControls` and the post-processing / bloom chain.
These are **not** part of the minified core build (`three.min.js`) — three.js ships them
separately under `examples/js/`. The engines used to fetch them at runtime from
`https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/`.

They are kept in the repo instead because the platform serves every lesson file under a
strict Content-Security-Policy:

    sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; ...

A lesson may therefore load scripts only from its own origin. A request to any CDN is
refused by the browser before it leaves the machine, and the simulation dies with
"The 3D view could not load." GitHub Pages sends no CSP, so the CDN version appears to
work there and fails only in production.

- **Version:** three.js r128 (npm `three@0.128.0`), matching the `three.min.js` that the
  standalone pages load.
- **Source:** `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/<path>`, downloaded
  unmodified on 2026-11-06.
- **Load path:** the engines resolve these against the standalone page that loads them, as
  `../../core/vendor/three-r128/<path>`, which works both on GitHub Pages and on the
  platform.

Deliberately not included:

- `postprocessing/Pass.js` — `EffectComposer.js` already defines `THREE.Pass` and
  `THREE.FullScreenQuad`.
- `postprocessing/MaskPass.js` — `EffectComposer.js` guards its use with
  `if ( THREE.MaskPass !== undefined )`, and no engine masks.

Upgrading means replacing these files **and** `three.min.js` together: the add-ons are
version-locked to the core build.
