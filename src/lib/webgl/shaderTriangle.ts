/**
 * Builds a shader triangle: a fragment shader that runs once for every pixel of a render target.
 *
 * A GPU draws triangles, so a shader that should cover every pixel is drawn on one triangle that is larger than the
 * target. The Rendering pipeline section of `ARCHITECTURE.md` has a diagram.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, OrthographicCamera, RawShaderMaterial, Scene } from 'three'

// Each row is one vertex (x, y, z) in clip space, where the target spans -1 to 1 on both axes. The triangle reaches 3
// on purpose, because the GPU clips the excess.
// prettier-ignore
const clipSpaceTrianglePositions = [
  -1, -1, 0, // bottom left
   3, -1, 0, // bottom right, beyond the target
  -1,  3, 0, // top left, beyond the target
]

const clipSpaceTriangle = new BufferGeometry().setAttribute(
  'position',
  new Float32BufferAttribute(clipSpaceTrianglePositions, 3),
)

// The camera used to render a shader triangle. Its view does not matter, because the vertex shaders pass clip-space
// positions straight through.
export const orthographicCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

// A fragment shader that covers the whole target, with the scene that draws it.
export interface ShaderTriangle {
  material: RawShaderMaterial
  scene: Scene
}

export function createShaderTriangle(material: RawShaderMaterial): ShaderTriangle {
  const mesh = new Mesh(clipSpaceTriangle, material)
  mesh.frustumCulled = false // the vertex shaders ignore the camera, so a test against its frustum would be wrong

  const scene = new Scene()
  scene.add(mesh)
  return { material, scene }
}
