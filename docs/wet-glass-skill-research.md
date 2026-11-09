# Wet-glass skill research and integration

Reviewed on 2026-11-09. Source repository: [scottstts/Threejs-Awesome-Graphics-Agent-Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills), reference commit `53eb5a24097425d82532ec33697ad472750132a4`.

The task-specific match is [threejs-temporal-surfaces](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills/blob/53eb5a24097425d82532ec33697ad472750132a4/skills/threejs-temporal-surfaces/SKILL.md). Its wet-window reference separates droplet coverage, optical normals, scene color and persistent traces, and requires drawing-buffer coordinates to remain consistent at different pixel ratios. The frost history reference calls for sufficient precision, explicit resize/reset behavior and frame-rate-independent decay. The related [threejs-water-optics](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills/blob/53eb5a24097425d82532ec33697ad472750132a4/skills/threejs-water-optics/SKILL.md) supplies a coherent normal/reflection/refraction hierarchy and side-aware Fresnel guidance.

The skill documentation uses the repository's [MIT license](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills/blob/53eb5a24097425d82532ec33697ad472750132a4/LICENSE), copyright 2026 Scott Sun. Some examples have their own licensing boundaries; no example rain shader, library or asset is incorporated into this implementation. The consulted skill files, relevant examples and license were saved in ignored `artifacts/open-source-skills/` for this project. They were read directly as task guidance; no global skill installation or new browser dependency was required.

Application in this project:

- The droplet normal pass drives both refraction and Fresnel, using water IOR 1.333. Reflections sample the same sky the clear letters reveal.
- The sharp sky, low-resolution frost blur and water normals remain separate render targets. Cavity droplets use the real aperture mask for occlusion.
- Traces have persistent Float32 state and exponential decay. Only their displayed texture is quantized; tests verify actual fade at 30/60/120 FPS.
- A custom shared warped-alpha/signed-distance field adds the frame contact behavior absent from the procedural wet-window example: pinning, downhill frame flow, cubic-volume merging, capillary release, cavity descent, lower-sill collection and free fall.
- Static mask/field generation runs on layout changes. Animation retains a 96-droplet budget and pauses offscreen or with reduced motion.

Validation: `tests/glassPhysics.test.mjs` exercises the physical transitions, momentum/volume conservation, barrier separation, downhill frame movement and high-precision history. `tests/window-contact-browser.mjs` uses a directed hit on the actual rendered warped aperture and records the transitions in `artifacts/window-contact-result.json` and `artifacts/window-contact.webm`.
