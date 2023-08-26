import type { Impact, ParsedChangelog } from './change-parser';
import { publishedInterPackageDeps } from './interdep';
import assertNever from 'assert-never';
import { inc, satisfies } from 'semver';
import { highlightMarkdown } from './highlight';
import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync, readJSONSync, writeJSONSync } from 'fs-extra';

export type Solution = Map<
  string,
  | { impact: undefined; oldVersion: string }
  | {
      impact: Impact;
      oldVersion: string;
      newVersion: string;
      constraints: { impact: Impact; reason: string }[];
      pkgJSONPath: string;
    }
>;

class Plan {
  #constraints: Map<string, { impact: Impact; reason: string }[]>;
  #pkgs: ReturnType<typeof publishedInterPackageDeps>;

  constructor() {
    this.#pkgs = publishedInterPackageDeps();

    // initialize constraints for every published package
    let constraints = new Map<string, { impact: Impact; reason: string }[]>();
    for (let pkg of this.#pkgs.keys()) {
      constraints.set(pkg, []);
    }
    this.#constraints = constraints;
  }

  addConstraint(packageName: string, impact: Impact, reason: string): void {
    let pkgConstraints = this.#constraints.get(packageName);
    if (!pkgConstraints) {
      let err = new Error(`unknown package "${packageName}"`);
      (err as any).unknownPackage = true;
      throw err;
    }
    if (!pkgConstraints.some(existing => existing.impact === impact && existing.reason === reason)) {
      pkgConstraints.push({ impact, reason });
      this.#propagate(packageName, impact);
    }
  }

  solve(): Solution {
    let solution: Solution = new Map();
    for (let [pkgName, entry] of this.#pkgs) {
      let constraints = this.#constraints.get(pkgName)!;
      let impact = this.#sumImpact(constraints);
      if (!impact) {
        solution.set(pkgName, { impact: undefined, oldVersion: entry.version });
      } else {
        let newVersion = inc(entry.version, impact)!;
        solution.set(pkgName, {
          impact,
          oldVersion: entry.version,
          newVersion,
          constraints,
          pkgJSONPath: entry.pkgJSONPath,
        });
      }
    }
    return solution;
  }

  #expandWorkspaceRange(range: `workspace:${string}`, availableVersion: string): string {
    // this implements PNPM's rules for how workspace: protocol dependencies get
    // expanded into proper semver ranges.
    switch (range) {
      case 'workspace:*':
        return availableVersion;
      case 'workspace:~':
        return `~${availableVersion}`;
      case 'workspace:^':
        return `^${availableVersion}`;
      default:
        return range.slice(10);
    }
  }

  #propagate(packageName: string, impact: Impact) {
    let entry = this.#pkgs.get(packageName)!;
    let minNewVersion = inc(entry.version, impact)!;
    for (let [consumerName, workspaceRange] of entry.isDependencyOf) {
      this.#propagateDep(packageName, minNewVersion, 'dependencies', consumerName, workspaceRange);
    }
    for (let [consumerName, workspaceRange] of entry.isPeerDependencyOf) {
      this.#propagateDep(packageName, minNewVersion, 'peerDependencies', consumerName, workspaceRange);
    }
  }

  #propagateDep(
    packageName: string,
    minNewVersion: string,
    section: 'dependencies' | 'peerDependencies',
    consumerName: string,
    workspaceRange: `workspace:${string}`
  ) {
    let entry = this.#pkgs.get(packageName)!;

    let oldRange = this.#expandWorkspaceRange(workspaceRange, entry.version);
    if (!satisfies(minNewVersion, oldRange)) {
      switch (section) {
        case 'dependencies':
          this.addConstraint(consumerName, 'patch', `Has dependency ${'`'}${workspaceRange}${'`'} on ${packageName}`);
          break;
        case 'peerDependencies':
          this.addConstraint(
            consumerName,
            'major',
            `Has peer dependency ${'`'}${workspaceRange}${'`'} on ${packageName}`
          );
          break;
        default:
          throw assertNever(section);
      }
    }
  }

  #sumImpact(impacts: { impact: Impact }[]): Impact | undefined {
    if (impacts.some(i => i.impact === 'major')) {
      return 'major';
    }
    if (impacts.some(i => i.impact === 'minor')) {
      return 'minor';
    }
    if (impacts.some(i => i.impact === 'patch')) {
      return 'patch';
    }
  }
}

function impactLabel(impact: Impact | undefined, text?: string) {
  switch (impact) {
    case undefined:
      return chalk.gray(text);
    case 'patch':
      return chalk.blueBright(text);
    case 'minor':
      return chalk.greenBright(text);
    case 'major':
      return chalk.redBright(text);
  }
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function explain(solution: Solution) {
  let output: string[] = [];

  for (let priority of ['major', 'minor', 'patch'] as const) {
    if ([...solution].some(entry => entry[1].impact === priority)) {
      output.push(impactLabel(priority, capitalize(priority)));
      output.push('');

      for (let [pkgName, entry] of solution) {
        if (entry.impact === priority) {
          output.push(`  ${impactLabel(entry.impact, pkgName)} from ${entry.oldVersion} to ${entry.newVersion}`);
          for (let constraint of entry.constraints) {
            if (constraint.impact === entry.impact) {
              output.push(`   - ${constraint.reason}`);
            }
          }
        }
      }
      output.push('');
    }
  }

  if ([...solution].some(entry => entry[1].impact === undefined)) {
    output.push(impactLabel(undefined, 'Unreleased'));
    output.push('');
    for (let [pkgName, entry] of solution) {
      if (entry.impact === undefined) {
        output.push(`## ${pkgName}`);
        output.push(`  ${impactLabel(entry.impact, pkgName)} unchanged`);
      }
    }
    output.push('');
  }

  return output.join('\n');
}

export function planVersionBumps(changed: ParsedChangelog): Solution {
  let plan = new Plan();
  for (let section of changed.sections) {
    if ('unlabeled' in section) {
      process.stderr.write(
        highlightMarkdown(
          `# Unlabeled Changes\n\n${section.summaryText}\n\n*Cannot plan release until the above changes are labeled*.\n`
        )
      );
      process.exit(-1);
    }

    for (let pkg of section.packages) {
      plan.addConstraint(`@embroider/${pkg}`, section.impact, `Appears in changelog section ${section.heading}`);
    }
  }

  return plan.solve();
}

function solutionFile(): string {
  return resolve(__dirname, '..', '..', '..', '.release-plan.json');
}

export function saveSolution(solution: Solution, description: string): void {
  writeJSONSync(solutionFile(), { solution: Object.fromEntries(solution), description }, { spaces: 2 });
}

export function loadSolution(): { solution: Solution; description: string } {
  try {
    if (!existsSync(solutionFile())) {
      let err = new Error(`No such file ${solutionFile()}`);
      (err as any).code = 'ENOENT';
      throw err;
    }
    let json = readJSONSync(solutionFile());
    return {
      solution: new Map(Object.entries(json.solution)),
      description: json.description,
    };
  } catch (err) {
    process.stderr.write(
      `Unable to load release plan file. You must run "embroider-release prepare" first to create the file.\n`
    );
    if (err.code !== 'ENOENT') {
      console.error(err);
    }
    process.exit(-1);
  }
}
