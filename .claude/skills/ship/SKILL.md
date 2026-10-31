---
name: ship
description: Commit, push, open a pull request and merge the reviewed working-tree changes. Use only when the user asks to ship, commit and merge, or to do the commit, PR and merge steps after reviewing the diff. Merging to main deploys to S3.
---

# Shipping reviewed changes

The user reviews changes in the working tree first, then asks for this. A merge to `main` deploys to the S3 bucket ([Deploying](../../../RUNBOOK.md#2-deploying)), so every step below is outward-facing. The rules are in [Git workflow](../../../AGENTS.md#53-git-workflow); this file is the order.

Do only the steps the user asked for. "Commit" stops after step 3. "Open a PR" stops after step 5. Merge only on a request that says merge or ship.

## Steps

1. **Confirm the tree.** Run `git status` and `git diff`. If the changes differ from what the user reviewed, stop and say so.
2. **Branch.** If on `main`, create a type-prefixed branch (`docs/…`, `fix/…`, `chore/…`). For a stacked PR, create it from the previous PR's branch instead.
3. **Commit.** One commit per logical step, each ending with the `Co-Authored-By` trailer from the session's attribution reminder. The Husky hook runs `format-staged`, `lint` and `typecheck`. If it fails, fix the cause and make a new commit.
4. **Push** the branch.
5. **Open the PR** with `gh pr create` (`--base <previous branch>` for a stacked PR, starting the description with "Stacked on #<number>"), ending the description with the "Generated with Claude Code" line from the same reminder.
6. **Wait for CI** with `gh pr checks --watch`. If a check fails, stop and report it.
7. **Merge** with `gh pr merge --merge`, then `git switch main && git pull`. For a stacked PR, merge only the bottom PR of the stack, then run `gh pr edit <next PR> --base main`.
8. **Report the deploy.** Run `gh run list --branch main --limit 1`. A merge that changed only Markdown or `LICENSE` starts no run, so say that instead.
