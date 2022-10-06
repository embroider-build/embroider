# Release Process

Release process is currently switching from release-it to https://github.com/changesets/changesets

## Notes

Used `changesets` to do release-2022-10-6.0. Didn't go smoothly.

1.  Generated a changeset file describing everything since last release.

    Scan for which packages were touched so nothing gets missed:

        git diff --stat v1.8.3..HEAD

    Find all PRs since previous release to summarize them

        git log v1.8.3..HEAD

        And search for "Merge pull"

2.  Used `changeset version`, manually moved all readme content from changeset into our top-level readme (because the defaults in `changesets` want to create per-package ones).

3.  Tried using `changeset publish` but that started publishing lots of unintended packages. Followed up by manually releasing the others.

4.  Noticed that `changeset version` bumped a dependency version in `@embroider/util` but didn't bump `@embroider/util`'s version. Had to update and release it manually.
