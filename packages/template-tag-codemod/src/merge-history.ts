import { execSync as _execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

export interface MergeHistoryOptions {
  beforeCommit: string;
  afterCommit: string;
  outputBranch: string;
  allowOverwrite: boolean;
}

function execSync(cmd: string, opts?: { cwd?: string }) {
  return _execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts });
}

function revParse(name: string, opts?: { cwd?: string }) {
  try {
    let output = execSync(`git rev-parse --revs-only ${name} --`, opts);
    return output.trim();
  } catch (err) {
    if (!/bad revision/.test(err.stderr)) {
      throw err;
    }
    return null;
  }
}

function head(opts?: { cwd?: string }): string {
  let sha = revParse('HEAD', opts);
  if (!sha) {
    throw new Error(`bug: could not rev-parse HEAD`);
  }
  return sha;
}

interface Endpoints {
  beforeSha: string;
  afterSha: string;
}

function resolveEndpoints(opts: MergeHistoryOptions): Endpoints {
  let beforeSha = revParse(opts.beforeCommit);
  if (!beforeSha) {
    console.error(`Cannot locate a commit named "${opts.beforeCommit}"`);
    process.exit(-1);
  }
  let afterSha = revParse(opts.afterCommit);
  if (!afterSha) {
    console.error(`Cannot locate a commit named "${opts.afterCommit}"`);
    process.exit(-1);
  }
  return { beforeSha, afterSha };
}

function setupWorkDir(opts: MergeHistoryOptions, endpoints: Endpoints): string {
  let workDir = resolve(tmpdir(), 'template-tag-codemod-history');
  if (existsSync(workDir)) {
    rmSync(workDir, { recursive: true });
    execSync(`git worktree prune`);
  }

  if (revParse(opts.outputBranch)) {
    if (opts.allowOverwrite) {
      execSync(`git branch -D ${opts.outputBranch}`);
    } else {
      console.error(
        `Output branch "${opts.outputBranch}" already exists. If you really want to overwrite it, pass --allowOverwrite`
      );
      process.exit(-1);
    }
  }

  execSync(`git worktree add ${workDir} ${endpoints.beforeSha}`);
  return workDir;
}

function listFiles(endpoints: Endpoints): string[] {
  return execSync(`git diff-tree -r --name-only ${endpoints.beforeSha} ${endpoints.afterSha}`)
    .split('\n')
    .filter(Boolean);
}

function gitShow(commitIsh: string, filename: string): string {
  return execSync(`git show ${commitIsh}:${filename}`);
}

const newExtension = /\.g[jt]s$/;

function* newFiles(changedFiles: string[]) {
  for (let filename of changedFiles) {
    if (newExtension.test(filename)) {
      yield filename;
    }
  }
}

function applyMoves(workDir: string, changedFiles: string[], sourceExtensions: string[]) {
  for (let filename of newFiles(changedFiles)) {
    for (let sourceExtension of sourceExtensions) {
      let sourceFilename = filename.replace(newExtension, sourceExtension);
      if (changedFiles.includes(sourceFilename)) {
        execSync(`git mv ${sourceFilename} ${filename}`, { cwd: workDir });
        console.log(`renamed ${sourceFilename} -> ${filename}`);
      }
    }
  }
}

function expectMergeConflicts(cb: () => void) {
  try {
    cb();
  } catch (err) {
    if (!/Merge conflict/.test(err.output)) throw err;
  }
}

function listConflicts(opts?: { cwd: string }) {
  return execSync(`git diff --name-only --diff-filter=U --relative`, opts).split('\n').filter(Boolean);
}

function concatenateMerge(workDir: string, jsRenameCommit: string, hbsRenameCommit: string) {
  for (let filename of listConflicts({ cwd: workDir })) {
    writeFileSync(
      resolve(workDir, filename),
      gitShow(jsRenameCommit, filename) + '\n' + gitShow(hbsRenameCommit, filename)
    );
    execSync(`git add ${filename}`, { cwd: workDir });
    console.log(`resolved merge conflict in ${filename}`);
  }
}

function applyCodemod(workDir: string, changedFiles: string[], endpoints: Endpoints) {
  for (let filename of newFiles(changedFiles)) {
    writeFileSync(resolve(workDir, filename), gitShow(endpoints.afterSha, filename));
    execSync(`git add ${filename}`, { cwd: workDir });
    console.log(`applied codemod output to ${filename}`);
  }
}

function addBlameIgnoreFile(workDir: string, codemodCommit: string) {
  let ignoreRevsFile = resolve(workDir, '.git-blame-ignore-revs');
  if (existsSync(ignoreRevsFile)) {
    writeFileSync(ignoreRevsFile, readFileSync(ignoreRevsFile, 'utf8') + '\n' + codemodCommit + '\n');
  } else {
    writeFileSync(ignoreRevsFile, codemodCommit + '\n');
  }
  execSync(`git add .git-blame-ignore-revs`, { cwd: workDir });
  execSync(`git commit --no-verify -m "add codemod to ignore-revs"`, { cwd: workDir });
}

export async function mergeHistory(opts: MergeHistoryOptions): Promise<void> {
  let endpoints = resolveEndpoints(opts);
  let workDir = setupWorkDir(opts, endpoints);
  let changedFiles = listFiles(endpoints);
  applyMoves(workDir, changedFiles, ['.js', '.ts']);
  execSync(`git commit --no-verify -m "renamed JS/TS to GJS/GTS"`, { cwd: workDir });
  let jsRenameCommit = head({ cwd: workDir });
  execSync(`git reset --hard ${endpoints.beforeSha}`, { cwd: workDir });
  applyMoves(workDir, changedFiles, ['.hbs']);
  execSync(`git commit --no-verify -m "renamed HBS to GJS/GTS"`, { cwd: workDir });
  let hbsRenameCommit = head({ cwd: workDir });
  expectMergeConflicts(() => {
    execSync(`git merge ${jsRenameCommit}`, { cwd: workDir });
  });
  concatenateMerge(workDir, jsRenameCommit, hbsRenameCommit);
  execSync(`git commit --no-verify -m "combined JS and HBS"`, { cwd: workDir });
  applyCodemod(workDir, changedFiles, endpoints);
  execSync(`git commit --no-verify -m "applied codemod"`, { cwd: workDir });
  let codemodCommit = head({ cwd: workDir });
  addBlameIgnoreFile(workDir, codemodCommit);
  execSync(`git checkout -b ${opts.outputBranch}`, { cwd: workDir });
  rmSync(workDir, { recursive: true });
  execSync(`git worktree prune`);
  console.log(`Successfully created branch ${opts.outputBranch}`);
}
