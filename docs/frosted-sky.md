# Frosted sky / name aperture

The home hero is one pane of strongly frosted glass, with `XI ZHANG` acting as a clear aperture into a shared, moving sky. The previous valley scene is no longer rendered or requested. Interior sections and the project experience retain their existing behavior.

- `components/Hero.tsx`: accessible heading, compact introduction and working project/contact links. The name stacks on narrow screens.
- `components/HeroAtmosphere.tsx`: local clock, bilingual phase/weather preview, reduced-motion preference, keyboard focus and visibility management.
- `lib/renderHeroScene.ts`: photographed cloud drift, continuous sky palettes, night stars, two-pass low-resolution frost blur, a DOM-aligned text mask, and an instanced droplet-normal pass with water IOR 1.333 and Schlick Fresnel. Droplets refract the pane, reflect light, merge with conserved volume/momentum and slide under gravity. Fading wet trails and fine condensation survive weather changes.
- `lib/glassPhysics.ts`: a shared signed-distance aperture field, contact-line water particles and float-precision wet-trail history.
- `lib/sceneEnvironment.ts`: deterministic atmospheric weather and all six local-time phases. It does not request location or claim to provide a real forecast.
- `public/scene/glass-clouds-v1.webp`: 1536 x 1024 alpha cloud plate (about 300 KB). Exact built-in imagegen prompt and source are in `docs/glass-sky-assets.json`.

The renderer caps pixel ratio at 1.5 on phones / 1.25 elsewhere and animation at 30 FPS. It pauses when hidden or off screen. Reduced motion draws a still frame but keeps phase/weather controls working. Canvas 2D is used when WebGL is unavailable; a CSS name/sky fallback remains readable during GPU context loss. Cloud-image failure keeps the sky gradient and name aperture.

## Verification

```powershell
npm run build
npm run test:scene
# Serve the exported build from the repo root, in a separate terminal:
python -m http.server 4240 --bind 127.0.0.1 --directory out
$env:FLUX_PLAYWRIGHT_MODULE='C:\Project\Self-development\.browser-tools\node_modules\playwright\index.mjs'
$env:PORTFOLIO_TEST_URL='http://127.0.0.1:4240'
node tests/scene-browser.mjs
```

Browser coverage includes six palettes, old-asset exclusion, actual aperture alignment after desktop/phone resizing, scrolling and bilingual content reflow, moving clouds, dew and rain, droplet coalescence, persistent wetness, hidden/offscreen pause, reduced motion, bilingual controls, real links, GPU restoration, Canvas fallback and cloud-asset failure. Review captures go to ignored `artifacts/`.


## Recessed, warped aperture and contact water

The front glass stays flat. Thickness, directional wall light and occlusion appear only inside the name aperture. Two narrow, horizontal crease bands use piecewise-linear offsets shared by the whole text row. The three letter bands keep their normal outlines; the offset silhouette is baked once into the alpha mask with bilinear sampling; its same silhouette builds a 1 CSS-pixel signed-distance field. GPU walls, droplet clipping and CPU collisions therefore use one geometry, including the letters' counters. The mask follows scrolling, language reflow, font loading and viewport resizing.

Water has four states: attached to glass, pinned on the frame, falling inside the cavity, and free falling in front after leaving the lower sill. Gravity projects onto a frame tangent; contact-line retention holds small drops, while larger/merged drops stretch and detach. Cavity water can land on the lower frame. A detached drop no longer draws a glass-clearing trail. Coalescence conserves cubic-radius volume and momentum, and skips droplets separated by the cutout or a glass web. The integration step is at most 1/120 s to avoid tunnelling through thin strokes.

Wet traces use a persistent Float32 history, converted to 8-bit only for display. Exponential decay is evaluated from that float state, so slow evaporation does not get stuck in repeated 8-bit rounding. Resize explicitly clears the history. This is a bounded contact-line approximation in CSS pixels, with a fixed 96-droplet budget.

`npm run test:scene` now includes contact physics and wet-trace decay. `tests/window-contact-browser.mjs` finds the actual warped letter mask and runs a directed drop through the frame/cavity/sill/free-fall sequence; it saves stage images and a WebM to `artifacts/`. No production injection API is exposed.

The open-source skill research, exact source version and integration decisions are in `docs/wet-glass-skill-research.md`.
