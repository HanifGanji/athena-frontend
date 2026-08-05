---
name: git
description: Repository contribution workflow. Use when committing changes, creating branches or pull requests, merging work, or cleaning up completed branches.
---

# Git Contribution

1. Update `main`, then create a focused source branch. Never commit directly to `main`.
2. Commit scoped changes and push the source branch.
3. Open a pull request (MR) and wait for every required check to pass.
4. Squash-merge the MR into `main`; do not use a merge commit.
5. Delete the remote and local source branches, then update local `main`.
