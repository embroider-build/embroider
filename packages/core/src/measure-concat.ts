import type SourceMapConcat from 'fast-sourcemap-concat';
import { join } from 'path';
import { statSync } from 'fs';

export default class MeasureConcat {
  stats: { [filename: string]: number } = {};
  constructor(private name: string, private concat: SourceMapConcat, private baseDir: string) {}
  addFile(filename: string) {
    this.stats[filename] = statSync(join(this.baseDir, filename)).size;
    return this.concat.addFile(filename);
  }
  addSpace(contents: string) {
    this.stats['in-memory'] = (this.stats['in-memory'] || 0) + contents.length;
    return this.concat.addSpace(contents);
  }
  async end() {
    console.log(`Concatenated ${this.name}:`);
    console.log(
      Object.entries(this.stats)
        .sort((a, b) => b[1] - a[1])
        .map(([name, bytes]) => `  ${name}: ${bytes} bytes`)
        .join('\n')
    );
    return await this.concat.end();
  }
}
