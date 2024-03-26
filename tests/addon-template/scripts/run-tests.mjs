import child from "child_process";
import { resolve } from "path";
import { readdirSync } from "fs";
import PCR from "puppeteer-chromium-resolver";

const __root = process.cwd();

async function run() {
  // eslint-disable-next-line new-cap
  const { puppeteer, executablePath } = await PCR({});
  console.log("[ci] starting");

  await /** @type {Promise<void>} */ (
    new Promise((fulfill) => {
      const runvite = child.fork(
        resolve(__root, "node_modules", "vite", "bin", "vite.js"),
        ["--port", "60173", "--no-open", '--force'],
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

  console.log("[ci] spawned");

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  console.log("[ci] puppeteer launched");

  let unOptimizedDeps = [];
  let allUrls = new Set();

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
          !importerAllowedUnoptimized(interceptedRequest.initiator().url)
        ) {
          console.error(
            "url does not use optimized dep",
            url,
            interceptedRequest.initiator()
          );
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
        if (location.url?.includes(`/qunit.js`)) {
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

  process.exit(result);
}

run();
