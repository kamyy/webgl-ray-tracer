# WebGL Ray Tracer

A path tracer that runs entirely in your browser. The GPU does the tracing in a WebGL 2 fragment shader, and the image sharpens pass by pass as more samples arrive. You can orbit the camera while it renders, change the settings live, and switch between light and dark mode.

Live at [https://webgl-ray-tracer.orky.net](https://webgl-ray-tracer.orky.net).

## 1. What you need

- A browser with WebGL 2 and the `EXT_color_buffer_float` and `EXT_float_blend` extensions. Recent Chrome, Firefox and Safari all qualify.
- A reasonably powerful GPU. A desktop card such as an Nvidia GeForce GTX 1080 converges in seconds to minutes. Phones work too, in portrait and landscape, but render at half the width and height and take longer.
- If something is missing, the page says what instead of showing a blank view.

## 2. Using it

| Action | Mouse                | Touch       |
| ------ | -------------------- | ----------- |
| Rotate | Left-drag            | One finger  |
| Pan    | Right-drag           | Two fingers |
| Zoom   | Wheel or middle-drag | Pinch       |

- **Progress** is the ring at the top left, with the pass count, elapsed time, time remaining and the average time per pass beside it. The view restarts at pass 0 whenever the camera, a setting or the window size changes.
- **Render settings** are in the card at the bottom left, and the chevron collapses it out of the way. They are field of view, samples per pixel, ray bounces, and Flat or Phong shading.
- The buttons at the top right switch the theme and open the About card with these controls and the license.

## 3. Running it locally

You need Node.js and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

Then open the address Vite prints. [`RUNBOOK.md`](RUNBOOK.md) covers the other commands, checking a render and deploying.

## 4. Your own scene

The app loads `public/suzanne.glb`, a glTF 2.0 file compressed with Draco. Replace it with any glTF scene whose materials use plain PBR factors. A non-zero `emissive` makes a light, `transmission` above 0.5 makes glass, and everything else is reflective, with `metalness` as the reflection ratio and `1 - roughness` as the gloss. Textures are ignored.

## 5. How it works

I went to Eric Haines's GDC 2019 talk, "A Fast Forward Through [Ray Tracing Gems](http://www.realtimerendering.com/raytracinggems)", where real-time ray tracing was the hot topic. Peter Shirley's [Ray Tracing in One Weekend](http://in1weekend.blogspot.com/2016/01/ray-tracing-in-one-weekend.html) came up in passing. Inspired by it, I wanted to see whether a ray tracer could run on the web, using the GPU through a fragment shader, which suits tracing rays in parallel almost perfectly.

What I ended up with is a path tracer. It fires many random rays through each pixel and averages them, which removes noise as the image converges. It is a brute force technique that costs time and compute, but it produces soft shadows, ambient occlusion and blurred reflections with no rendering tricks.

- **The scene** is loaded with three.js and React Three Fiber. A Web Worker builds a bounding volume hierarchy (BVH) for each mesh, so a large scene does not freeze the page, and the result is packed into float textures.
- **The shader** in `src/shaders/pathTrace.frag.glsl` does the tracing: random numbers, BVH traversal, ray and box and triangle intersection, and bouncing off diffuse, reflective and glass surfaces.
- **Each pass** adds one sample per pixel to a running sum in a float render target. The display shader divides the sum by the sample count and draws it.
- **Passes are drawn in strips**, one strip per animation frame, with the strip count adapting to the frame time. That keeps the page responsive and stops the browser from killing a shader that runs too long.
- **WebGL 2 features** it relies on are loops without fixed limits, which recursion-by-looping needs, texture arrays for the BVH trees, float texture formats, and `texelFetch` for exact texel lookups.

[`ARCHITECTURE.md`](ARCHITECTURE.md) explains the design decisions, and [`AGENTS.md`](AGENTS.md) lists the gotchas and conventions for working on the code.

## 6. License

[MIT](LICENSE). Copyright © 2026 Kam Y Yip.

Enjoy!

Kam
