import { execaCommand } from 'execa';
import { listPublicWorkspaces } from './workspaces.js';

async function publish() {
  let publicWorkspaces = await listPublicWorkspaces();

  for (let workspace of publicWorkspaces) {
    console.info(`Publishing ${workspace}`);
    await execaCommand('npm publish --tag=unstable --verbose');
  }
}

publish();
