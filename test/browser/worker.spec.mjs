/**
 * The package in a worker: fonts from registerKatexFonts instead of
 * katex.css, drawing on an OffscreenCanvas. The result must be the same as
 * on the main thread.
 */

import { expect, test } from "@playwright/test";

const FORMULAS = [
    "x^2+y^2=r^2",
    "\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}",
    "\\sum_{k=0}^{\\infty}\\frac{x^k}{k!}",
    "\\mathbb{R}\\mathcal{F}\\mathfrak{g}\\mathscr{L}\\mathsf{s}\\mathtt{t}\\boldsymbol{\\alpha}",
    "\\left(\\begin{matrix}a&b\\\\c&d\\end{matrix}\\right)\\overrightarrow{AB}\\color{red}{x}",
];

let page;

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on("pageerror", (e) => console.error(`page error: ${e.stack || e}`));
    await page.goto(`${process.env.HARNESS_BASE_URL}/test/browser/worker.html`);
    await page.waitForFunction(() => window.compareWithWorker !== undefined);
});

test.afterAll(async () => {
    await page?.close();
});

for (const tex of FORMULAS) {
    test(`worker: ${tex}`, async () => {
        const r = await page.evaluate((t) => window.compareWithWorker(t), tex);
        expect(r.ink).toBeGreaterThan(50);
        expect(r.workerWidth).toBeCloseTo(r.width, 6);
        expect(r.differing).toBe(0);
    });
}
