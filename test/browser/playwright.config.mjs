import { defineConfig, devices } from "@playwright/test";

/**
 * Pixel comparison of the canvas backend against KaTeX's HTML output
 * (`npm run test:browser`). Every formula of the corpus is rendered both
 * ways in the same headless chromium and the images are diffed; see
 * corpus.spec.mjs for the pass criteria and report/index.html for the
 * resulting gallery.
 */
export default defineConfig({
    testDir: ".",
    testMatch: /.*\.spec\.mjs/,
    globalSetup: "./global-setup.mjs",
    timeout: 30_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI ? [["github"], ["dot"]] : [["dot"]],
    use: {
        ...devices["Desktop Chrome"],
        headless: true,
        viewport: { width: 4000, height: 2400 },
        deviceScaleFactor: 1,
        // Canvas text is always anti-aliased in grayscale, HTML text uses
        // subpixel anti-aliasing where the system is set up for it (as on
        // CI runners); keep it grayscale everywhere, so they can be compared.
        launchOptions: { args: ["--no-sandbox", "--disable-lcd-text"] },
    },
});
