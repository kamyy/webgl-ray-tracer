# Runbook

How to run, check and deploy the app. [`AGENTS.md`](AGENTS.md) is what breaks if you don't know it; [`ARCHITECTURE.md`](ARCHITECTURE.md) is why it is shaped this way. Each fact lives in exactly one of the three.

- [1. Local development](#1-local-development)
  - [1.1 First-time setup](#11-first-time-setup)
  - [1.2 Dev server](#12-dev-server)
  - [1.3 Checks](#13-checks)
  - [1.4 Checking a render](#14-checking-a-render)
  - [1.5 Preparing a scene](#15-preparing-a-scene)
  - [1.6 Adding a bundled scene](#16-adding-a-bundled-scene)
- [2. Deploying](#2-deploying)
- [3. Managing AWS with Terraform](#3-managing-aws-with-terraform)
  - [3.1 Create the state bucket and the Terraform role](#31-create-the-state-bucket-and-the-terraform-role)
  - [3.2 Apply for the first time](#32-apply-for-the-first-time)
  - [3.3 Changing the infrastructure](#33-changing-the-infrastructure)
- [4. Troubleshooting](#4-troubleshooting)

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

Vite serves the app on `http://localhost:3000`. Open that address in a browser with WebGL 2 and a reasonably powerful GPU (roughly an Nvidia GeForce 1080 or better).

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
2. Check that the view shows no error. A mesh whose BVH is too deep for the shader fails with a "too deeply nested" sentence in the view ([Troubleshooting](#4-troubleshooting)).
3. Wait for the sample counter to reach the sample setting. The image should converge from noise to a smooth scene.
4. Drag to orbit, then release. Accumulation should start over from zero samples.
5. Resize the window, or use the browser's device toolbar, and check the readout and the settings card in portrait and landscape, collapse the card, and open the About popover. The render should restart when the size changes. A window above the `md` breakpoint should show a view no larger than 2560 by 1440.

### 1.5 Preparing a scene

A user opens their own scene at run time. The settings card shows each bundled scene as a picture card, plus an "Open .glb" card that opens the browser's file picker. A file opened this way is loaded in the browser and never uploaded.

Export the scene from Blender as a glTF binary (`.glb`) with Draco compression on, positions at 16 bits, normals at 12 bits and texture coordinates at 14 bits. Blender's default of 12 bits for texture coordinates can shift an image by a texel or two on a large texture atlas. The renderer reads less of the file than Blender or a glTF viewer shows, so check the scene against this list first.

- **Lighting**
  - Make every light a mesh with an Emission strength above 0, such as a plane. The renderer only collects meshes, so Blender's point, sun, spot and area lamps give no light, and a scene lit only by them renders almost black.
  - Close the scene in, or add a large emissive mesh as a sky. A ray that leaves the scene returns black, so the World background adds no light.
- **Materials**
  - Set Metallic and Roughness as constant values. When a texture is plugged into either one, the exporter writes a factor of 1.0, and the renderer ignores the texture but reads the factor. The surface then renders as a full mirror or as fully rough.
  - Treat Metallic as the chance that a ray bounces like a mirror. At 0.3, 30% of rays reflect and the rest scatter diffusely. Roughness blurs only the mirror bounces, so it does nothing at Metallic 0.
  - Expect the Base Color to tint every bounce, mirror reflections included.
  - Set Transmission above 0.5 for glass, and set its IOR (index of refraction), which controls how strongly it bends light. A surface with Transmission at 0.5 or below renders as opaque.
- **Textures**
  - Plug images into Base Color only. Normal, metallic and roughness textures are ignored, so bake fine detail into the base color or model it.
  - Leave Emission Color unplugged on a surface that should not glow. An image plugged into it exports with an emission factor beside it, and the renderer turns the whole surface into a light of that single color.
  - Model cut-out shapes such as leaves and fences as geometry. An image's alpha is ignored, so an alpha-clipped leaf renders as a solid rectangle.
  - Give every textured mesh a UV map, the texture coordinates that place the image on each face. A mesh without one renders in a single color taken from a corner of the image, with no warning.
  - Use the Image Texture node's Extension setting and a Mapping node freely. Repeat, Extend and Mirror, and the mapping's offset, rotation and scale, all carry over.
  - Keep images as PNG, JPEG or WebP. A file whose textures were converted to KTX2, a GPU-compressed format, fails to load.
  - Use at most `maxBaseColorMaps` (in `src/lib/webgl/sceneLayout.ts`) base color textures. An image used with two different Extension settings counts as two. If a scene needs more, combine its images into one texture atlas, a single image holding them side by side, with Blender's texture baking. The atlas takes one slot. A texture that repeats across a surface can't go in the atlas, because its UVs run past its own region into the neighbouring images.
- **Geometry**
  - Join small objects into one mesh with Ctrl+J. Every mesh is padded to the size of the largest one, so many small meshes beside a large one waste memory.
  - Split a very large mesh into several. A single huge mesh can fail with the "too deeply nested" error in [Troubleshooting](#4-troubleshooting).
  - Shade Smooth only shows when the app's Shading method setting is Phong. The setting starts at Flat, which draws every face flat.

### 1.6 Adding a bundled scene

Upload the `.glb` exported in [Preparing a scene](#15-preparing-a-scene) to the scenes bucket with your own AWS credentials, under the `scenes/` key prefix. The `deploy` job never uploads scenes, so this is a manual step. The upload sets a one-year `Cache-Control` header, so give a changed scene a new file name and update its `url` in `src/lib/scenes.ts`. Overwriting a file would leave browsers and CloudFront serving the old copy.

```bash
aws s3 cp suzanne.glb s3://webgl-ray-tracer.orky.net-scenes/scenes/suzanne.glb --content-type model/gltf-binary \
  --cache-control 'public, max-age=31536000, immutable'
```

Put a small picture of the scene in `public/thumbnails/`, then add an entry to `scenes` in `src/lib/scenes.ts` with the scene's URL under `/scenes/`, the picture's URL and the camera's starting `view`. `pnpm dev` fetches `/scenes/*` from the deployed site through the proxy in `vite.config.ts`, so a scene must be uploaded before it shows locally.

The Draco decoder in `public/draco/` is copied from `node_modules/three/examples/jsm/libs/draco/gltf/`. Copy the three files again after upgrading `three`, because the decoder must match the loader.

---

## 2. Deploying

Merging to `main` deploys. The `deploy` job in `.github/workflows/ci.yml` syncs `dist/` to the S3 bucket named by the `SITE_BUCKET` repository variable with cache headers once the `build` job passes ([Hosting & CI/CD](ARCHITECTURE.md#7-hosting--cicd)).

```text
 pull request ──► build job ──► merge to main ──► build job ──► deploy job ──► S3 bucket ──► CloudFront
                  format:check                                   assumes AWS     webgl-ray-tracer
                  lint                                           role, syncs     .orky.net
                  typecheck                                      dist/
                  build
```

1. Open a pull request. CI runs `format:check`, `lint`, `typecheck` and `build`.
2. Merge it once CI is green.
3. Watch the run:

```bash
gh run list --branch main --limit 1
gh run watch
```

A merge that changes only Markdown, `LICENSE` or files under `infra/` starts no `CI` run. To redeploy without a code change, re-run the last `CI` workflow run on `main` from the Actions tab.

---

## 3. Managing AWS with Terraform

`infra/` holds the AWS resources behind the site: the site and scenes S3 buckets, the CloudFront distribution, the DNS records and the deploy role ([Hosting & CI/CD](ARCHITECTURE.md#7-hosting--cicd)). The first two steps are one-time setup, for recreating this stack in a fresh AWS account, which is also how a fork sets up its own. A fork first needs a Route 53 hosted zone for its domain in that account, with the domain delegated to it, and its own values for `domain_zone_name`, `hosted_zone_id` and `github_repo` in `infra/terraform.tfvars`. The site bucket is named after the hostname and S3 bucket names are global, so moving the same hostname to a new account needs the old bucket and DNS record deleted first. Do the steps in order before the `apply` job in `.github/workflows/terraform.yml` first runs, or it tries to create resources that already exist.

1. [Create the state bucket and the Terraform role](#31-create-the-state-bucket-and-the-terraform-role).
2. [Apply for the first time](#32-apply-for-the-first-time).
3. [Change the infrastructure](#33-changing-the-infrastructure) through pull requests from then on.

### 3.1 Create the state bucket and the Terraform role

Terraform cannot create the bucket that stores its state or the IAM role the `apply` job runs as. The account, the GitHub repo and the domain come from the signed-in AWS credentials, `gh` and `infra/terraform.tfvars`. Run the script once with admin AWS credentials and an authenticated `gh`:

```bash
infra/bootstrap/bootstrap.sh
```

It creates the `webgl-ray-tracer-tfstate-<account id>` bucket (versioned, encrypted, not public), the account's GitHub OIDC provider when it is missing, and the `github-actions-webgl-ray-tracer-terraform` role. It then sets the `AWS_TERRAFORM_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN` GitHub secrets and the `TFSTATE_BUCKET` and `SITE_BUCKET` GitHub variables. Running it again only creates what is missing and rewrites the role's policies from these files:

- `infra/bootstrap/permissions-policy.json`
- `infra/bootstrap/trust-policy.json`

### 3.2 Apply for the first time

Terraform creates every resource, including the site's own ACM certificate. Run this from `infra/` with admin credentials:

```bash
terraform init \
  -backend-config="bucket=webgl-ray-tracer-tfstate-<account id>" \
  -backend-config="key=webgl-ray-tracer.tfstate" \
  -backend-config="region=us-west-2"
terraform plan
terraform apply
```

The apply waits a few minutes while ACM validates the certificate. The role it creates has the name that `secrets.AWS_DEPLOY_ROLE_ARN` already points at.

The site stays empty until the next merge to `main` runs the `deploy` job in `.github/workflows/ci.yml`.

### 3.3 Changing the infrastructure

Edit `infra/`, open a pull request, and merge it. The `validate` job runs `terraform fmt -check` and `terraform validate` on the pull request. The `apply` job runs `terraform apply` once the change is on `main`. Do not edit these resources in the console or with the AWS CLI, because the next apply reverts the edit.

To preview a change before merging, run `terraform plan` from `infra/` after the `terraform init` command in [Apply for the first time](#32-apply-for-the-first-time).

---

## 4. Troubleshooting

- **The view shows a sentence about WebGL 2, a missing extension or a GPU limit.** The GPU or browser fails a check in `src/lib/webgl/checkGpuLimits.ts`. Try another browser or a newer GPU.
- **The view says `The scene could not be loaded: a mesh is too deeply nested for the renderer`.** A mesh's BVH tree is deeper than the shader's stack. Split the mesh in the file, or raise `bvhMaxStackSize` in `src/lib/webgl/sceneLayout.ts` and `BVH_MAX_STACK_SIZE` in `src/shaders/pathTrace.frag.glsl` together ([Rendering gotchas](AGENTS.md#3-rendering-gotchas)).
- **Wrong geometry or colors with no error.** The packed layout constants in `src/lib/webgl/sceneLayout.ts` and `src/shaders/pathTrace.frag.glsl` have drifted apart ([Rendering gotchas](AGENTS.md#3-rendering-gotchas)).
- **The `deploy` job fails at the credentials step.** Check that `secrets.AWS_DEPLOY_ROLE_ARN` is set and that the job still has `id-token: write` ([Workflow & deploy](AGENTS.md#51-workflow--deploy)).
