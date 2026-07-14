# Issue → fix workflow

How we record issues and get them fixed. The loop is: **file an issue → hand it to Claude Code → review the PR → merge.**

## 1. Record an issue

Open a new issue on GitHub and pick a template:

- **Bug report** — something broken.
- **Feature / enhancement** — a change or new capability.

Add labels so work can be prioritized:

- Type: `bug` / `enhancement` (the templates apply these automatically)
- Priority: `priority:high` / `priority:low`
- Optional: `claude` to mark issues you intend to hand to Claude Code

The bar for filing is low — a title and a sentence is enough. The more context (page, steps, a screenshot), the faster the fix.

## 2. Fix it with Claude Code

In a Claude Code session inside this repo:

> fix issue #12

Claude will:

1. Read the issue (`gh issue view 12`).
2. Create a branch and implement the fix.
3. Verify it — `pnpm run typecheck` and `pnpm run test` (see below for the test DB).
4. Open a pull request that closes the issue.

## 3. Review and merge

The PR triggers CI (`.github/workflows/ci.yml`): typecheck + tests against a fresh Postgres. Review the diff, wait for the green check, and merge. The linked issue closes automatically.

## One-time setup

- **GitHub CLI** (lets Claude read/open issues and PRs):
  ```
  winget install GitHub.cli
  gh auth login
  ```
- **Labels** (creates the label set used above):
  ```
  bash scripts/setup-labels.sh
  ```
- **Test database** (for `pnpm run test` locally): see the "Database & migrations" section of [CLAUDE.md](../CLAUDE.md).

## Want it more automated later?

Install the Claude GitHub App (`/install-github-app` in an interactive Claude Code session). Then commenting `@claude fix this` on an issue opens a fix PR automatically in the cloud — no local session needed. Good for handing issues off when you're not at your machine.
