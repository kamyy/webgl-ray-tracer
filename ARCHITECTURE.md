# Architecture

Why the system is shaped this way: decisions, alternatives rejected, costs accepted. [`AGENTS.md`](AGENTS.md) is what breaks if you don't know it; [`RUNBOOK.md`](RUNBOOK.md) is how to run it. Each fact lives in exactly one of the three.

- [1. Rendering approach](#1-rendering-approach)
- [2. Rendering pipeline](#2-rendering-pipeline)
- [3. Scene loading & BVH](#3-scene-loading--bvh)
- [4. Ray tracing shader](#4-ray-tracing-shader)
- [5. Scene graph](#5-scene-graph)
- [6. State management](#6-state-management)
- [7. Hosting & CI/CD](#7-hosting--cicd)
- [8. Styling](#8-styling)

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
 │ pathTrace.frag│   added to the accumulator│ RGBA32F source ◄► target │
 └───────────────┘                           └────────────┬─────────────┘
                                                          │ accumulated color
                                                          ▼
                                             ┌────────────────────────┐
                                             │ CanvasShader           │
                                             │ display.frag.glsl      │
                                             │ color / render pass    │
                                             └────────────┬───────────┘
                                                          ▼
                                                   visible canvas
```

- **`SampleShader`** (`src/shaders/pathTrace.vert.glsl`, `src/shaders/pathTrace.frag.glsl`) path-traces one sample per pixel into an off-screen `RGBA32F` accumulator. `ColorTextures` keeps a source and target texture pair, because a shader can't read and write the same texture in one draw.
- **`CanvasShader`** (`src/shaders/display.vert.glsl`, `src/shaders/display.frag.glsl`) divides the accumulated color by the pass count and draws it to the visible canvas.

Splitting them keeps the accumulator a plain running sum, and only the display shader normalizes it.

Rendering runs until the pass count reaches the sample setting. A camera, scene or parameter change resets the pass count and restarts accumulation. While a mouse button is held, only pass 1 renders, which trades image quality for a responsive drag.

---

## 3. Scene loading & BVH

The scene is a glTF 2.0 binary (`public/suzanne.glb`) loaded with three.js's `GLTFLoader`. Each mesh becomes one object, and a bounding volume hierarchy (BVH) is built for each object so the shader tests a ray against a few boxes before it tests any triangle.

- **The split uses the Surface Area Heuristic (SAH).** `BvhNode.findBestSplit` sweeps all three axes and every candidate position with prefix and suffix bounding-box sums. It picks the split minimizing `SA(left) * |left| + SA(right) * |right|`. This builds slower than a median split and gives faster traversal, which pays off because a tree is built once and traced millions of times.
- **Traversal uses a fixed-size stack, so tree depth is capped** at `bvhMaxStackSize`. GLSL has no recursion, and a dynamically sized stack isn't available.
- **Faces, BVH nodes and materials are packed into `Float32Array`s** and uploaded as `TEXTURE_2D_ARRAY` and `TEXTURE_2D` textures, one array layer per mesh. `NEAREST` filtering with `texelFetch` reads the exact texel. Uniform buffers hold far less data than a texture.
- **glTF was chosen because its material fields already describe what the shader needs.** `metalness` becomes the reflection ratio, `1 - roughness` the gloss, `transmission` and `ior` select and drive dielectric materials, and `emissive` times `emissiveIntensity` makes a light. The alternative, OBJ with MTL, has no standard fields for emission, glass or roughness, so a scene needed hardcoded material names. The cost is that a scene must be authored or exported with these PBR fields set.
- **The geometry is Draco-compressed** at 16-bit positions and 12-bit normals. The default quantization is coarse enough to show as faceting on smooth surfaces and as gaps between triangles. The file is about 6% of the size of the OBJ it replaced, and `DRACOLoader` decodes it in a web worker. The decoder is served from `public/draco/` instead of a CDN, so the app works offline and makes no third-party request.

---

## 4. Ray tracing shader

`src/shaders/pathTrace.frag.glsl` traces one sample per pixel.

- **The random number generator combines three Tausworthe steps with a linear congruential generator.** Each pixel is seeded from `RandomTexture` and perturbed by the pass number, so every pass draws different samples and the average converges.
- **`rayIntersectBVH` walks every object's tree with an explicit stack.** It skips any subtree whose entry distance is farther than the nearest hit found so far.
- **`pathTrace` unrolls the recursive algorithm into a loop** with a fixed-size stack, `RAY_BOUNCE_MAX_STACK_SIZE`, because GLSL can't recurse. It stops at an emissive material.
  - Reflective surfaces (`rayBounceOffReflectiveSurface`) blend glossy reflection with diffuse scattering through `reflectionRatio` and `reflectionGloss`.
  - Dielectric surfaces (`rayBounceOffDielectricSurface`) use the Schlick approximation to choose between reflecting and refracting.
- **Flat shading uses the face normal. Phong shading interpolates the vertex normals** with barycentric coordinates. `u_shading_method` selects between them.

---

## 5. Scene graph

`RefFrame` (`src/lib/math/refFrame.ts`) is a hierarchical transform node, linked as parent, child and next sibling. It recomputes world matrices lazily: a `validSubtree` flag is set dirty by `invalidateSubtree` and cleared by `validateAscending`. A camera drag only invalidates what moved.

`Scene` wires `rootNode → parentNode → cameraNode`. The mouse handlers in `src/components/canvas.tsx` orbit, pan and dolly by changing `cameraNode` and `parentNode` directly.

---

## 6. State management

A Zustand store (`src/lib/store/appStore.ts`) holds only state the UI displays: the loading spinner, shading method, render pass and timing counters, and the sample, bounce and field-of-view settings. Zustand needs no provider component, and the render loop reads the store directly with `useAppStore.getState()`, so the settings are not copied into a second place.

Everything else lives in the `CanvasVars` ref (`src/types/canvasVars.ts`) held by `Canvas`: camera transforms, textures and WebGL handles. These change every animation frame, and storing them in the store would re-render React on each change for no benefit.

---

## 7. Hosting & CI/CD

The app is fully client-side rendered, with the default Vite React setup and no server-side rendering. `dist/` is static HTML, JavaScript, CSS and the GLSL shaders bundled into the JavaScript, so an S3 bucket serves it with no server runtime.

- **The bucket is served directly, with no CDN.** A new deploy is visible at once, and there is no cache to invalidate.
- **CI deploys on every push to `main`.** The `build` job gates the `deploy` job, and the deploy assumes an AWS role through GitHub's OIDC token, so the repo stores no long-lived AWS keys.
- **A push that changes only Markdown or `LICENSE` skips CI and deploy.** The built `dist/` would be identical, so the sync would do nothing.

---

## 8. Styling

Components are styled with Tailwind CSS utility classes in the JSX, not with CSS modules or Sass. The markup and its look then change in one place, and a responsive layout is a breakpoint prefix on the element it affects (`md:flex-row`) rather than a media query in a second file.

- **The cost is long `className` strings.** A string shared by several elements in one file goes into a constant above the component.
- **The range slider track and thumb stay as CSS** in `src/styles/globals.css`, because Tailwind has no utilities for the vendor pseudo-elements that style them.
