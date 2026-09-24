import puppeteer, { type Browser } from 'puppeteer-core';
import { existsSync } from 'fs';

/**
 * We use puppeteer-core (rather than full puppeteer) so we don't download a
 * bundled Chromium. Instead we drive whatever Chrome/Chromium is already on the
 * machine — the same browser testem uses in CI. Honor the usual env overrides
 * first, then fall back to the well-known install locations per platform.
 */
export function findChrome(): string {
  let fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }

  let candidates = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (let candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Could not find a Chrome/Chromium executable to drive. ' +
      'Set PUPPETEER_EXECUTABLE_PATH (or CHROME_BIN) to its path.'
  );
}

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio'],
  });
}
