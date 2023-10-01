import { execaCommand } from 'execa';
import path from 'node:path';
import url from 'node:url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.join(__dirname, '../../');

export async function buildDeclarations() {
  let callerDir = process.cwd();

  await execaCommand(
    `pnpm tsc
    --declaration
    --emitDeclarationOnly
    --files "${callerDir}/src/**/*"
    --declarationDir "${callerDir}/dist/types"
    --skipLibCheck
    --experimentalDecorators
    --esModuleInterop
    --target esnext
    --moduleResolution nodenext
    --typeRoots ./node_modules/@types/,./types
  `.replaceAll(/\n/g, ''),
    { cwd: repoRoot, stdio: 'inherit' }
  );
}

buildDeclarations();
