/**
 * Compares the canvas backend against KaTeX's own HTML rendering.
 *
 * For each formula of the corpus (test/corpus) the harness page draws the
 * HTML reference and the canvas rendering side by side. The screenshot is
 * diffed with a one pixel tolerance (see harness.mjs), giving a score:
 * mismatched pixels per inked reference pixel.
 *
 * A case passes if its score is at most PASS_SCORE, the backend reported no
 * unsupported constructs, and the laid-out height and depth agree with
 * KaTeX's struts. Cases that are known not to pass yet are listed with their
 * score in expectations.json; for those the test only fails if the score
 * gets worse. Any case not listed there must pass. After deliberate changes,
 * regenerate the file with
 *
 *     KATEX_CANVAS_UPDATE=1 npm run test:browser
 *
 * and review the diff. The gallery at report/index.html shows every case as
 * [reference | canvas | diff].
 *
 * With KATEX_CANVAS_SMOKE set (CI does so for WebKit on macOS), a case only
 * has to lay out without exceptions or unsupported constructs, with the
 * struts' height and depth, and with roughly the reference's amount of ink:
 * Safari's HTML differs from the canvas in ways that are WebKit's (text
 * baselines are rounded differently in HTML and canvas, fractional rules are
 * anti-aliased in HTML), so it is no pixel reference there. The gallery
 * still shows the comparison.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { loadVariants } from "../corpus/index.mjs";
import { OUT_DIR, EXPECTATIONS_FILE, fileName } from "./report.mjs";

const PASS_SCORE = 0.02;
// The tolerant diff forgives one-pixel offsets everywhere. Systematic offsets
// are caught by comparing darkness-weighted centroids instead, and missing or
// extra ink by comparing the total darkness.
const MAX_CENTROID_SHIFT = 0.75;
const MAX_DARKNESS_DEVIATION = 0.08;
// Tolerance before a known failure counts as having become worse.
const REGRESSION_SLACK = 0.01;
// Padding around the formula in each cell, in em.
const PAD_EM = 1.5;
const SMOKE = !!process.env.KATEX_CANVAS_SMOKE;
const SMOKE_DARKNESS = [0.75, 1.35];

const cases = loadVariants();
const expectations = JSON.parse(readFileSync(EXPECTATIONS_FILE, "utf8"));

test.describe.configure({ mode: "parallel" });

let page;

test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 4000, height: 2400 }, deviceScaleFactor: 1 });
    page = await context.newPage();
    page.on("pageerror", (e) => console.error(`page error: ${e.stack || e}`));
    await page.goto(`${process.env.HARNESS_BASE_URL}/test/browser/harness.html`);
    await page.waitForFunction(() => window.harness !== undefined);
});

test.afterAll(async () => {
    await page?.context().close();
});

for (const testCase of cases) {
    test(testCase.id, async () => {
        const result = { ...testCase };
        // Only KaTeX rejecting the input skips a case; an exception in the
        // canvas backend fails it.
        const parseError = await page.evaluate((c) => window.harness.parseError(c), testCase);
        if (parseError !== null) {
            result.status = "error";
            result.error = parseError.split("\n")[0];
            writeFileSync(join(OUT_DIR, "results", fileName(testCase.id) + ".json"), JSON.stringify(result));
            test.skip(true, `KaTeX cannot render this: ${result.error}`);
            return;
        }
        const info = await page.evaluate(
            ([c, pad]) => window.harness.render(c, c.hostPx, Math.round(pad * c.hostPx * 1.21)),
            [testCase, PAD_EM],
        );
        Object.assign(result, info);

        const shot = await page.screenshot({
            clip: { x: 0, y: 0, width: 2 * info.cellWidth, height: info.cellHeight },
        });
        const cmp = await page.evaluate(
            ([s, w, h]) => window.harness.compare(s, w, h),
            [`data:image/png;base64,${shot.toString("base64")}`, info.cellWidth, info.cellHeight],
        );
        const stats = JSON.parse(cmp.stats);
        expect(stats.score, "inconsistent diff statistics").toBe(stats.mismatched / Math.max(1, stats.ink));
        result.stats = stats;
        writeFileSync(
            join(OUT_DIR, "img", fileName(testCase.id) + ".png"),
            Buffer.from(cmp.composite.split(",")[1], "base64"),
        );

        const problems = [];
        // Rule thicknesses are snapped to pixels here (pixelRatio), so allow
        // for that; test/unit checks the unsnapped extents exactly.
        if (Math.abs(info.heightError) >= 1 || Math.abs(info.depthError) >= 1) {
            problems.push(`height/depth off by ${info.heightError.toFixed(3)}/${info.depthError.toFixed(3)}px`);
        }
        if (stats.score > PASS_SCORE) problems.push(`diff score ${stats.score.toFixed(4)}`);
        const c = stats.centroidShift;
        if (c && Math.max(Math.abs(c.x), Math.abs(c.y)) > MAX_CENTROID_SHIFT) {
            problems.push(`ink centroid shifted by (${c.x.toFixed(2)}, ${c.y.toFixed(2)})px`);
        }
        if (stats.darkness !== null && Math.abs(stats.darkness - 1) > MAX_DARKNESS_DEVIATION) {
            problems.push(`${(100 * stats.darkness).toFixed(1)}% of the reference's ink`);
        }
        result.problems = problems;
        if (expectations[testCase.id] && expectations[testCase.id].note) result.note = expectations[testCase.id].note;
        if (info.unsupported.length > 0) result.status = "unsupported";
        else if (problems.length === 0) result.status = "pass";
        else result.status = "fail";
        writeFileSync(join(OUT_DIR, "results", fileName(testCase.id) + ".json"), JSON.stringify(result));

        const expected = expectations[testCase.id];
        if (SMOKE) {
            expect(info.unsupported, "unsupported constructs").toEqual([]);
            expect(Math.abs(info.heightError), "height off").toBeLessThan(1);
            expect(Math.abs(info.depthError), "depth off").toBeLessThan(1);
            expect(stats.darkness, "ink compared to the reference").toBeGreaterThan(SMOKE_DARKNESS[0]);
            expect(stats.darkness, "ink compared to the reference").toBeLessThan(SMOKE_DARKNESS[1]);
        } else if (!expected) {
            expect(result.status, [`unsupported: [${info.unsupported}]`, ...problems].join("; ")).toBe("pass");
        } else {
            expect(stats.score, `known ${expected.status} case got worse`).toBeLessThanOrEqual(
                expected.score + REGRESSION_SLACK,
            );
            if (result.status === "pass") {
                test.info().annotations.push({ type: "improved", description: "now passes; update expectations" });
            }
        }
    });
}
