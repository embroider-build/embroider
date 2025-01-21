import { spawn } from 'child_process';

export function buildOnce(outputPath: string, emberEnv: 'development' | 'test' | 'production'): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      `npx vite build --outDir ${outputPath} --mode ${emberEnv === 'production' ? 'production' : 'development'}`,
      {
        cwd: process.cwd(),
        shell: true,
        stdio: 'inherit',
        env: { ...process.env },
      }
    );
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('vite build failed'))));
  });
}
