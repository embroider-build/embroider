import bind from 'bind-decorator';
import { Writable } from 'stream';
import { format } from 'util';

export class CaptureStream extends Writable {
  private gather = [] as (string | Buffer)[];
  _write(chunk: string | Buffer, _encoding: string, callback: (err?: any) => void) {
    this.gather.push(chunk);
    callback();
  }

  @bind
  log(msg: string, ...args: any[]) {
    this.gather.push(format(msg, ...args));
  }

  get output(): string {
    return this.gather
      .map(element => {
        if (typeof element === 'string') {
          return element;
        } else {
          return element.toString('utf8');
        }
      })
      .join('');
  }
}
