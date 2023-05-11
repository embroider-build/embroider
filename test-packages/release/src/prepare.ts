import { execa } from 'execa';

async function main() {}

main().then(
  () => {
    process.exit(0);
  },
  err => {
    console.error(err);
    process.exit(-1);
  }
);
