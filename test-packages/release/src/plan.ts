import { Impact, ParsedChangelog } from './change-parser';
import { publishedInterPackageDeps } from './interdep';
import assertNever from 'assert-never';
import { inc } from 'semver';
import { highlightMarkdown } from './highlight';

export type Solution = Map<
  string,
  | { impact: undefined; oldVersion: string }
  | { impact: Impact; oldVersion: string; newVersion: string; constraints: { impact: Impact; reason: string }[] }
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
        solution.set(pkgName, { impact, oldVersion: entry.version, newVersion, constraints });
      }
    }
    return solution;
  }

  explain() {
    let output: string[] = [];
    for (let [pkgName, entry] of this.solve()) {
      if (!entry.impact) {
        output.push(`## ${pkgName} ${entry.oldVersion} does not need to be released.`);
      } else {
        output.push(`## ${pkgName} needs a ${entry.impact} release from ${entry.oldVersion} to ${entry.newVersion}`);
        for (let constraint of entry.constraints) {
          if (constraint.impact === entry.impact) {
            output.push(`   - ${constraint.reason}`);
          }
        }
      }
    }
    return highlightMarkdown(output.join('\n'));
  }

  #propagate(packageName: string, impact: Impact) {
    let entry = this.#pkgs.get(packageName)!;
    for (let [consumerName, rangeType] of entry.isDependencyOf) {
      switch (rangeType) {
        case 'exact':
          this.addConstraint(
            consumerName,
            'patch',
            `Has an exact dependency on ${packageName}, which is being released`
          );
          break;
        case 'caret':
          if (impact === 'major') {
            this.addConstraint(
              consumerName,
              'patch',
              `Has a caret dependency on ${packageName}, which needs a major release`
            );
          }
          break;
        default:
          throw assertNever(rangeType);
      }
    }
    for (let [consumerName, rangeType] of entry.isPeerDependencyOf) {
      switch (rangeType) {
        case 'exact':
          this.addConstraint(
            consumerName,
            'major',
            `Has an exact peer dependency on ${packageName}, which is being released`
          );
          break;
        case 'caret':
          if (impact === 'major') {
            this.addConstraint(
              consumerName,
              'major',
              `Has a caret peer dependency on ${packageName}, which needs a major release`
            );
          }
          break;
        default:
          throw assertNever(rangeType);
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

export function planVersionBumps(changed: ParsedChangelog) {
  let plan = new Plan();
  for (let section of changed.sections) {
    if ('unlabeled' in section) {
      process.stderr.write(
        highlightMarkdown(
          `# Unlabeled Changes\n\n${section.summaryText}\n\n*Cannot plan version bumps until the above changes are labeled*.\n`
        )
      );
      process.exit(-1);
    }

    for (let pkg of section.packages) {
      plan.addConstraint(`@embroider/${pkg}`, section.impact, `Appears in changelog section ${section.heading}`);
    }
  }

  return plan;
}
