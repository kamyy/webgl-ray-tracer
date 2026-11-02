/**
 * The scenes the app can render, and where the camera starts in each.
 *
 * The two bundled scenes are glTF binaries in `public/`, each with a starting `view` that places the camera in the
 * scene's own units, where y is up. A scene the user opens from their own drive has no `view`, so `TracedScene` in
 * `src/components/viewport.tsx` frames it once it has loaded and its size is known.
 */

export const scenes: SceneInfo[] = [
  {
    id: 'suzanne',
    label: 'Suzanne',
    url: '/suzanne.glb',
    thumbnail: '/thumbs/suzanne.jpg',
    view: { eye: [0, 2, 10], target: [0, 2, 0] },
  },
  {
    id: 'tricycle',
    label: 'Tricycle',
    url: '/tricycle.glb',
    thumbnail: '/thumbs/tricycle.jpg',
    view: { eye: [0, 2, 10], target: [0, 1.5, 0] },
  },
]

export const defaultScene = scenes[0]

export interface SceneInfo {
  id: string
  label: string
  url: string
  thumbnail?: string // a small picture of the scene, for the scene cards
  view?: { eye: [number, number, number]; target: [number, number, number] }
}

// Makes a scene from a file the user picked. The browser serves the file from memory at an object URL, which stays valid
// until `chooseScene` in `src/components/renderSettings.tsx` frees it.
export function sceneFromFile(file: File): SceneInfo {
  return {
    id: `file:${file.name}:${file.size}:${file.lastModified}`,
    label: file.name,
    url: URL.createObjectURL(file),
  }
}

// Whether the scene came from the user's drive, and so holds an object URL that needs freeing.
export function isFileScene(scene: SceneInfo): boolean {
  return scene.url.startsWith('blob:')
}
