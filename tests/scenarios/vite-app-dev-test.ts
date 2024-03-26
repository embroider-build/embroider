import { appScenarios } from './scenarios';
import type { PreparedApp } from 'scenario-tester';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('vite-app-development', project => {
    project.mergeFiles({
      scripts: {
        'run-tests.mjs': `
          import child from "child_process";
          import { resolve } from "path";
          import { readdirSync, writeFileSync, rmSync } from "fs";
          import PCR from "puppeteer-chromium-resolver";

          const __root = process.cwd();

          async function run() {
            // eslint-disable-next-line new-cap
            const { puppeteer, executablePath } = await PCR({});
            console.log("[ci] starting");
            let runvite;

            async function startVite() {
              await /** @type {Promise<void>} */ (
                new Promise((fulfill) => {
                  runvite = child.fork(
                    resolve(__root, "node_modules", "vite", "bin", "vite.js"),
                    ["--port", "60173", "--no-open", "--force"],
                    {
                      stdio: "pipe",
                    }
                  );

                  process.on("exit", () => runvite.kill());

                  runvite.stderr.on("data", (data) => {
                    console.log("stderr", String(data));
                  });

                  runvite.stdout.on("data", (data) => {
                    const chunk = String(data);
                    console.log("stdout", chunk);
                    if (chunk.includes("Local") && chunk.includes("60173")) {
                      fulfill(1);
                    }
                  });

                  console.log("[ci] spawning");
                })
              );
            }

            async function runTests() {
              console.log("[ci] spawned");

              const browser = await puppeteer.launch({
                headless: "new",
                executablePath,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
              });

              console.log("[ci] puppeteer launched");
              let unOptimizedDeps = [];
              let allUrls = new Set();
              let madeRequests = {};
              let result = await /** @type {Promise<void>} */ (
                // eslint-disable-next-line no-async-promise-executor
                new Promise(async (fulfill) => {
                  const page = await browser.newPage();

                  page.on("pageerror", (msg) => {
                    console.error(msg);
                    fulfill(1);
                  });

                  function logRequest(interceptedRequest) {
                    const url = interceptedRequest.url();
                    const initiator = interceptedRequest.initiator().url;
                    madeRequests[initiator] = madeRequests[initiator] || [];

                    madeRequests[initiator].push(url);
                    allUrls.add(url);
                    const allow = [
                      "vite/dist/client/env.mjs",
                      "@babel+runtime",
                      ".css",
                      "@embroider/macros",
                      "ember-source/ember/index.js",
                    ];

                    function importerAllowedUnoptimized(importer) {
                      // virtual modules can contain the rewritten-app location
                      if (allow.some((a) => url.includes(a))) {
                        return true;
                      }
                      return !!(
                        importer.includes("node_modules") &&
                        !importer.includes("rewritten-app")
                      );
                    }

                    if (
                      url.includes("node_modules") &&
                      !url.includes("rewritten-app") &&
                      !url.includes(".vite/deps") &&
                      !url.includes("embroider_virtual") &&
                      !importerAllowedUnoptimized(initiator)
                    ) {
                      console.error("url does not use optimized dep", url, initiator);
                      unOptimizedDeps.push(url);
                    }
                  }
                  page.on("request", logRequest);

                  page.on("console", (msg) => {
                    const text = msg.text();
                    const location = msg.location();
                    if (text.includes("HARNESS")) {
                      try {
                        const parsed = JSON.parse(text);
                        if (parsed.type === "[HARNESS] done") {
                          return fulfill(parsed.failed > 0 ? 1 : 0);
                        }
                      } catch (e) {}
                    }
                    if (location.url?.includes(\`/qunit.js\`)) {
                      console.log(text);
                    } else {
                      console.debug(text);
                    }
                  });

                  await page.goto("http://localhost:60173/tests/?hidepassed&ci");
                })
              );

              await browser.close();

              const optmizedDeps = readdirSync("./node_modules/.vite/deps")
                .filter((f) => !f.endsWith(".map"))
                .filter((f) => f !== "_metadata.json")
                .filter((f) => f !== "package.json");
              const allUrlsList = [...allUrls];
              const unusedOptimzedDep = optmizedDeps.filter((o) => {
                return !allUrlsList.some((url) => url.includes(o));
              });

              if (unusedOptimzedDep.length) {
                console.error("has unused optmized deps", unusedOptimzedDep);
                result = 1;
              }

              if (unOptimizedDeps.length) {
                console.error("unoptimized deps detected", unOptimizedDeps);
                result = 1;
              }

              return {
                result,
                madeRequests,
              };
            }

            async function test1() {
              console.log("test1");
              await startVite();
              await runTests();
              // need also test compat for other types
              const applicationHbs = \`
              {{page-title "ViteApp"}}
              {{outlet}}
            \`;
              const importsTest = \`
                import { test } from 'qunit';
                import * as title from 'app-template/helpers/page-title';
                test("should work", async function (assert) {
                  assert.ok(title.default);
                })
              \`.trim();
              writeFileSync("./app/templates/application.hbs", applicationHbs);
              writeFileSync("./tests/unit/imports-test.js", importsTest);
              await runTests();
              await runvite.kill();
            }

            async function test2() {
              console.log("test2");
              await startVite();
              await runTests();
              const importsTest = \`
                import { test } from 'qunit';
                import * as title2 from '../../helpers/page-title';
                test("should work", async function (assert) {
                  assert.ok(title2.default);
                })
              \`.trim();
              writeFileSync("./tests/unit/imports-test.js", importsTest);
              await runTests();
              await runvite.kill();
            }

            async function test3() {
              console.log("test3");
              await startVite();
              await runTests();
              const importsTest = \`
                import { test } from 'qunit';
                import * as title3 from 'ember-page-title/helpers/page-title';
                test("should work", async function (assert) {
                  assert.ok(title3.default);
                })
              \`.trim();
              writeFileSync("./tests/unit/imports-test.js", importsTest);
              await runTests();
              await runvite.kill();
            }

            async function test4() {
              console.log("test4");
              await startVite();
              await runTests();
              const importsTest = \`
                import { test } from 'qunit';
                import * as title4 from '#embroider_compat/helpers/page-title';
                test("should work", async function (assert) {
                  assert.ok(title4.default);
                })
              \`.trim();
              writeFileSync("./tests/unit/imports-test.js", importsTest);
              await runTests();
              await runvite.kill();
            }

            async function test5() {
              console.log("test5");
              await startVite();
              await runTests();
              const importsTest = \`
                import { test } from 'qunit';
                import * as title from 'app-template/helpers/page-title';
                import * as title2 from '../../helpers/page-title';
                import * as title3 from 'ember-page-title/helpers/page-title';
                import * as title4 from '#embroider_compat/helpers/page-title';

                test("should work", async function (assert) {
                  assert.ok(title.default);
                  assert.ok(title2.default);
                  assert.ok(title3.default);
                  assert.ok(title.default === title2.default);
                  assert.ok(title.default === title3.default);
                  assert.ok(title.default === title4.default);
                })
              \`.trim();
              writeFileSync("./tests/unit/imports-test.js", importsTest);
              await runTests();
              await runvite.kill();
            }

            await test1();
            await test2();
            await test3();
            await test4();
            await test5();
          }

          await run();

        `,
      },
    });
  })
  .forEachScenario(scenario => {
    Qmodule(scenario.name, function (hooks) {
      let app: PreparedApp;

      hooks.before(async () => {
        app = await scenario.prepare();
      });

      test(`pnpm test:ember`, async function (assert) {
        let result = await app.execute('pnpm test:ember');
        assert.equal(result.exitCode, 0, result.output);
      });
    });
  });
