---
name: shader-layout-sync
description: Keep the TypeScript scene packer and the GLSL path tracer in agreement. Use whenever src/lib/webgl/packScene.ts, src/lib/webgl/sceneLayout.ts, src/lib/webgl/bvhWorker.ts or src/shaders/pathTrace.frag.glsl is edited, especially bvhMaxStackSize, BVH_MAX_STACK_SIZE, numFloatsPerFace, numFloatsPerBvhNode, numFloatsPerMaterial, numFloatsPerLight, maxBaseColorMaps, MAX_BASE_COLOR_MAPS or any *_INDEX constant.
---

# Shader layout sync

The two files define the same data layout and the same stack depth from both sides. A mismatch raises no error, and the render silently comes out wrong. The reasons are in [Rendering gotchas](../../../AGENTS.md#3-rendering-gotchas).

## Steps

1. **Stack depth.** `bvhMaxStackSize` in `src/lib/webgl/sceneLayout.ts` and `BVH_MAX_STACK_SIZE` in `src/shaders/pathTrace.frag.glsl` hold the same number.
2. **Face layout.** `numFloatsPerFace` and the order in which `packFaces` in `src/lib/webgl/bvhWorker.ts` writes its texels match `FACE_NRM_INDEX`, `VERTEX_*_POS_INDEX`, `VERTEX_*_NRM_INDEX`, `FACE_MATERIAL_INDEX` and `VERTEX_UV_*_INDEX`, and `numTexelsPerFace` equals `TEXELS_PER_FACE`. `faceVertex0Offset` in `src/lib/webgl/sceneLayout.ts` still points at vertex 0's position, which the CPU readers in `src/lib/webgl/bvhRaycast.ts` and `src/lib/webgl/wireframe.ts` use.
3. **BVH layout.** `numFloatsPerBvhNode` and the order in which `packBvhNodes` in `src/lib/webgl/bvhWorker.ts` writes its texels match `BVH_NODE_MIN_BOUNDS_INDEX`, `BVH_NODE_MAX_BOUNDS_INDEX` and `BVH_NODE_PAYLOAD_INDEX`. `bvhNodeMinOffset`, `bvhNodeMaxOffset` and `bvhNodePayloadOffset` in `src/lib/webgl/sceneLayout.ts` still point at the min corner, the max corner and the payload.
4. **Material layout.** `numFloatsPerMaterial` and the order in which `packMaterials` in `src/lib/webgl/packScene.ts` writes its texels match `MATERIAL_COLOR_INDEX` and `MATERIAL_ATTRIB_INDEX`. The color texel's `w` is the base color map slot, or -1 for none.
5. **Light layout.** `numFloatsPerLight` and the order in which `packLights` in `src/lib/webgl/packScene.ts` writes its texels match `LIGHT_VERTEX_0_INDEX`, `LIGHT_VERTEX_1_INDEX` and `LIGHT_VERTEX_2_INDEX`, and `lightsPerRow` and `numTexelsPerLight` equal `LIGHTS_PER_ROW` and `TEXELS_PER_LIGHT`.
6. **Base color maps.** These three hold the same slot count:
   - `maxBaseColorMaps` in `src/lib/webgl/sceneLayout.ts`.
   - `MAX_BASE_COLOR_MAPS` in `src/shaders/pathTrace.frag.glsl`.
   - The number of cases in the `switch` in `sampleBaseColorMap`, in the same shader file.
7. **Render check.** Follow [Checking a render](../../../RUNBOOK.md#14-checking-a-render) and watch for a console warning.
