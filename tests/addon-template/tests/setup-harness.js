import { autoRegister } from 'js-reporters';
import QUnit from 'qunit';

export function setupQunit() {
  if (hasFlag('ci')) {
    const runner = autoRegister();
    const tap = QUnit.reporters.tap;
    tap.init(runner, { log: console.info });

    QUnit.config.urlConfig.push({
      id: 'smoke_tests',
      label: 'Enable Smoke Tests',
      tooltip: 'Enable Smoke Tests',
    });

    QUnit.config.urlConfig.push({
      id: 'ci',
      label: 'Enable CI Mode',
      tooltip:
        'CI mode makes tests run faster by sacrificing UI responsiveness',
    });

    console.log(`[HARNESS] ci=${hasFlag('ci')}`);
  }

  QUnit.done((details) => {
    console.log(JSON.stringify({ ...details, type: '[HARNESS] done' }));
  });
}

function hasFlag(flag) {
  let location = typeof window !== 'undefined' && window.location;
  return location && new RegExp(`[?&]${flag}`).test(location.search);
}
