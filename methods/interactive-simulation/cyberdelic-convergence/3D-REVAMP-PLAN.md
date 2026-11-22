# Cyberdelic Convergence: 3D Revamp (plain three.js)

## 1. How it works today

### Files

| File | Role |
|---|---|
| `cyberdelic-data.js` | All content. We keep this file as-is. |
| `cyberdelic-convergence.js` | Rendering and interaction (SVG). This is the file we replace. |
| `cyberdelic-convergence.css` | Node, glow, tutorial, and help styling |
| `Modules/standalone/cyberdelic-convergence.html` | The standalone embed. It already loads three.js r128. |
| `interactive-simulation.js` | Shared host. It runs the animation loop, provides the year slider (from the engine's `config`), and calls the engine's lifecycle methods. |

### Data model (what any new visual has to show)

- **6 domains:** Psychedelic Research, VR/AR Tech, Neuroscience, Contemplative Practices, Gaming, Digital Art. (Colors: see "Brand style" below.)
- **Timeline:** 2015 → 2025. Each connection fades in from its `yearAppears` and gets stronger year by year.
- **Content snapshots:** each domain has 4 snapshots (for example, Psychedelic has 2015, 2018, 2021, 2024). The viewer shows the latest snapshot at or before the current year.

### Current visuals and interactions

| Element | How it's drawn now |
|---|---|
| Domains | SVG circles on a flat ring of radius 300, placed by `angle` |
| Connections | Lines (or arcs for opposite domains). Width and opacity grow with strength. |
| Center "CYBERDELICS" node | A circle that grows from radius 15 to 70 as the year moves 2015 → 2025 |
| Particles | Dots that travel from a domain to the center along active connections (every 150 ms). The DOM is rebuilt every frame, which is slow. |
| Click a domain | The SVG viewBox zooms in, other nodes fade, and 4 boxes appear around the node: Contributions, Key People, Technologies, Examples (with links) |
| Year slider / keys | Changes strength, center size, and the content snapshot |
| Tutorial + help | 3-step spotlight tour that targets CSS selectors such as `.domain-node[data-id="psychedelic"]` |

**The core message:** six separate fields gradually connect and fuse into a new discipline. Every concept below tells that same story in 3D.

## 2. How plain three.js fits in (no project changes)

The new engine keeps the same registration and lifecycle, so the manifest (`engine: "CyberdelicConvergence"`), the standalone page, the slider, and the course player keep working unchanged.

```js
window.SimulationEngines['CyberdelicConvergence'] = {
  config: [{ id: 'year', min: 2015, max: 2025, step: 1 }], // host slider unchanged
  init(container, params)   { /* WebGLRenderer, Scene, Camera, build from CyberdelicData */ },
  update(dt, params)        { /* year → strengths, core size, particles, camera tween */ },
  resize(w, h)              { /* renderer.setSize + camera.aspect */ },
  destroy()                 { /* dispose geometries/materials, remove canvas */ }
};
```

Main technical pieces:

- **Glow:** `EffectComposer` + `UnrealBloomPass`. The r128 versions load from the same CDN as plain `<script>` tags, so there's still no build step.
- **Particles:** one `THREE.Points` buffer (thousands of particles cost roughly the same as one), replacing the per-frame SVG rebuild.
- **Clicking:** a `Raycaster` detects which domain mesh was clicked.
- **Content boxes:** move them from SVG text into an HTML overlay panel (glass card) next to the zoomed node. Text gets sharper, scrolling and links work, it's accessible, and it reuses the glassmorphism style.
- **Tutorial:** give each node an invisible DOM "anchor" positioned over its 3D location every frame, keeping the `data-id` attributes, so the existing spotlight selectors keep working.
- **Performance:** a reduced-motion / low-power mode (fewer particles, no bloom) for phones and `prefers-reduced-motion`.

## 3. The visual concepts in detail

### Concept 1: Convergence Nebula ("the current design, in 3D")

**Idea:** the same ring layout, rebuilt as a living star system you can orbit.

| Data | 3D visual |
|---|---|
| Domains | Glowing orbs with an inner shader "plasma" in the domain color, each with a faint halo ring. Placed on a tilted ring using `angle`, with a slight vertical offset so it reads as 3D. |
| Connections | Curved light-tubes (`TubeGeometry` along a bezier) between domains. Thickness and brightness follow strength. Connections not yet active (before `yearAppears`) are invisible. |
| Center node | A pulsing core (an icosahedron with a wireframe shell) that grows and brightens with the year. At 2025 it flares into a bloom burst. |
| Particles | Streams flowing along each active tube toward the core, with density based on strength, so you can see energy flowing in from each field. |
| Year slider | Orbs drift slightly inward, the ring rotates slowly, and the backdrop nebula moves from cold blue toward warm violet. |
| Click a domain | The camera flies to the orb (a smooth tween), the other orbs dim and blur, and the glass content panel slides in. Clicking empty space flies back. |

- **Pros:** closest to today's layout, so the tutorial, mental model, and lesson text all still fit. Lowest risk. Strongest "wow" for the effort.
- **Cons:** the least novel of the four.
- **Effort:** low–medium.

### Concept 2: Timeline Tunnel ("traveling through time")

**Idea:** time becomes physical depth. The camera flies forward through a tunnel from 2015 to 2025.

| Data | 3D visual |
|---|---|
| Domains | 6 colored "lanes" (light ribbons) running along the tunnel wall, one per domain, spaced around the circle by `angle` |
| Year | Z-position. Year rings (glowing hoops labeled 2015…2025) pass by as you move. The slider and scroll move the camera. |
| Connections | Where a connection appears, a bridge of light jumps between two lanes at that year's depth, and it gets thicker deeper in |
| Convergence | The tunnel narrows over time, so the lanes physically spiral together and merge into one bright beam at 2025 |
| Content snapshots | Floating milestone cards hang on each lane at their snapshot years (e.g. Psychedelic: 2015, 2018, 2021, 2024). Flying past one highlights it, and clicking opens the full panel. |

- **Pros:** the most cinematic. The year is the main interaction instead of a side slider. It shows *when* things happened better than any other concept.
- **Cons:** you can't see all 6 domains side by side at a glance. The 3-step tutorial needs rewriting. It changes the lesson's mental model more than the others.
- **Effort:** medium–high.

### Concept 3: Mycelial Network ("the people and projects")

**Idea:** use the content inside the data. The people, technologies, and examples become visible nodes in a growing network.

| Data | 3D visual |
|---|---|
| Domains | Large cluster cores |
| keyPeople / technologies / examples | Small satellite nodes around their domain (different shapes per type: spheres for people, cubes for tech, diamonds for examples). New ones grow in when their snapshot year arrives. |
| Connections | Glowing, slightly organic filaments (mycelium threads) that grow between clusters over the years. Strength sets thread count and brightness. |
| Convergence | A force layout pulls clusters together as cross-domain links strengthen, so by 2025 the network has knitted into one organism |
| Click | Clicking a domain core zooms in and opens the panel. Clicking a satellite shows that one person or project, and its URL opens directly. |

- **Pros:** the richest exploration. It shows the actual people and projects instead of hiding them in boxes, and fits the "living ecosystem" theme.
- **Cons:** the busiest scene (dozens of labeled nodes) and the hardest to keep readable on mobile. It needs a small force-layout routine.
- **Effort:** high.

### Concept 4: Sacred-Geometry Mandala ("the symbolic one")

**Idea:** convergence shown as geometry completing itself.

| Data | 3D visual |
|---|---|
| Domains | 6 vertices of a slowly rotating hexagonal or Metatron's-cube structure, each glowing in its color |
| Connections | The structure's edges light up as connections appear. Strength sets edge brightness and an iridescent shader fill on the faces between them. |
| Convergence | As more edges activate, the open lattice closes into a complete form. At 2025 the whole figure is lit and slowly "breathes." |
| Click | The figure rotates so the clicked vertex faces you, and the panel opens |

- **Pros:** the strongest brand and identity match with the cyberdelic aesthetic. Calm and meditative, and light on performance.
- **Cons:** the most abstract. The timeline story ("which fields connected when") is less obvious, and labels can get crowded.
- **Effort:** medium.

## 4. Side-by-side

| | Nebula | Tunnel | Mycelial | Mandala |
|---|---|---|---|---|
| Keeps current mental model | ✅ | ⚠️ | ✅ | ⚠️ |
| Shows the timeline well | ✅ | ✅✅ | ✅ | ⚠️ |
| Shows the people and projects | panel | cards | ✅✅ | panel |
| Wow factor | ✅ | ✅✅ | ✅ | ✅ |
| Mobile-friendly | ✅ | ✅ | ⚠️ | ✅ |
| Existing tutorial still fits | ✅ (minor tweaks) | ❌ rewrite | ⚠️ | ⚠️ |
| Effort | Low–Med | Med–High | High | Med |

## 5. Recommendation

Start with **Concept 1 (Nebula)** as the base engine. It reuses all the data, the slider, the click-to-zoom flow, and the tutorial. Its building blocks (renderer, bloom, particle streams, camera tweens, HTML panel) are the same foundation the other concepts would need. Elements from the others can be layered on later, for example:

- the Mandala's sacred geometry as the center core,
- the Mycelial satellites appearing around a domain only when it's zoomed in.

### Build plan

1. Create a new engine `CyberdelicConvergence3D` and a new page `Modules/standalone/cyberdelic-convergence-3d.html`. The current version stays untouched and live.
2. Compare both side by side in `simulation-lab.html`.
3. When you're happy with it, switch the manifest engine (or replace the old file) in one small commit.

## 6. Brand style (added Nov 2026)

The 2D engine was restyled to match the Cyberdelic Nexus core site design system
(`github.com/CyberdelicNexus/cyberdelic-nexus-core`, `.claude/skills/cyberdelic-design`). The 3D build should follow the same rules:

- **Domain colors** (now in `cyberdelic-data.js`): Psychedelic `#B49BF8` (violet), VR/AR `#4CDCEF` (cyan), Neuroscience `#E562A4` (magenta), Contemplative `#DDB049` (Academy amber), Gaming `#5FDFA6` (green), Digital Art `#B964F5` (orchid).
- **Ground:** near-black void with three blurred "blob" lights (violet top-left, magenta bottom-right, blue bottom). Dark-only; no light theme. Fits the nebula backdrop.
- **Glow is inner radiance, not a drop shadow.** Saturated color lives at rims, edges and blooms; centers stay dark (obsidian plates). Avoid candy-bright solid fills. Keep bloom subtle.
- **Center:** the site's NodeHub look: a black core inside a lit ring (brand gradient cyan → violet → magenta) on a horizontal "accretion streak" of light.
- **Panels:** glass (`rgba(255,255,255,0.045)` fill, 11% white hairline border, `blur(22px) saturate(155%)`), 22 px radius, an aura bloom rising from one edge, uppercase eyebrow titles (0.18em tracking), 64×3 px gradient underbar.
- **Type:** Poppins for UI, JetBrains Mono for keys/data, Cloudsters (`fonts/Cloudsters-Regular.ttf`) for big numerals like the year. Sentence case; no emoji.
- **Motion:** two speeds only. Interface 150–700 ms with `cubic-bezier(.16,1,.3,1)` for arrivals; ambient loops in tens of seconds. No bounce or overshoot. Entrances fade + rise. Honor `prefers-reduced-motion`.
- **Focus:** 2 px cyan ring, 2 px offset. Controls are pills with a 44 px minimum touch target.
