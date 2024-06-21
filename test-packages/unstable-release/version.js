import fse from 'fs-extra';
import { listPublicWorkspaces, currentSHA } from './workspaces.js';

/**
 * This is an I/O heavy way to do this, but hopefully it reads easy
 *
 * these functions change the CWD as they go, returnning to he previous
 * CWD via finally blocks upon finish.
 */
async function updateVersions() {
  let sha = await currentSHA();

  let publicWorkspaces = await listPublicWorkspaces();

  // Pick new versions for each package
  for (let workspace of publicWorkspaces) {
    console.info(`Setting version of ${workspace}`);
    await setVersion(sha, workspace);
  }
}

updateVersions();

////////////////////////////////////////////

const NEW_VERSIONS = {};

async function setVersion(sha, filePath) {
  let json = await fse.readJSON(filePath);

  // we need to at the very least bump the patch version of the unstable packages so
  // that ^ dependenies won't pick up the stable versions
  const [major, minor, patch] = json.version.split('.');

  json.version = `${major}.${minor}.${parseInt(patch) + 1}-unstable.${sha}`;

  NEW_VERSIONS[json.name] = json.version;

  await fse.writeJSON(filePath, json, { spaces: 2 });
}
