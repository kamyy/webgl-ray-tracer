# Architecture

Why the system is shaped this way: decisions, alternatives rejected, costs accepted. [`AGENTS.md`](AGENTS.md) is what breaks if you don't know it; [`RUNBOOK.md`](RUNBOOK.md) is how to run it. Each fact lives in exactly one of the three.

- [1. Rendering approach](#1-rendering-approach)
- [2. Rendering pipeline](#2-rendering-pipeline)
- [3. Scene loading & BVH](#3-scene-loading--bvh)
- [4. Ray tracing shader](#4-ray-tracing-shader)
- [5. Camera and controls](#5-camera-and-controls)
- [6. State management](#6-state-management)
- [7. Hosting & CI/CD](#7-hosting--cicd)
- [8. Styling](#8-styling)
- [9. Layout](#9-layout)
- [10. Ray tracing milestones](#10-ray-tracing-milestones)

---

## 1. Rendering approach

The app is a path tracer. Each pixel fires many randomly scattered rays, and averaging their results converges on soft shadows, ambient occlusion and blurred reflections. A rasterizer, which projects triangles onto the screen without tracing rays, has to approximate these effects. The cost is compute: one sample per pixel is very noisy, so the image refines over many samples.

A fragment shader does the tracing because every pixel is independent, which is what a GPU can compute in parallel. The shader needs WebGL 2 for several features:

- Loops without a compile-time bound, which the bounce and BVH traversal loops need.
- Float texture formats, which hold the mesh, material and BVH data, and integer texture formats, which hold the random seeds.
- Texture arrays, which hold one BVH per mesh.
- `texelFetch`, which reads exact texels with no filtering.

The cost accepted is a hardware floor: a recent GPU, WebGL 2 and the `EXT_color_buffer_float` and `EXT_float_blend` extensions.

---

## 2. Rendering pipeline

A rendering tick is one run of the render loop, which the browser starts once per screen refresh through `requestAnimationFrame`. React Three Fiber exposes that loop as the `useFrame` hook. `PathTracer` draws the display shader (`DisplayMaterial`) from it, so the display updates at the screen refresh rate. The path-trace shader (`PathTraceMaterial`) runs on its own timer, as fast as the GPU finishes samples. React Three Fiber owns the canvas, the camera and the controls, and `PathTracer` (`src/components/pathTracer.tsx`) starts the drawing, which `src/lib/webgl/tracer.ts` does.

```text
 ┌────────────────────┐   bands of one sample      ┌──────────────────────────┐
 │ PathTraceMaterial  ├──────────────────────────►│ one float render target  │
 │ pathTrace.frag.glsl│   added by blending       │ RGBA32F, sum + count     │
 └────────────────────┘                           └────────────┬─────────────┘
                                                               │ copied when a sample
                                                               │ completes
                                                               ▼
                                                  ┌────────────────────────┐
                                                  │ completed target       │
                                                  │ RGBA32F copy of the sum│
                                                  └────────────┬───────────┘
                                                               ▼
                                                  ┌────────────────────────┐
                                                  │ DisplayMaterial        │
                                                  │ display.frag.glsl      │
                                                  │ color / sample count   │
                                                  └────────────┬───────────┘
                                                               ▼
                                                        visible canvas
```

- **`PathTraceMaterial`** (`src/lib/webgl/pathTraceMaterial.ts`, with `src/shaders/pathTrace.vert.glsl` and `src/shaders/pathTrace.frag.glsl`) path-traces samples into an off-screen `RGBA32F` target with additive blending. The rgb channels hold the running sum of sample colors, and alpha counts the samples each pixel has received.
- **`DisplayMaterial`** (`src/lib/webgl/displayMaterial.ts`, with `src/shaders/display.vert.glsl` and `src/shaders/display.frag.glsl`) divides the sum by the per-pixel count and draws it to the visible canvas. Keeping the two apart leaves the accumulator a plain running sum, and only the display shader normalizes it.
- **Tracing runs on a timer, in bands of rows sized to take about 16 ms, with at most two bands waiting on the GPU.** Tying it to the screen refresh would cap a fast GPU at one band per refresh and leave it idle between them.

  ```text
   timer loop                                 GPU, in submission order
   ┌───────────────────────────────────┐      ┌──────────────────────────┐
   │ fewer than 2 bands waiting?       │      │ band 1 ► fence 1         │
   │   yes ► draw a band, add a fence  ├─────►│ band 2 ► fence 2         │
   │   no  ► look again in 4 ms        │      │ last band of a sample:   │
   │                                   │      │   copy sum ► `completed` │
   │ a signaled fence gives the band's │◄─────┤                          │
   │ time, which sizes the next band   │      │                          │
   └───────────────────────────────────┘      └─────────────┬────────────┘
                                                            ▼
                                      next screen refresh: `drawDisplay` reads `completed`
  ```

  - The GPU also draws every window on the desktop, so a long job makes the whole desktop stutter, and on a phone it can make the browser reset the WebGL context ([Layout](#9-layout)). A full sample can take hundreds of milliseconds, so `PathTracer` draws it as bands. A band is a range of the image's pixel rows. `PathTracer` limits the draw to those rows with a scissor, a rectangle the GPU will not draw outside. A band never crosses a sample boundary, so a fast GPU that finishes a sample in under 16 ms draws it as one band and traces many samples per refresh.
  - A fence is a marker the GPU signals when it has finished all the commands submitted before it. The loop checks the oldest fence about every 4 ms. The limit of two bands keeps the command queue from growing without bound, because the loop would otherwise submit faster than the GPU works.
  - The time from a band's start to its fence signaling gives the GPU time per row, smoothed over the last bands, so the size follows the GPU, the scene and the bounce count.
  - The display shader reads the `completed` target, a copy of the running sum that `PathTracer` makes each time a sample finishes, not the running sum itself. Mid-sample, the rows already drawn hold one more sample than the rest, which would show as a faint edge in the noise. The copy runs on the GPU in order with the bands, so it holds exactly the finished sample even while the next band is queued. The display pass runs only after a copy, so the image updates once per sample.
  - The cost is that the target must be additive, which needs the `EXT_float_blend` extension, and that a second float target of the same size is held in memory.
  - Samples are numbered from 1, and the counter shows how many are done. The first one after a restart is a one-bounce preview drawn as a single band, so a moving camera always shows a complete image.

- **Both are raw shader materials drawn on one triangle that covers the target** (`src/lib/webgl/shaderTriangle.ts`). A raw material skips the code three.js adds to its built-in materials, which would clash with the GLSL's own inputs and outputs.
  - The target is the square from -1 to 1 on both axes in clip space, the coordinates the GPU clips to. The triangle's corners are `(-1, -1)`, `(3, -1)` and `(-1, 3)`, so its two legs are 4 units long and the square fits inside it. The GPU discards the part outside the square:

    ```text
     ●  (-1, 3)
     │ ╲
     │   ╲
     │     ╲
     ├───────┐
     │       │ ╲
     │ target│   ╲
     │       │     ╲
     ●───────┴───────●
     (-1, -1)     (3, -1)
    ```

  - A rectangle of two triangles would draw the same image. One triangle needs three vertices instead of six, and has no shared diagonal edge where the GPU shades some pixels twice.

- **Sample and timing counters reach the store about twice a second**, not every rendering tick, so React does not re-render at the display refresh rate.

Rendering runs until the sample count reaches the sample setting, which can change mid-render without a reset. A camera or image setting change resets the sample count and restarts accumulation. `traceStep` in `src/lib/webgl/tracer.ts` notices a camera change by comparing the camera's world matrix with the one from the previous tracing step, so it does not depend on which control moved the camera. While the camera is being dragged, only sample 1 renders, which trades image quality for a responsive drag.

---

## 3. Scene loading & BVH

The scene is a glTF 2.0 binary, fetched from `/scenes/` or opened from the user's drive, loaded with three.js's `GLTFLoader`. Each mesh becomes one object, and a bounding volume hierarchy (BVH) is built for each object so the shader tests a ray against a few boxes before it tests any triangle.

```text
 main thread                                             Web Worker
 ┌──────────────────────────────┐   world-space faces       ┌─────────────────────────────┐
 │ GLTFLoader                   │   (transferred, not       │ src/lib/webgl/bvhWorker.ts  │
 │   the chosen .glb file       ├──────────────────────────►│   SAH split, one tree       │
 │ usePackedScene ► packScene   │    copied)                │   per mesh                  │
 │   extractFaces               │◄──────────────────────────┤   packFaces, packBvhNodes   │
 │   packMaterials, packLights  │   packed Float32Arrays    └─────────────────────────────┘
 └──────────────┬───────────────┘
                │ uploaded as textures
                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ facesTexture and bvhTexture: one array layer per mesh       │
 │ materialsTexture: one row per material                      │
 │ lightsTexture: one entry per emissive face                  │
 └──────────────────────────────┬──────────────────────────────┘
                                │ texelFetch
                                ▼
                     src/shaders/pathTrace.frag.glsl
```

- **The split uses the Surface Area Heuristic (SAH).** `BvhNode.findBestSplit` sweeps all three axes and every candidate position with prefix and suffix bounding-box sums. It picks the split minimizing `SA(left) * |left| + SA(right) * |right|`. This builds slower than a median split and gives faster traversal, which pays off because a tree is built once and traced millions of times.
- **The tree is built in a Web Worker.** The SAH sweep sorts the faces three times per node, which takes seconds for a large mesh and freezes the page if it runs on the main thread. The main thread sends world-space faces and receives the packed arrays as transferable buffers, so nothing is copied. The cost is that the BVH code can't import three.js or touch `window`, because the worker has neither.
- **Traversal uses a fixed-size stack, so tree depth is capped** at `bvhMaxStackSize`. GLSL has no recursion, and a dynamically sized stack isn't available.
- **Faces, BVH nodes, materials and lights are packed into `Float32Array`s** and uploaded as `TEXTURE_2D_ARRAY` and `TEXTURE_2D` textures, one array layer per mesh. A light is one face of an emissive mesh. `packLights` writes the list before the faces go to the worker, because sending them empties the position arrays. `NEAREST` filtering with `texelFetch` reads the exact texel. Uniform buffers hold far less data than a texture.
- **glTF was chosen because its material fields already describe what the shader needs.** `metalness` becomes the reflection ratio, `1 - roughness` the gloss, `transmission` and `ior` select and drive dielectric materials, and `emissive` times `emissiveIntensity` makes a light. The alternative, OBJ with MTL, has no standard fields for emission, glass or roughness, so a scene needed hardcoded material names. The cost is that a scene must be authored or exported with these PBR fields set.
- **The geometry is Draco-compressed** at 16-bit positions and 12-bit normals. The default quantization is coarse enough to show as faceting on smooth surfaces and as gaps between triangles. `DRACOLoader` decodes the file in a web worker. The decoder is served from `public/draco/` instead of a CDN, so the app works offline and makes no third-party request.

---

## 4. Ray tracing shader

`src/shaders/pathTrace.frag.glsl` traces one sample per pixel.

- **The random number generator combines three Tausworthe steps with a linear congruential generator.** Each pixel is seeded from the texture that `createRandomTexture` in `src/lib/webgl/randomTexture.ts` builds, and perturbed by the sample number, so every sample uses different random numbers and the average converges.
- **`rayIntersectBVH` walks every object's tree with an explicit stack.** It skips any subtree whose entry distance is farther than the nearest hit found so far.
- **`pathTrace` unrolls the recursive algorithm into a loop**, because GLSL can't recurse. It keeps a running `throughput` and adds light to `radiance`, and it stops at an emissive material. A path that runs out of bounces adds the albedo of the surface it ended on, an ambient glow that lights areas no ray reaches a light from.
  - Reflective surfaces pick the mirror lobe (`rayBounceOffMirror`) or the diffuse lobe (`rayBounceOffDiffuse`) with the chance `reflectionRatio`, and `reflectionGloss` sets how sharp the mirror lobe is.
  - Dielectric surfaces (`rayBounceOffDielectricSurface`) use the Schlick approximation to choose between reflecting and refracting.
- **`sampleDirectLight` samples the lights at every diffuse hit that can still bounce.** It picks an emissive face with a chance in proportion to its area, picks a uniform point on it and casts a shadow ray. Most diffuse hits then see the light directly instead of finding it by chance, so small lights converge much faster.
  - A ray that reaches a light right after a diffuse bounce adds no emission, because `sampleDirectLight` already counted that light. Emission still counts for the camera ray and after a mirror or glass bounce, which a shadow ray cannot follow. This avoids multiple importance sampling (MIS) at the cost of noisier paths that reach a light through a mirror.
  - `sampleDirectLight` weights the light by the density of `rayBounceOffDiffuse`, `2 * cos(theta)^3 / PI`, so the lit areas keep the brightness the bounce rays give. A correct cosine-weighted bounce has density `cos(theta) / PI`, and that term changes with it.
- **Flat shading uses the face normal. Phong shading interpolates the vertex normals** with barycentric coordinates. `u_shading_method` selects between them.

---

## 5. Camera and controls

drei's `PerspectiveCamera` and `CameraControls` (`src/components/viewport.tsx`) provide the camera and its mouse and touch handling. The app uses three.js's axes everywhere: the world is Y-up, which is also glTF's native orientation, and the camera looks down its own -z axis. The shader builds each ray in that camera space and multiplies it by the camera's world matrix, so no axis conversion is needed anywhere.

The camera is a thin lens. `main` in `src/shaders/pathTrace.frag.glsl` starts each ray at a random point on a disk of radius `lensRadius` and aims it at the point where the pinhole ray crosses the plane `focusDistance` away. Points on that plane stay sharp and others blur, and the progressive averaging smooths the blur with no extra pass. A `lensRadius` of 0 is a pinhole. The focus distance and lens radius sliders each have 100 positions that span the scene's size, because scene units have no fixed scale.

`CameraControls` gives rotate, pan and dolly with the mouse and touch for free. It has no Ctrl + left-drag pan, so panning is right-drag or two fingers. Its rotate speed is set to 0.5.

---

## 6. State management

A Zustand store (`src/lib/store/appStore.ts`) holds only state the UI displays: the chosen scene, the shading method, sample and timing counters, and the sample, bounce, field-of-view, lens-radius and focus-distance settings. Zustand needs no provider component, and the render loop reads the store directly with `useAppStore.getState()`, so the settings are not copied into a second place.

```text
 ┌────────────────────────────┐                                  ┌──────────────────────────────┐
 │ PathTracer                 │   counters, twice a second       │ useAppStore                  │
 │ and the tracing engine     ├─────────────────────────────────►│   cameraFov, lensRadius      │
 │                            │                                  │   focusDistance, numSamples  │
 │                            │                                  │   numBounces, shadingMethod  │
 │                            │◄─────────────────────────────────┤   samplesDone, the times     │
 │ Owns, outside the store:   │   settings, read with getState() └──────────────┬───────────────┘
 │   camera and controls      │                                                 │ selectors
 │   render targets, textures │                                                 ▼
 │   sample counter           │                                    ProgressPill and SettingsPanel
 └────────────────────────────┘                                    re-render when a value changes
```

Everything else lives in React Three Fiber and `PathTracer`: the camera, the render targets, the textures and the sample counter. These change every rendering tick, and storing them in the store would re-render React on each change for no benefit.

---

## 7. Hosting & CI/CD

The app is fully client-side rendered, with the default Vite React setup and no server-side rendering. `dist/` is static HTML, JavaScript, CSS and the GLSL shaders bundled into the JavaScript, so an S3 bucket behind a CloudFront distribution serves it with no server runtime.

- **The example `.glb` scenes live in a second, private S3 bucket, not in git.** CloudFront serves it at `/scenes/*` through the same Origin Access Control as the site bucket, and the bucket policy allows only this distribution to read it. A separate bucket keeps the scenes out of the `deploy` job's `--delete` sync, and the deploy role has no access to it, so a deploy cannot remove a scene. Only the owner's own AWS credentials can write to it. The cost is that anyone who loads the site can fetch `/scenes/*.glb`, because a browser app holds no credentials to prove otherwise.
- **The `deploy` job sets a `Cache-Control` header on every upload, so there is no cache to invalidate.** CloudFront (AWS's content delivery network, or CDN) sits in front of the bucket. Files in `dist/assets/` have a content hash in their name, so they are marked immutable for a year and a new build uploads new names. Every other file keeps a fixed name, so it is marked `no-cache`, and CloudFront and browsers check the bucket for a newer copy before reusing it. A deploy is visible at once.
- **CI deploys on every push to `main` that changes built files.** The `build` job gates the `deploy` job, and the deploy assumes an AWS role through GitHub's OIDC token, so the repo stores no long-lived AWS keys.
- **Terraform in `infra/` defines the AWS resources, and the `apply` job in `.github/workflows/terraform.yml` applies it on merge to `main`.** Every change is then reviewed in a pull request, and a resource deleted by hand is put back on the next apply. That matters most for the DNS record that AWS Certificate Manager (ACM) needs to renew the site's certificate, because a missing record makes the renewal fail and the certificate expire.
- **Terraform keeps its state in its own S3 bucket, `webgl-ray-tracer-tfstate-<account id>`.** A dedicated bucket keeps the Terraform role away from the state of other projects. The bucket is created by hand once, because Terraform can't store state in a bucket that doesn't exist yet.
- **The site has its own ACM certificate for `webgl-ray-tracer.orky.net`, not the wildcard `*.orky.net` one.** A certificate shared with the `d3d-to-webgl` site would tie the two sites together, so a mistake in one repo could expire the other site's certificate. CloudFront reads certificates only from us-east-1, so Terraform creates this one there.
- **Terraform does not own the hosted zone or the GitHub OIDC provider.** Other projects in the account use both, so a change here must not be able to delete them.
- **The `apply` job runs as its own AWS role, `github-actions-webgl-ray-tracer-terraform`.** That role can change Identity and Access Management (IAM) objects for the deploy role and policy only, and can change only CloudFront distributions and ACM certificates tagged `Project=webgl-ray-tracer`. The cost is that anyone who can merge to `main` can change those two, and the role itself is created by hand ([Managing AWS with Terraform](RUNBOOK.md#3-managing-aws-with-terraform)).
- **A push that changes only Markdown, `LICENSE` or files under `infra/` skips CI and deploy.** The built `dist/` would be identical, so the sync would do nothing. A deploy running while the `apply` job changes the same bucket, distribution or role could also fail partway.

---

## 8. Styling

Components are styled with Tailwind CSS utility classes in the JSX, not with CSS modules or Sass. The markup and its look then change in one place, and a responsive layout is a breakpoint prefix on the element it affects (`md:flex-row`) rather than a media query in a second file.

- **The cost is long `className` strings.** A string shared by several elements in one file goes into a constant above the component.
- **The range slider track and thumb stay as CSS** in `src/styles/globals.css`, because Tailwind has no utilities for the vendor pseudo-elements that style them.

---

## 9. Layout

The render view fills the whole screen, and everything else floats over it.

```text
 desktop                                       phone in portrait
 ┌────────────────────────────────────────┐    ┌──────────────────────┐
 │ ProgressPill        save, theme, About │    │ ProgressPill buttons │
 │                                        │    │                      │
 │            Viewport                    │    │      Viewport        │
 │         (the whole of main)            │    │                      │
 │                                        │    ├──────────────────────┤
 │ SettingsPanel                          │    │ SettingsPanel        │
 └────────────────────────────────────────┘    └──────────────────────┘
   the floating layers sit over Viewport        the card becomes a bottom sheet
   and never change its size
```

- **The view has no bars.** A header and a footer would take 100 to 200 px of height, most of it on a phone, for controls that sit idle while the image converges. A floating readout and a floating settings card cost no height, at the price of covering part of the image.
- **The readout shows progress and the card holds the controls.** `src/components/hud.tsx` is a pill at the top left with the circular progress ring, the sample counter, the timing counters and the canvas size in pixels, plus save, theme and About buttons at the top right. The ring is the primary indicator, because a render converges over minutes and how far along it is matters more than any single setting. On a phone the pill shrinks to the ring, the sample count and the time left.
- **The settings card collapses.** `src/components/settingsPanel.tsx` is a card at the bottom left with a row of scene cards, a slider and a number field for each of field of view, lens radius, focus distance, samples and bounces, plus the Flat/Phong control. On a phone in landscape the card is wider, with the scene cards and the Flat/Phong control in a column beside the sliders, so it fits the short window without scrolling. Its title bar collapses it to a small Settings button, so the whole image can be seen. On a phone in portrait the open card is a bottom sheet across the full width.
- **The theme is a `dark` class on the `<html>` element.** `src/lib/hooks/useTheme.ts` sets it from the saved choice, or from the operating system's setting on a first visit, and a button at the top right switches it. Tailwind's `dark:` variant and the color variables in `src/styles/globals.css` follow the class, so no reload is needed. The render itself does not change, because only the floating controls have a theme.
- **The save button is enabled only at 100%.** It downloads the canvas as a PNG at the drawing-buffer size, so the file never contains the floating elements or a half-converged image. The canvas is not created with `preserveDrawingBuffer`, which costs speed on some GPUs, so the button draws the display pass again just before it reads the canvas.
- **Every floating element is absolutely positioned.** The card, the readout and the About popover overlap the view, so opening or collapsing them never changes the canvas size, rebuilds the render targets or restarts accumulation.
- **The render view is capped at 2560 by 1440 CSS pixels from the `md` breakpoint up** (`src/lib/webgl/renderLimits.ts`). Every pixel is traced many times, so a maximized window on a 5K monitor, about 14.7 million pixels, would never converge. The cap is the size of a 1440p monitor, and a larger window shows the view centered. Phones are below the breakpoint, have few pixels, and use the whole window.
- **Resizing the window resizes the canvas and restarts the render.** The new size rebuilds the render targets and `PathTracer` restarts accumulation from zero samples. The resize is debounced by 200 ms, so dragging a window edge does not rebuild them on every rendering tick.
- **The canvas renders at one pixel per CSS pixel on every device.** A phone's screen has a device pixel ratio near 3, so its picture is softer than a desktop one, but a higher ratio would multiply the work per sample. Rotating the phone resizes the view, which rebuilds the render targets and restarts accumulation. The resize is debounced by 200 ms so the rotation animation does not rebuild them repeatedly.
- **GPU limits are checked against the loaded scene.** Phone GPUs often allow only 4096 or 8192 pixel textures, so the check compares the scene's real texture sizes with the GPU's limits, instead of demanding a fixed desktop-class minimum that would reject most phones. A failure is shown as a sentence in the view, because a blank canvas gives no hint. A lost WebGL context, which mobile GPUs trigger when a shader runs too long, shows a notice and restarts accumulation when the context returns.

---

## 10. Ray tracing milestones

The milestones follow Peter Shirley's three-book series [_Ray Tracing in One Weekend_](https://raytracing.github.io/), which adds one rendering feature at a time. A struck-through milestone is implemented. The others are still to do.

### 10.1 Book 1: Ray Tracing in One Weekend

The minimal path tracer.

| Milestone                                                                     | Notes                                                                                                                             |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ~~Camera ray per pixel with random jitter, averaged over many samples~~       | Samples accumulate progressively in a float texture.                                                                              |
| ~~Diffuse scattering with a bounce limit~~                                    | `randPosInUnitSphere` in `src/shaders/pathTrace.frag.glsl` picks the scatter direction.                                           |
| ~~Metal with fuzz~~                                                           | `reflectionRatio` and `reflectionGloss` blend glossy reflection with diffuse scattering.                                          |
| ~~Dielectrics: refraction, total internal reflection, Schlick approximation~~ | `rayBounceOffDielectricSurface` in `src/shaders/pathTrace.frag.glsl`.                                                             |
| ~~Adjustable field of view~~                                                  | The `cameraFov` setting.                                                                                                          |
| ~~Camera position and orientation~~                                           | The orbit controls move the camera.                                                                                               |
| ~~Intersectable objects~~                                                     | Triangles from glTF meshes replace the book's spheres.                                                                            |
| Gamma correction                                                              | `src/shaders/display.frag.glsl` outputs the linear average. The bundled scenes' materials and lights are tuned for linear output. |
| ~~Defocus blur (depth of field)~~                                             | The `lensRadius` and `focusDistance` settings.                                                                                    |

### 10.2 Book 2: Ray Tracing: The Next Week

Speed and a wider range of effects.

| Milestone                                 | Notes                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ~~Bounding volume hierarchy (BVH)~~       | Built in a Web Worker and walked with an explicit stack ([Scene loading & BVH](#3-scene-loading--bvh)). |
| ~~Emissive materials~~                    | A ray that hits an emissive surface ends.                                                               |
| Motion blur                               | Needs a random time per ray and moving objects.                                                         |
| Textures: checker, image and Perlin noise | Needs the glTF texture coordinates.                                                                     |
| Instancing                                | Each mesh has its own BVH, and the scene is flattened to world-space faces.                             |
| Volumes: smoke and fog                    | Needs a constant-density medium with random scatter distance.                                           |

### 10.3 Book 3: Ray Tracing: The Rest of Your Life

Noise reduction through principled sampling.

| Milestone                                                         | Notes                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| ~~Light sampling~~                                                | `sampleDirectLight` in `src/shaders/pathTrace.frag.glsl`. |
| Importance sampling with probability density functions (PDFs)     | Samples are not weighted by a density.                    |
| Mixture PDFs                                                      | Blends scatter sampling with light sampling.              |
| Orthonormal basis (ONB) for sampling around a surface normal      | Needed by cosine-weighted diffuse sampling.               |
| Material refactor around PDFs and a `scatter` and `emitted` split | `pathTrace` multiplies albedos along the path instead.    |
