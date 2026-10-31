# Runbook

How to run, check and deploy the app. [`AGENTS.md`](AGENTS.md) is what breaks if you don't know it; [`ARCHITECTURE.md`](ARCHITECTURE.md) is why it is shaped this way. Each fact lives in exactly one of the three.

- [1. Local development](#1-local-development)
  - [1.1 First-time setup](#11-first-time-setup)
  - [1.2 Dev server](#12-dev-server)
  - [1.3 Checks](#13-checks)
  - [1.4 Checking a render](#14-checking-a-render)
  - [1.5 Changing the scene](#15-changing-the-scene)
- [2. Deploying](#2-deploying)
- [3. Troubleshooting](#3-troubleshooting)

---

## 1. Local development

### 1.1 First-time setup

CI uses Node 24. Run `corepack enable` once so the `packageManager` field in `package.json` gives you the matching pnpm version, or install pnpm 10.33.0 yourself. Then install dependencies from the lockfile:

```bash
pnpm install --frozen-lockfile
```

`pnpm install` also runs `prepare`, which installs the Husky pre-commit hook.

### 1.2 Dev server

```bash
pnpm dev
```

Vite serves the app on `http://localhost:3000` and opens the browser. It needs a browser with WebGL 2 and a reasonably powerful GPU (roughly an Nvidia GeForce 1080 or better).

### 1.3 Checks

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `pnpm format`       | Applies Prettier to every file.            |
| `pnpm format:check` | Fails if Prettier would change a file.     |
| `pnpm lint`         | Runs ESLint.                               |
| `pnpm lint:fix`     | Runs ESLint and fixes what it can.         |
| `pnpm typecheck`    | Runs `tsc --noEmit`.                       |
| `pnpm build`        | Typechecks, then builds `dist/` with Vite. |
| `pnpm preview`      | Serves the built `dist/` locally.          |

The pre-commit hook runs `format-staged`, `lint` and `typecheck`. CI runs `format:check`, `lint`, `typecheck` and `build`. There is no test suite.

### 1.4 Checking a render

A shader, BVH or scene change needs a look in the browser, because nothing else catches it.

1. Run `pnpm dev` and open `http://localhost:3000`.
2. Open the browser console. `checkGpuLimits` logs the GPU limits, and `subDivide` warns if the BVH is too deep.
3. Wait for the pass counter to reach the sample setting. The image should converge from noise to a smooth scene.
4. Drag to orbit, then release. Accumulation should restart from pass 1.

### 1.5 Changing the scene

`public/suzanne.glb` is the only scene. To replace it, export a glTF binary (`.glb`) from Blender with Draco compression on, positions at 16 bits and normals at 12 bits. Set each material's base color, metallic, roughness and (for lights) emission strength, and (for glass) transmission and IOR. Then pass the new URL to `new Scene(...)` in `src/components/canvas.tsx`.

The Draco decoder in `public/draco/` is copied from `node_modules/three/examples/jsm/libs/draco/gltf/`. Copy the three files again after upgrading `three`, because the decoder must match the loader.

---

## 2. Deploying

Merging to `main` deploys. The `deploy` job in `.github/workflows/ci.yml` syncs `dist/` to the S3 bucket `webgl-ray-tracer.orky.net` once the `build` job passes ([Hosting & CI/CD](ARCHITECTURE.md#7-hosting--cicd)).

1. Open a pull request. CI runs `format:check`, `lint`, `typecheck` and `build`.
2. Merge it once CI is green.
3. Watch the run:

```bash
gh run list --branch main --limit 1
gh run watch
```

A merge that changes only Markdown or `LICENSE` starts no run. To redeploy without a code change, re-run the last `CI` workflow run on `main` from the Actions tab.

---

## 3. Troubleshooting

- **A blank canvas, with `EXT_color_buffer_float not supported` or a limit in the console.** The GPU or browser fails `checkGpuLimits` in `src/components/canvas.tsx`. Try another browser or a newer GPU.
- **The render is corrupted or has black holes, and the console says `BVH depth … reached the fragment shader's traversal stack limit`.** The tree is deeper than the shader's stack. Raise `bvhMaxStackSize` in `src/lib/webgl/scene.ts` and `BVH_MAX_STACK_SIZE` in `src/shaders/pathTrace.frag.glsl` together ([Rendering gotchas](AGENTS.md#3-rendering-gotchas)).
- **Wrong geometry or colors with no error.** The packed layout constants in `src/lib/webgl/scene.ts` and `src/shaders/pathTrace.frag.glsl` have drifted apart ([Rendering gotchas](AGENTS.md#3-rendering-gotchas)).
- **The `deploy` job fails at the credentials step.** Check that `secrets.AWS_DEPLOY_ROLE_ARN` is set and that the job still has `id-token: write` ([Workflow & deploy](AGENTS.md#51-workflow--deploy)).
