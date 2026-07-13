# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A GPU path tracer that runs entirely in the browser via WebGL 2. React/TypeScript handles scene loading (Wavefront OBJ/MTL), BVH construction, and camera/UI interaction; a GLSL fragment shader does the actual ray tracing, accumulating progressive samples into a float texture over many render passes. Requires WebGL 2 with `EXT_color_buffer_float` and generous texture limits (see `GPU_MeetsRequirements` in `src/components/canvas.tsx`).

## Commands

```bash
npm run dev            # vite dev server on :3000, opens browser
npm run build           # tsc typecheck + vite production build -> dist/
npm run typecheck       # tsc --noEmit only
npm run lint             # eslint .
npm run lint:fix
npm run format           # prettier --write .
npm run format:check
```

There is no test suite/runner in this project.

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `typecheck`, `build` on every push/PR to `main`, then on push to `main` it builds `dist/` and syncs it to S3 (`webgl-ray-tracer.orky.net`) via an AWS deploy role — the deploy step only triggers on `main`.

This is a fully client-side-rendered app — the default Vite React setup, no SSR/SSG. `dist/` is just static assets (HTML/JS/CSS + the `public/` GLSL files), so it can be served entirely from an S3 bucket with no server runtime, which is exactly what the CI deploy step does.

Husky's pre-commit hook (`.husky/pre-commit`) runs three checks in sequence: `format-staged` (`pretty-quick --staged`), then `lint`, then `typecheck` — a commit is blocked if any of them fails, not just formatting.

## Architecture

### Two-shader progressive rendering pipeline

Each animation frame (`Canvas` in `src/components/canvas.tsx`) does one **render pass**:

1. **`SampleShader`** (`public/sample-fs.glsl` + `sample-vs.glsl`) path-traces one sample per pixel and accumulates it into an off-screen `RGBA32F` texture via `ColorTextures` (ping-pong source/target texture pair bound to a framebuffer). Pass 1 initializes the accumulator; every subsequent pass adds another sample on top.
2. **`CanvasShader`** (`public/canvas-fs.glsl` + `canvas-vs.glsl`) divides the accumulated color by the pass count (`u_inv_render_pass`) and draws it to the visible canvas.

Rendering runs until `renderingPass === numSamples` (Redux `appSlice`). Any camera/scene change or parameter change (FOV, samples, bounces, shading method) resets `renderingPass` to 0 and restarts accumulation — see `renderReset()` and the `useEffect` in `Canvas`. While a mouse button is held, only pass 1 is rendered (to keep interaction responsive); passes resume accumulating once the button is released.

GLSL shader source files live in `public/` (fetched at runtime via `fetch()` in `Shader.init`, not bundled by Vite) and are mirrored into `dist/` on build.

### Scene loading and BVH (`src/lib/webgl/scene.ts`)

- Wavefront `.obj`/`.mtl` are parsed with `obj-file-parser`/`mtl-file-parser` (typed via `src/types/*FileParser.d.ts`).
- Each parsed object's faces are used to build a **BVH** (`BV` class) using a **Surface Area Heuristic (SAH)** split (`BV.findBestSplit`): all 3 axes and every candidate split position are swept via prefix/suffix AABB sums to pick the split minimizing `SA(left)*|left| + SA(right)*|right|`.
- `bvMaxStackSize = 16` in `scene.ts` **must stay in sync** with `BV_MAX_STACK_SIZE` in `public/sample-fs.glsl` — the shader's BVH traversal stack is a fixed-size array with no bounds checking, so a deeper tree silently corrupts rendering. `subDivide` warns via `console.warn` if this is exceeded but does not enforce it.
- Faces, BVH nodes, and materials are packed into `Float32Array`s and uploaded as `TEXTURE_2D_ARRAY`/`TEXTURE_2D` textures (`facesTexture`, `AABBsTexture`, `mtlsTexture`) — one array layer per mesh object — using `NEAREST` filtering and `texelFetch` in the shader for exact texel reads. Changing the packed layout (`numFloatsPerFace`, `numFloatsPerBV`, `numFloatsPerMtl`, texel index constants) requires updating both `scene.ts` and the matching `*_INDEX` constants in `sample-fs.glsl` together.
- Material behavior (`EMISSIVE_MATERIAL`, `REFLECTIVE_MATERIAL`/default, `DIELECTRIC_MATERIAL`) is currently driven by hardcoded MTL name matches (`'light'`, `'glass'`, `'suzanne'`, `'teapot'`, `'ladder'`) in `Scene.init` — there's no generic material config format yet.

### Ray tracing shader (`public/sample-fs.glsl`)

- Per-pixel PRNG combines a Tausworthe generator (3x) with a linear congruential generator, seeded per-pixel from `RandomTexture` and perturbed by the render pass number so each pass draws different samples.
- `rayIntersectBVH` iterates every object's BVH tree with an explicit stack (`BV_MAX_STACK_SIZE`), pruning subtrees whose entry distance exceeds the current nearest hit.
- `pathTrace` unrolls the recursive path trace into a loop with a fixed-size stack (`RAY_BOUNCE_MAX_STACK_SIZE`), bouncing rays off reflective (`rayBounceOffReflectiveSurface`, glossy reflection blended with diffuse via `reflectionRatio`/`reflectionGloss`) or dielectric (`rayBounceOffDielectricSurface`, Schlick approximation for reflect/refract probability) surfaces, terminating on emissive materials.
- Flat vs. Phong shading (`u_shadingMethod`) selects between the face normal and barycentric-interpolated vertex normals.

### Scene graph / transforms (`src/lib/math/refFrame.ts`)

`RefFrame` is a hierarchical transform node (parent/child/next sibling linked list) with lazy world-matrix recomputation (`validSubtree` dirty flag propagated via `invalidateSubtree`/`validateAscending`). `Scene` wires up `rootNode -> parentNode -> cameraNode`; camera orbit/pan/dolly in `Canvas`'s mouse handlers manipulate `cameraNode` and `parentNode` directly via `translate`/`rotateX`/`rotateZ`/`mapPos`.

### State management

Redux Toolkit (`src/lib/store`) holds only UI/rendering-status state (`appSlice`: loading spinner, shading method, render pass/timing counters, sample/bounce/FOV settings) — typed hooks in `src/lib/store/hooks.ts`. All actual GPU/scene state (camera transforms, textures, WebGL handles) lives outside Redux in the `CanvasVars` ref (`src/types/canvasVars.ts`) held by `Canvas`, since it's mutated every animation frame and doesn't need to trigger React re-renders.

### Path aliasing

`@/*` maps to `src/*` (configured in both `vite.config.ts` and `tsconfig.json`).

## Code style

Formatting/linting is enforced by CI (`format:check`, `lint`) — always run `npm run format` and `npm run lint:fix` before committing. Notable Prettier settings (`prettier.config.mjs`): no semicolons, single quotes, no arrow-function parens for single args, imports auto-organized via `prettier-plugin-organize-imports`.
