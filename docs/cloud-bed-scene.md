# Cloud-bed homepage scene

The homepage uses a fixed camera over a moving meadow. The cloud-and-bed assembly gently bobs and tilts inside a real layout stage below the hero actions, so English and Chinese text, small screens and short desktop windows cannot cover it.

- `components/Hero.tsx` reserves the stage in normal document flow. The renderer measures it on resize, scroll, font/layout changes and language changes.
- `components/HeroAtmosphere.tsx` retains the local-time, six-phase and weather controls, night-sky movie, reduced-motion preference and offscreen pause.
- `lib/renderHeroScene.ts` composes the sky, matching cloud sprites, cloud bed, rainbow shelter, hanging stars, mist, rain and lens droplets. The night movie is sampled only from the central upper sky so old scenery never enters this new scene.
- `lib/sceneSurface.ts` moves one meadow texture in perspective. It caps output resolution and frame rate; unsupported WebGL falls back to Canvas. Failed WebP loading falls back to a transparent PNG, and the initial/no-Canvas hero has a static cloud-bed image.
- The seven-color rain dome projects soft light below the canopy. Rain strokes are explicitly clipped outside the sheltered bed; drops on the viewing lens remain independent.
- Night brings 19 hanging star lights on desktop and 13 on phones. Reduced motion fixes the bed, landscape and star lights without removing the illustrated weather states.

Generated assets and their exact imagegen prompts are recorded in [`public/scene/cloud-bed-provenance.json`](../public/scene/cloud-bed-provenance.json). Alpha is preserved in both cloud images. Legacy valley assets/provenance remain archived; valley-specific geometry browser checks have been replaced by the cloud-bed optical checks.

Validation (set `FLUX_PLAYWRIGHT_MODULE` to an installed Playwright `index.mjs`, and serve the static `out` directory at `PORTFOLIO_TEST_URL`):

```sh
npm run build
node --test tests/sceneEnvironment.test.mjs
node tests/scene-browser.mjs
node tests/scene-cloud-bed-browser.mjs
```

The browser checks cover six phases, rain/dew, night video, reduced motion, mobile layout, English/Chinese, keyboard controls, failed-image and no-GPU fallbacks. The cloud-bed test also compares actual pixels with individual effects removed in the test context: visible hanging stars, forward meadow/cloud movement, rainbow light and rain exclusion over the bed. Production does not expose these test overrides.
