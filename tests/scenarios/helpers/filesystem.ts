import fs from 'fs/promises';

export async function becomesModified({
  filePath,
  assert,
  fn,
}: {
  filePath: string;
  assert: Assert;
  fn: () => Promise<void>;
}) {
  let oldStat = (await fs.stat(filePath)).mtimeMs;

  await fn();

  let newStat = (await fs.stat(filePath)).mtimeMs;

  assert.notStrictEqual(
    oldStat,
    newStat,
    `Expected ${filePath} to be modified. Latest: ${newStat}, previously: ${oldStat}`
  );
}

export async function isNotModified({
  filePath,
  assert,
  fn,
}: {
  filePath: string;
  assert: Assert;
  fn: () => Promise<void>;
}) {
  let oldStat = (await fs.stat(filePath)).mtimeMs;

  await fn();

  let newStat = (await fs.stat(filePath)).mtimeMs;

  assert.strictEqual(
    oldStat,
    newStat,
    `Expected ${filePath} to be unchanged. Latest: ${newStat}, and pre-fn: ${oldStat}`
  );
}
