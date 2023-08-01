import { execaCommand } from 'execa';
import path from 'node:path';
import url from 'node:url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.join(__dirname, '../../../');

export async function buildDeclarations() {
  let callerDir = process.cwd();

  await execaCommand(
    `
    --declaration
    --declarationDir
    --emitDeclarationOnly
    --rootDir ${callerDir}/src/index.ts
    --declarationDir ${callerDir}/dist/types
    --skipLibCheck
    --experimentalDecorators
    --esModuleInterop
    --target esnext
    --moduleResolution nodenext
    --typeRoots ./node_modules/@types/,./types
  `,
    { cwd: repoRoot }
  );
}

buildDeclarations();
