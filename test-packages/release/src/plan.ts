import { Impact, ParsedChangelog } from './change-parser';
import { publishedInterPackageDeps } from './interdep';

class Plan {
  constraints: Map<string, { impact: Impact; reason: string }[]>;

  constructor() {
    let pkgs = publishedInterPackageDeps();

    // initialize constraints for every published package
    let constraints = new Map<string, { impact: Impact; reason: string }[]>();
    for (let pkg of pkgs.keys()) {
      constraints.set(pkg, []);
    }

    this.constraints = constraints;
  }

  addConstraint(packageName: string, impact: Impact, reason: string): boolean {
    let pkgConstraints = this.constraints.get(packageName);
    if (!pkgConstraints) {
      let err = new Error(`unknown package "${packageName}"`);
      (err as any).unknownPackage = true;
      throw err;
    }
    pkgConstraints.push({ impact, reason });
    return true;
  }
}

export function planVersionBumps(changed: ParsedChangelog) {
  let plan = new Plan();
  for (let section of changed.sections) {
    if ('unlabeled' in section) {
      process.stderr.write(`cannot plan version bumps when there are unlabeled changes\n`);
      process.exit(-1);
    }

    for (let pkg of section.packages) {
      plan.addConstraint(`@embroider/${pkg}`, section.impact, `Appears in changelog section ${section.heading}`);
    }
  }

  return plan.constraints;
}
