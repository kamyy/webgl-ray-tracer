---
name: shader-layout-sync
description: Keep the TypeScript scene packer and the GLSL path tracer in agreement. Use whenever src/lib/webgl/scene.ts or public/sample-fs.glsl is edited, especially bvMaxStackSize, BV_MAX_STACK_SIZE, numFloatsPerFace, numFloatsPerBV, numFloatsPerMtl or any *_INDEX constant.
---

# Shader layout sync

The two files define the same data layout and the same stack depth from both sides. A mismatch raises no error, and the render silently comes out wrong. The reasons are in [Rendering gotchas](../../../AGENTS.md#3-rendering-gotchas).

## Steps

1. **Stack depth.** `bvMaxStackSize` in `src/lib/webgl/scene.ts` and `BV_MAX_STACK_SIZE` in `public/sample-fs.glsl` hold the same number.
2. **Face layout.** `numFloatsPerFace` and the order the face loop writes its texels match `FACE_NRM_INDEX`, `VERTEX_*_POS_INDEX`, `VERTEX_*_NRM_INDEX` and `FACE_MTL_INDEX`.
3. **BVH layout.** `numFloatsPerBV` and the order the BVH loop writes its texels match `BV_MIN_BOUNDS_INDEX`, `BV_MAX_BOUNDS_INDEX` and `BV_PAYLOAD_INDEX`.
4. **Material layout.** `numFloatsPerMtl` and the order the material loop writes its texels match `MTL_ALBEDO_INDEX` and `MTL_ATTRIB_INDEX`.
5. **Render check.** Follow [Checking a render](../../../RUNBOOK.md#14-checking-a-render) and watch for a console warning.
