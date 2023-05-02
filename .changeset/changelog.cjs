'use strict';

/**
 * Modified version of
 * https://github.com/changesets/changesets/blob/main/packages/changelog-git/src/index.ts
 *
 * This is because we do not add changelog entries per-PR (upon merge), and we instead add them
 * later, (per changeset-recover, https://github.com/nullvoxpopuli/changeset-recover)
 *
 * All of the built-in changelog line generators provided by changesets assume a
 * "add changeset before merge" workflow, and add git/github references accordingly.
 *
 * Here, we ignore the commit, and just use the changeset summary.
 *
 * See docs here: https://github.com/changesets/changesets/blob/main/docs/modifying-changelog-format.md
 */
async function getReleaseLine(changeset, _type) {
  let [firstLine, ...futureLines] = changeset.summary.split('\n').map(l => l.trimRight());

  let returnVal = firstLine;

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map(l => `  ${l}`).join('\n')}`;
  }

  return returnVal;
}

async function getDependencyReleaseLine(changesets, dependenciesUpdated) {
  if (dependenciesUpdated.length === 0) return '';

  let changesetLinks = [`- Updated dependencies`];
  let updatedDependenciesList = dependenciesUpdated.map(
    dependency => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [...changesetLinks, ...updatedDependenciesList].join('\n');
}

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
