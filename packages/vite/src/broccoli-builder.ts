import Plugin from 'broccoli-plugin';
import { spawn } from 'child_process';

export class Builder extends Plugin {
  build(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(`npx vite build --outDir ${this.outputPath}`, {
        cwd: process.cwd(),
        shell: true,
        stdio: 'inherit',
        env: { ...process.env, FORCE_BUILD_TESTS: 'true' },
      });
      child.on('exit', code => (code === 0 ? resolve() : reject(new Error('vite build failed'))));
    });
  }
}
