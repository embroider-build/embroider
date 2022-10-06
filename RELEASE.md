# Release Process

Release process is currently switching from release-it to https://github.com/changesets/changesets

Scan for which packages were touched so nothing gets missed:

    git diff --stat v1.8.3..HEAD

Find all PRs since previous release to summarize them

    git log v1.8.3..HEAD

    And search for "Merge pull"
