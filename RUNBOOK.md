# Runbook

How to run, check and deploy the app. [`AGENTS.md`](AGENTS.md) is what breaks if you don't know it; [`ARCHITECTURE.md`](ARCHITECTURE.md) is why it is shaped this way. Each fact lives in exactly one of the three.

- [1. Local development](#1-local-development)
  - [1.1 First-time setup](#11-first-time-setup)
  - [1.2 Dev server](#12-dev-server)
  - [1.3 Checks](#13-checks)
  - [1.4 Checking a render](#14-checking-a-render)
  - [1.5 Changing the scene](#15-changing-the-scene)
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
2. Open the browser console. `BvhNode.subDivide` in the BVH worker warns if the BVH is too deep.
3. Wait for the pass counter to reach the sample setting. The image should converge from noise to a smooth scene.
4. Drag to orbit, then release. Accumulation should restart at pass 0.
5. Resize the window, or use the browser's device toolbar, and check the readout and the settings card in portrait and landscape, collapse the card, and open the About popover. The render should restart when the size changes. A window above the `md` breakpoint should show a view no larger than 2560 by 1440.

### 1.5 Changing the scene

`public/suzanne.glb` is the only scene. To replace it, export a glTF binary (`.glb`) from Blender with Draco compression on, positions at 16 bits and normals at 12 bits. Set each material's base color, metallic, roughness and (for lights) emission strength, and (for glass) transmission and IOR. Then pass the new URL to `useGLTF` in `src/components/viewport.tsx`.

The Draco decoder in `public/draco/` is copied from `node_modules/three/examples/jsm/libs/draco/gltf/`. Copy the three files again after upgrading `three`, because the decoder must match the loader.

---

## 2. Deploying

Merging to `main` deploys. The `deploy` job in `.github/workflows/ci.yml` syncs `dist/` to the S3 bucket `webgl-ray-tracer.orky.net` with cache headers once the `build` job passes ([Hosting & CI/CD](ARCHITECTURE.md#7-hosting--cicd)).

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

`infra/` holds the AWS resources behind the site: the S3 bucket, the CloudFront distribution, the DNS records and the deploy role ([Hosting & CI/CD](ARCHITECTURE.md#7-hosting--cicd)). Do the first two steps once, in order, before merging the pull request that adds `infra/`. Otherwise the `apply` job in `.github/workflows/terraform.yml` tries to create resources that already exist.

1. [Create the state bucket and the Terraform role](#31-create-the-state-bucket-and-the-terraform-role).
2. [Apply for the first time](#32-apply-for-the-first-time).
3. [Change the infrastructure](#33-changing-the-infrastructure) through pull requests from then on.

### 3.1 Create the state bucket and the Terraform role

Terraform cannot create the bucket that stores its state or the IAM role the `apply` job runs as. Run the script once with admin AWS credentials and an authenticated `gh`:

```bash
infra/bootstrap/bootstrap.sh
```

It creates the `webgl-ray-tracer-tfstate-570846794821` bucket (versioned, encrypted, not public) and the `github-actions-webgl-ray-tracer-terraform` role, then stores the role's ARN in the `AWS_TERRAFORM_ROLE_ARN` GitHub secret. Running it again only creates what is missing and rewrites the role's policies from these files:

- `infra/bootstrap/permissions-policy.json`
- `infra/bootstrap/trust-policy.json`

### 3.2 Apply for the first time

Terraform creates every resource, including the site's own ACM certificate. Run this from `infra/` with admin credentials:

```bash
terraform init \
  -backend-config="bucket=webgl-ray-tracer-tfstate-570846794821" \
  -backend-config="key=webgl-ray-tracer.tfstate" \
  -backend-config="region=us-west-2"
terraform plan
terraform apply
```

The apply waits a few minutes while ACM validates the certificate. The role it creates has the name that `secrets.AWS_DEPLOY_ROLE_ARN` already points at, so that secret needs no change.

The site stays empty until the next merge to `main` runs the `deploy` job in `.github/workflows/ci.yml`.

### 3.3 Changing the infrastructure

Edit `infra/`, open a pull request, and merge it. The `validate` job runs `terraform fmt -check` and `terraform validate` on the pull request. The `apply` job runs `terraform apply` once the change is on `main`. Do not edit these resources in the console or with the AWS CLI, because the next apply reverts the edit.

To preview a change before merging, run `terraform plan` from `infra/` after the `terraform init` command in [Apply for the first time](#32-apply-for-the-first-time).

---

## 4. Troubleshooting

- **The view shows a sentence about WebGL 2, a missing extension or a GPU limit.** The GPU or browser fails a check in `src/lib/webgl/checkGpuLimits.ts`. Try another browser or a newer GPU.
- **The render is corrupted or has black holes, and the console says `BVH depth … reached the fragment shader's traversal stack limit`.** The tree is deeper than the shader's stack. Raise `bvhMaxStackSize` in `src/lib/webgl/sceneLayout.ts` and `BVH_MAX_STACK_SIZE` in `src/shaders/pathTrace.frag.glsl` together ([Rendering gotchas](AGENTS.md#3-rendering-gotchas)).
- **Wrong geometry or colors with no error.** The packed layout constants in `src/lib/webgl/sceneLayout.ts` and `src/shaders/pathTrace.frag.glsl` have drifted apart ([Rendering gotchas](AGENTS.md#3-rendering-gotchas)).
- **The `deploy` job fails at the credentials step.** Check that `secrets.AWS_DEPLOY_ROLE_ARN` is set and that the job still has `id-token: write` ([Workflow & deploy](AGENTS.md#51-workflow--deploy)).
