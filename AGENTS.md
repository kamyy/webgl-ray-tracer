# WebGL Ray Tracer

A GPU path tracer that runs entirely in the browser through WebGL 2. React and TypeScript load the scene, build the bounding volume hierarchy (BVH) and handle camera input. A GLSL fragment shader traces the rays and accumulates progressive samples into a float texture.

**Read [`ARCHITECTURE.md`](ARCHITECTURE.md) for the "why" behind the design, and [`RUNBOOK.md`](RUNBOOK.md) for the commands to run and deploy it, before making changes.**

- [1. Writing docs and comments](#1-writing-docs-and-comments)
- [2. Structure](#2-structure)
- [3. Rendering gotchas](#3-rendering-gotchas)
- [4. Coding standards](#4-coding-standards)
- [5. CI & repo tooling](#5-ci--repo-tooling)
  - [5.1 Workflow & deploy](#51-workflow--deploy)
  - [5.2 Formatting & linting](#52-formatting--linting)
  - [5.3 Git workflow](#53-git-workflow)
  - [5.4 Testing](#54-testing)
- [6. State / what's next](#6-state--whats-next)

---

## 1. Writing docs and comments

- **Each fact lives in exactly one of the three docs.**
  - [`ARCHITECTURE.md`](ARCHITECTURE.md) is why — decisions, alternatives rejected, costs accepted.
  - [`RUNBOOK.md`](RUNBOOK.md) is how to run and operate it.
  - This file is what breaks if you don't know it: gotchas, conventions, and current state. Where a gotcha needs its rationale, name the other file instead of restating it.
- **Docs and code comments describe current behavior only** — not prior libraries, old version numbers, or "this used to fail with X." Use `git log` for this instead.
- **Write for a junior full-stack engineer.** Assume the reader knows TypeScript, React and HTTP but not this codebase or 3D graphics. Spell out an acronym or a piece of jargon the first time a doc or comment uses it, and say what a step is for rather than only what it does.
- **Be human readable — fact plus the non-obvious reason.** Shortest accurate statement; no walkthrough of alternatives or restating the same point from multiple angles.
- **Cut anything the reader wouldn't act on differently.**
  - A sentence that only reassures — that nothing goes wrong — costs the reader attention and changes nothing they do.
  - Mechanism a reader never invokes themselves costs the same: name the requirement it implies and drop the mechanism.
- **When asked why something is the way it is, answer in the conversation rather than by growing the doc.** Edit the doc only when the answer is a fact a reader needs at that spot, and then write the shortest version of it.
- **Write comments as real sentences, not em-dash-fused fragments.**
  - Each independent clause gets its own sentence with a period; don't join two of them with `—` where a period would do.
  - An em dash is fine for a single aside inside one sentence, not as a substitute for ending it.
- **One idea per sentence.**
  - When a comment has two reasons, two caveats, or a reason plus a caveat, give each its own sentence rather than nesting one inside the other's clause.
  - A sentence stacking multiple qualifiers is harder to parse than the same content split, even when every word is accurate.
- **Keep parallel facts in parallel shapes, and prefer positive verbs.**
  - Several facts hung off one subject only read cleanly when they're the same kind of fact. A failure condition, an action, and a conditional action need their own sentences.
  - Don't coordinate a negated verb with a positive one, as in "won't run unless you're signed in, and prints the account". The reader has to work out that the second half applies in the case the first half rules out.
- **Reference files by their full repo-relative path, not a bare filename** — `src/lib/webgl/scene.ts`, not `scene.ts`. Do this every time the file is named, even right next to an earlier mention that already gave the full path; don't rely on the reader having seen that earlier sentence.
- **A sentence naming more than one file path becomes a bulleted list instead, sorted, one path per line** — even where that costs a sub-bullet under the sentence introducing them.
  - Each path is then greppable, and adding or removing one touches one line of diff.
  - Write that introducing sentence as the rule the listed files share, rather than as a subject made of their names.
- **Name the subject instead of pointing at it.** The full-path rule applies to every subject, not just files.
  - "the root module", "this app", and "this config" all make the reader work out which thing is meant, and each one goes stale the moment that thing is renamed or split. Write `vite.config.ts`, or the `deploy` job, or whichever it is.
  - A bare "one" or "the GLSL ones" standing in for a noun from an earlier sentence has the same problem. Repeat the noun.
  - A demonstrative pointing at the immediately preceding noun in the same sentence is fine.
- **Never write a bare "job".** Name the GitHub Actions job: the `build` job, the `deploy` job.
- **Every heading is numbered — `## 2.`, `### 2.3` — and a `---` rule goes immediately before every `##`.**
  - The number is what tells the reader which section a subsection belongs to once its parent has scrolled off. The rule marks where each top-level section starts.
  - Headings stop at `###`, because GitHub renders `####` at body size, where it stops reading as a heading at all. Where a section needs steps, each step becomes a `###` of its own and the parent opens with an ordered list linking them.
  - Renumbering moves every anchor below the change, so inserting or reordering a section means repointing the links into the ones after it. The ToC labels carry the number; prose links keep the plain section name.
  - Put the rule under a blank line. Directly below text, `---` turns that text into a heading instead.
- **When prose names another section — in the same doc or a different one — link it, don't just quote or bold the name.**
  - Use `[Section name](#section-name)` for a same-file reference and `[Section name](OTHER.md#section-name)` across files, with the anchor GitHub/VS Code derive from the heading (lowercase, spaces to hyphens, punctuation stripped).
  - A plain quoted or bolded name silently goes stale the moment the target heading is renamed; a broken link is easier to spot in review.
- **A bare mention of one of the other root docs (`AGENTS.md`, `RUNBOOK.md`, `ARCHITECTURE.md`, `README.md`) gets linked to the file too** — ``[`AGENTS.md`](AGENTS.md)``, not just backtick text.
  - This doesn't extend to code file paths: those stay as inline code per the rule above, since linking every one would be churn for no navigational benefit.
- **A reply includes a plain-text diagram when it turns on order, ownership, or how parts connect.** Draw it with box-drawing characters in a `text` code block, the way the diagrams in [`ARCHITECTURE.md`](ARCHITECTURE.md) are drawn. Don't use Mermaid, because the Claude Code VS Code extension's chat panel shows it as raw source.
  - A plan.
  - An answer to a question about the codebase.
  - The actions the agent is about to take.
  - A request path, a state change, a render pass, or which piece of code reads which data needs a diagram.
  - A short list of independent edits stays prose.
  - A question a few sentences already answer stays prose.
  - Each box uses the same name the code uses.
  - The diagram shows a relationship the sentences beside it do not already state.
- **Diagrams in the docs are plain text in `text` code blocks, never Mermaid.** Plain text renders the same in GitHub, VS Code and the terminal.
  - Draw arrowheads with `►`, `◄`, `▲` and `▼`. The solid triangles `▶` and `◀` come out wider than the surrounding text in many fonts, which pushes the box sides on that row out of line.
  - Write a file's path on one line, even when that makes a column wider, because a path split across two lines can't be grepped.

---

## 2. Structure

A single Vite + React app, with no server runtime.

- `public/` — the GLSL shaders and the sample OBJ/MTL scene. Vite copies it into `dist/` as-is.
- `src/components/` — React components, each with a matching `*.module.scss`.
- `src/lib/math/` — vectors, matrices, rays, spheres and the `RefFrame` transform hierarchy.
- `src/lib/store/` — the Redux Toolkit store for UI and rendering-status state only.
- `src/lib/webgl/` — shader wrappers, textures, and scene loading with BVH construction.
- `src/types/` — shared types, including `CanvasVars` and the typings for the OBJ and MTL parsers.

`@/*` maps to `src/*` in both `vite.config.ts` and `tsconfig.json`.

---

## 3. Rendering gotchas

- **`bvMaxStackSize` in `src/lib/webgl/scene.ts` must equal `BV_MAX_STACK_SIZE` in `public/sample-fs.glsl`.**
  - The shader's BVH traversal stack is a fixed-size array with no bounds checking, so a deeper tree silently corrupts the render.
  - `subDivide` only calls `console.warn` when the limit is exceeded. It does not enforce it.
- **The packed texture layout is defined twice and the two copies must change together.**
  - `numFloatsPerFace`, `numFloatsPerBV` and `numFloatsPerMtl` in `src/lib/webgl/scene.ts` set the layout the CPU writes.
  - The `*_INDEX` constants in `public/sample-fs.glsl` set the layout the shader reads.
  - A mismatch renders wrong geometry or colors and reports no error.
- **GLSL files are fetched at runtime from `public/`, not bundled by Vite.** `Shader.init` in `src/lib/webgl/shader.ts` calls `fetch()`, so a renamed shader file breaks at runtime and `tsc` stays green.
- **Any camera, scene or parameter change calls `renderReset()` to restart accumulation at pass 0.** A new setting that affects the image needs the same reset, or the canvas blends old and new samples.
- **While a mouse button is held, only pass 1 renders.** Accumulation resumes on release. This keeps dragging responsive ([Rendering](ARCHITECTURE.md#2-rendering-pipeline)).
- **Material behavior is chosen by hardcoded MTL name matches in `Scene.init`** (`'light'`, `'glass'`, `'suzanne'`, `'teapot'`, `'ladder'`). A new scene with other material names renders every material as reflective.
- **Redux holds UI and render-status state only.** Camera transforms, textures and WebGL handles live in the `CanvasVars` ref (`src/types/canvasVars.ts`), because they change every frame and must not trigger React re-renders.
- **The app needs WebGL 2 with `EXT_color_buffer_float` and generous texture limits.** `GPU_MeetsRequirements` in `src/components/canvas.tsx` lists them. A GPU that fails the check leaves a blank canvas and only a console message.

---

## 4. Coding standards

- **Don't overengineer.** Solve the problem in front of you, not the general case it might become. Add no abstraction, config option, or extensibility hook for a second use case that doesn't exist yet. Add it when that use case actually shows up.
- **Prefer `function` declarations over arrow functions**, except closures assigned to a local (`const handleClick = () => {...}`), inline arguments (`.map(x => ...)`, `useEffect(() => {...})`), or an arrow function returned from a function (`return x => doSomething(x)`). Top-level: `export function foo() {}`, not `export const foo = () => {}`.
- **Use named exports. A file default exports only when the framework or tool that loads it accepts nothing else.** Config files for ESLint, Prettier and Vite are the usual cases.
  - Existing files such as `src/lib/webgl/scene.ts` default export a class. Leave those as they are unless the file is being rewritten anyway.
- **`if`/`for`/`while`/`do` bodies always use a `{ }` block** — never `if (x) return`.
- **At file scope, constants and variables come first, then types and interfaces, then functions.** A reader meets the values and shapes a file works with before the code that uses them.
  - Module state such as `let cached` counts as a variable.
  - A `const` holding a function or component counts as a function.
  - A constant computed by calling a helper in the same file sits directly below that helper, because it can't run before the helper's own inputs exist.
- **Separate logical groups at file scope with a banner.** When a file's top-level declarations cover more than one subject, a banner names each group. A file with one subject has none.
  - The constants-then-types-then-functions order stays uncommented. So do the steps inside a function, which a blank line already separates.
  - The banner is `// --- Name ` in TypeScript, JavaScript and GLSL, and `/* --- Name ` closed by ` */` in CSS and SCSS. Dashes pad the line to 88 characters.
  - The name is the subject, in the words the code uses. A sentence that explains the group stays a normal comment directly under the banner.
- **Define a file's sub-components and helpers above the component that uses them**, so a file reads bottom-up to its main export. A sub-component used by another sub-component goes above that one too.
- **A helper that only one file uses is defined in that file, not in a module of its own.** Once a second file uses it, move it under `src/lib/`.
- **Export a name only when another file imports it.** A function, constant, type or interface that nothing outside its own file uses stays unexported.
- **Every custom hook gets its own file in `src/lib/hooks/`, named after the hook** (`src/lib/hooks/useCanvasSize.ts`). This holds even for a hook only one file uses.
- **Split a function once it grows too large to take in at once, or does more than one job.**
  - Pull each self-contained piece out into a helper, a sub-component, or a custom hook for stateful logic.
  - Stop where a further split would make the pieces pass shared state back and forth.
- **Every new source file opens with a header: a one-line summary of what the file is for, a blank line, then a short paragraph a junior full-stack engineer can follow.** The paragraph says what the file does, where it fits (which component, render pass or shader stage), and any reason for its existence that the code doesn't show.
  - Don't list a file's callers in its header. That list goes stale, and grep finds them.
  - TypeScript and JavaScript headers are a `/** … */` block above the imports. An exported item's doc comment is a `/** … */` block too, so editors show it on hover. Every other comment is `//` lines. A comment inside JSX stays `{/* … */}`, since JSX has no line comment.
  - GLSL headers are a `//` block at the top of the file.
  - Existing files get a header when they are substantially edited, not in a sweep.
- **Separate a function body's logical groups with a blank line.** A reader should be able to see where one step ends and the next begins without reading every statement.
  - In a component or hook, the groups are: context and data hooks, each piece of state with the values derived from it, effects, handlers, render branches, then the `return`.
  - A blank line goes before a comment that introduces the next statements, after a closing `}` that is followed by more statements, and before a `return` that ends a body of more than one statement.
  - A guard stays attached to the value it checks. The statements inside one `case` of a `switch` stay together.
- **Decide which element renders before the `return`, not inside the JSX.** Branch with `if`/`else`/`switch` or a ternary into a `React.ReactNode` variable, then place `{variable}` in the JSX where the element belongs.
  - Write `let hint: React.ReactNode = null; if (failed) { hint = <p>…</p>; }` and then `{hint}`. Never render an element through `&&`, `||`, or `??` in the JSX body.
  - A branch Prettier keeps on one line can stay inline as a ternary: `{loading ? <Spinner /> : null}`. Once Prettier wraps it over several lines, it moves out to a variable.
  - A ternary that picks a string or a prop value (`className`, label text) is not a render branch and stays inline.

---

## 5. CI & repo tooling

### 5.1 Workflow & deploy

`.github/workflows/ci.yml` runs on every push and pull request to `main`.

- The `build` job runs `format:check`, `lint`, `typecheck` and `build`. A push to `main` also uploads `dist/` as an artifact.
- The `deploy` job needs the `build` job and runs only for a push to `main`. It assumes the AWS role in `secrets.AWS_DEPLOY_ROLE_ARN` and syncs `dist/` to the S3 bucket `webgl-ray-tracer.orky.net`.
- **Merging to `main` deploys.** Never run `aws s3 sync` by hand. The `deploy` job is the only path ([Deploying](RUNBOOK.md#2-deploying)).
- **A push that changes only Markdown or `LICENSE` starts no run at all.** The `push` trigger in `.github/workflows/ci.yml` lists them under `paths-ignore`. The `pull_request` trigger has no filter, so a docs PR still gets a CI result.
- **The `deploy` job's `id-token: write` permission is what lets it assume the AWS role.** Removing it fails the deploy at the credentials step.

### 5.2 Formatting & linting

- **Run `pnpm format` and `pnpm lint:fix` before committing.** CI's `format:check` and `lint` fail on anything they would change.
- Prettier (`prettier.config.mjs`) uses no semicolons, single quotes, no parentheses around a single arrow parameter, and `printWidth: 120`. `prettier-plugin-organize-imports` sorts imports.
- Husky's `.husky/pre-commit` runs `format-staged`, `lint` and `typecheck` in order. A failure in any of them blocks the commit.
- Prettier also formats Markdown. Markdown prose has no maximum width: one line per paragraph or list item, since GitHub reflows paragraphs and fixed wraps only add diff noise.

### 5.3 Git workflow

- **`main` is push-protected.** All changes land via PR, including edits to docs and config.
- **Leave changes uncommitted for the user to review.** Commit, push, open the PR and merge only when asked. Each request authorizes that one action, so "commit" does not mean "merge". The `ship` skill (`.claude/skills/ship/SKILL.md`) is the procedure once the user asks for all of them.
- **Branch names are type-prefixed** (`chore/`, `refactor/`, `docs/`, `fix/`, …).
- **Split a change into one commit per logical step**, so a reviewer can read each one on its own.
- **Commit messages end with the `Co-Authored-By` trailer and PR descriptions end with the "Generated with Claude Code" line**, using the exact lines the session's attribution reminder gives.
- **Merge with `gh pr merge --merge`**, not squash or rebase, to preserve scoped commits on `main`.
- **Update a stale PR with `git rebase main`** then `git push --force-with-lease`, not by merging `origin/main` into the branch.

### 5.4 Testing

There is no test suite or runner. `pnpm lint`, `pnpm typecheck` and `pnpm build` cover what CI checks. A change to the shaders or the scene code also needs a manual render in the browser ([Checking a render](RUNBOOK.md#14-checking-a-render)).

---

## 6. State / what's next

The path tracer renders the bundled Suzanne scene and a few other models chosen by name. Known gaps:

1. **No generic material format.** Materials depend on hardcoded names ([Rendering gotchas](#3-rendering-gotchas)).
2. **No automated tests.** Shader and BVH regressions only show up in a manual render.
