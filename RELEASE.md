# Release Process

1. You need a github token as `GITHUB_AUTH` environment variable.

2. Run `pnpm embroider-release explain-plan`. If there are unlabeled PRs that need to be released it will complain and show you a list of them. Each PR needs to be labeled with one of: 
    - breaking
    - enhancement
    - bug
    - documentation
    - internal

3. Once all the PRs are labeled, it will instead show you the release plan, explaining which packages are getting released, at which versions, and why.

4. If you disagree with the plan, you can modify the list of changes before using it to `explain-plan` or `prepare` a release:

    - `pnpm embroider-release gather-changes > /tmp/changelog`
    - edit `/tmp/changelog`
    - `pnpm embroider-release explain-plan --from-stdin < /tmp/changelog`

    For example, this can be necessary if a PR that's labeled `breaking` touches multiple packages and only one of those packages is actually a breaking change. In that case you can take the other package names out of the description of the PR.

5. Once you're happy with the plan, run `pnpm embroider-release prepare`. This will edit CHANGELOG.md, bump the version numbers in package.json files, and create a file named `.release-plan.json`. Make a PR with these changes.

6. Once the PR is merged, in a clean local repo at the merge commit, run `pnpm embroider-release publish`.

    