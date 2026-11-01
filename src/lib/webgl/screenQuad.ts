/**
 * Builds a scene that draws one shader over the whole render target.
 *
 * Each render pass of the path tracer is a fragment shader that runs once per pixel, so the "scene" is a single
 * triangle that covers the screen. Its corners are already in clip space (-1 to 1), and the vertex shaders pass
 * them straight through, so the camera used to render it does not matter.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, OrthographicCamera, RawShaderMaterial, Scene } from 'three'

const clipSpaceTriangle = new BufferGeometry().setAttribute(
  'position',
  new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
)

export const screenQuadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

export function createScreenQuad(material: RawShaderMaterial): Scene {
  const mesh = new Mesh(clipSpaceTriangle, material)
  mesh.frustumCulled = false

  const scene = new Scene()
  scene.add(mesh)
  return scene
}
