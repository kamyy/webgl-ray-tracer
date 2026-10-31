# Architecture

Why the system is shaped this way: decisions, alternatives rejected, costs accepted. [`AGENTS.md`](AGENTS.md) is what breaks if you don't know it; [`RUNBOOK.md`](RUNBOOK.md) is how to run it. Each fact lives in exactly one of the three.

- [1. Rendering approach](#1-rendering-approach)
- [2. Rendering pipeline](#2-rendering-pipeline)
- [3. Scene loading & BVH](#3-scene-loading--bvh)
- [4. Ray tracing shader](#4-ray-tracing-shader)
- [5. Scene graph](#5-scene-graph)
- [6. State management](#6-state-management)
- [7. Hosting & CI/CD](#7-hosting--cicd)

---

## 1. Rendering approach

The app is a path tracer. Each pixel fires many randomly scattered rays, and averaging their results converges on soft shadows, ambient occlusion and blurred reflections that a rasterizer needs tricks to fake. The cost is compute: one sample per pixel is very noisy, so the image refines over many passes.

A fragment shader does the tracing because every pixel is independent, which is what a GPU runs in parallel. The shader needs WebGL 2 for several features:

- Loops without a compile-time bound, which the bounce and BVH traversal loops need.
- Float texture formats, which hold the random seeds, mesh, material and BVH data.
- Texture arrays, which hold one BVH per mesh.
- `texelFetch`, which reads exact texels with no filtering.

The cost accepted is a hardware floor: a recent GPU, WebGL 2 and the `EXT_color_buffer_float` extension.

---

## 2. Rendering pipeline

Each animation frame is one render pass made of two shaders.

```text
 ┌───────────────┐   one sample per pixel    ┌──────────────────────────┐
 │ SampleShader  ├──────────────────────────►│ ColorTextures            │
 │ sample-fs.glsl│   added to the accumulator│ RGBA32F source ◄► target │
 └───────────────┘                           └────────────┬─────────────┘
                                                          │ accumulated color
                                                          ▼
                                             ┌────────────────────────┐
                                             │ CanvasShader           │
                                             │ canvas-fs.glsl         │
                                             │ color / render pass    │
                                             └────────────┬───────────┘
                                                          ▼
                                                   visible canvas
```

- **`SampleShader`** (`public/sample-vs.glsl`, `public/sample-fs.glsl`) path-traces one sample per pixel into an off-screen `RGBA32F` accumulator. `ColorTextures` keeps a source and target texture pair, because a shader can't read and write the same texture in one draw.
- **`CanvasShader`** (`public/canvas-vs.glsl`, `public/canvas-fs.glsl`) divides the accumulated color by the pass count and draws it to the visible canvas.

Splitting them keeps the accumulator a plain running sum, and only the display shader normalizes it.

Rendering runs until the pass count reaches the sample setting. A camera, scene or parameter change resets the pass count and restarts accumulation. While a mouse button is held, only pass 1 renders, which trades image quality for a responsive drag.

---

## 3. Scene loading & BVH

A Wavefront `.obj`/`.mtl` pair is parsed with `obj-file-parser` and `mtl-file-parser`. A bounding volume hierarchy (BVH) is built for each object so the shader tests a ray against a few boxes before it tests any triangle.

- **The split uses the Surface Area Heuristic (SAH).** `BV.findBestSplit` sweeps all three axes and every candidate position with prefix and suffix bounding-box sums. It picks the split minimizing `SA(left) * |left| + SA(right) * |right|`. This builds slower than a median split and gives faster traversal, which pays off because a tree is built once and traced millions of times.
- **Traversal uses a fixed-size stack, so tree depth is capped** at `bvMaxStackSize`. GLSL has no recursion, and a dynamically sized stack isn't available.
- **Faces, BVH nodes and materials are packed into `Float32Array`s** and uploaded as `TEXTURE_2D_ARRAY` and `TEXTURE_2D` textures, one array layer per mesh. `NEAREST` filtering with `texelFetch` reads the exact texel. Uniform buffers hold far less data than a texture.
- **Material behavior comes from the material's name.** The names map to emissive, reflective and dielectric kinds. This was the quickest way to get lights and glass into the bundled scenes. The cost is that any other scene needs code changes ([State / what's next](AGENTS.md#6-state--whats-next)).

---

## 4. Ray tracing shader

`public/sample-fs.glsl` traces one sample per pixel.

- **The random number generator combines three Tausworthe steps with a linear congruential generator.** Each pixel is seeded from `RandomTexture` and perturbed by the pass number, so every pass draws different samples and the average converges.
- **`rayIntersectBVH` walks every object's tree with an explicit stack.** It skips any subtree whose entry distance is farther than the nearest hit found so far.
- **`pathTrace` unrolls the recursive algorithm into a loop** with a fixed-size stack, `RAY_BOUNCE_MAX_STACK_SIZE`, because GLSL can't recurse. It stops at an emissive material.
  - Reflective surfaces (`rayBounceOffReflectiveSurface`) blend glossy reflection with diffuse scattering through `reflectionRatio` and `reflectionGloss`.
  - Dielectric surfaces (`rayBounceOffDielectricSurface`) use the Schlick approximation to choose between reflecting and refracting.
- **Flat shading uses the face normal. Phong shading interpolates the vertex normals** with barycentric coordinates. `u_shadingMethod` selects between them.

---

## 5. Scene graph

`RefFrame` (`src/lib/math/refFrame.ts`) is a hierarchical transform node, linked as parent, child and next sibling. It recomputes world matrices lazily: a `validSubtree` flag is set dirty by `invalidateSubtree` and cleared by `validateAscending`. A camera drag only invalidates what moved.

`Scene` wires `rootNode → parentNode → cameraNode`. The mouse handlers in `src/components/canvas.tsx` orbit, pan and dolly by changing `cameraNode` and `parentNode` directly.

---

## 6. State management

Redux Toolkit (`src/lib/store`) holds only state the UI displays: the loading spinner, shading method, render pass and timing counters, and the sample, bounce and field-of-view settings.

Everything else lives in the `CanvasVars` ref (`src/types/canvasVars.ts`) held by `Canvas`: camera transforms, textures and WebGL handles. These change every animation frame, and Redux would re-render React on each change for no benefit.

---

## 7. Hosting & CI/CD

The app is fully client-side rendered, with the default Vite React setup and no server-side rendering. `dist/` is static HTML, JavaScript, CSS and the `public/` GLSL files, so an S3 bucket serves it with no server runtime.

- **The bucket is served directly, with no CDN.** A new deploy is visible at once, and there is no cache to invalidate.
- **CI deploys on every push to `main`.** The `build` job gates the `deploy` job, and the deploy assumes an AWS role through GitHub's OIDC token, so the repo stores no long-lived AWS keys.
- **A push that changes only Markdown or `LICENSE` skips CI and deploy.** The built `dist/` would be identical, so the sync would do nothing.
