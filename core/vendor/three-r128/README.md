# three.js r128 (vendored)

The core build `three.min.js` and the add-ons the interactive simulations need:
`OrbitControls` and the post-processing / bloom chain. The add-ons are **not** part of
`three.min.js`; three.js ships them separately under `examples/js/`. Pages used to load
`three.min.js` from cdnjs, and the engines fetched the add-ons at runtime from
`https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/`.

They are kept in the repo instead because the platform serves every lesson file under a
strict Content-Security-Policy:

    sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline'; ...

A lesson may therefore load scripts only from its own origin. A request to any CDN is
refused by the browser before it leaves the machine, and the simulation dies with
"The 3D view could not load." GitHub Pages sends no CSP, so the CDN version appears to
work there and fails only in production.

- **Version:** three.js r128 (npm `three@0.128.0`).
- **Source:** add-ons from `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/<path>`,
  downloaded unmodified on 2026-11-06. `three.min.js` from
  `https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js`, downloaded unmodified on
  2026-11-10 (byte-identical to the cdnjs r128 file the pages used before).
- **Load path:** pages load `three.min.js` with a relative `<script>` tag
  (`../core/vendor/three-r128/three.min.js` from `Modules/`,
  `../../core/vendor/three-r128/three.min.js` from `Modules/standalone/`). The engines
  resolve the add-ons from their own script URL
  (`methods/interactive-simulation/<sim>/<sim>.js` → `../../../core/vendor/three-r128/`), so
  they work from any page depth, on GitHub Pages and on the platform. If `THREE` is missing,
  the engines load `three.min.js` from here as well.

Deliberately not included:

- `postprocessing/Pass.js` — `EffectComposer.js` already defines `THREE.Pass` and
  `THREE.FullScreenQuad`.
- `postprocessing/MaskPass.js` — `EffectComposer.js` guards its use with
  `if ( THREE.MaskPass !== undefined )`, and no engine masks.

Upgrading means replacing these files **and** `three.min.js` together: the add-ons are
version-locked to the core build.
