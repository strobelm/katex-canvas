/*! katex-canvas | MIT License | Copyright (c) 2026 Michael Strobel */

/**
 * katex-canvas: draws KaTeX formulas on a 2D canvas.
 *
 *     import katex from "katex";
 *     import { layoutTeX, render } from "katex-canvas";
 *
 *     const box = await layoutTeX(katex, "\\frac{a}{b}", ctx, { fontSize: 24 });
 *     render(ctx, box, x, baselineY);
 */

import { layout } from "./layout.mjs";
import { loadFonts } from "./fonts.mjs";

export { layout, render } from "./layout.mjs";
export { fontsLoaded, loadFonts, registerKatexFonts } from "./fonts.mjs";

/** The KaTeX versions this release is tested with. */
export const SUPPORTED_KATEX = ">=0.18.9 <0.20";

const checked = new WeakSet();

function checkVersion(katex) {
    if (checked.has(katex)) return;
    checked.add(katex);
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(katex.version || "");
    const v = m ? [+m[1], +m[2], +m[3]] : null;
    const atLeast = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    if (!v || atLeast(v, [0, 18, 9]) < 0 || atLeast(v, [0, 20, 0]) >= 0) {
        console.warn(
            `katex-canvas: KaTeX ${katex.version} is outside the tested range ${SUPPORTED_KATEX}; ` +
                "formulas may be laid out wrongly",
        );
    }
    if (typeof katex.__renderToHTMLTree !== "function") {
        throw new Error("katex-canvas: this KaTeX has no __renderToHTMLTree");
    }
}

function layoutOptions(options) {
    return {
        fontSize: options.fontSize,
        pixelRatio: options.pixelRatio,
        displayWidth: options.displayWidth,
        images: options.images,
    };
}

/**
 * Typesets `tex` with KaTeX and lays it out for `ctx`, without waiting for
 * fonts: if `fontsLoaded(box.fonts)` is false, the widths are those of
 * fallback fonts; `loadFonts(box.fonts)` and lay out again. Throws KaTeX's
 * ParseError like `katex.render` (unless `katexOptions.throwOnError` is
 * false).
 *
 * @param katex the KaTeX module (`import katex from "katex"`)
 * @param {string} tex
 * @param ctx a 2D canvas context, used for measuring text
 * @param options `fontSize` (CSS pixels per TeX em), `katexOptions` (as for
 *        `katex.render`), and `pixelRatio`, `displayWidth`, `images` as for
 *        `layout`
 */
export function layoutTeXSync(katex, tex, ctx, options) {
    checkVersion(katex);
    const tree = katex.__renderToHTMLTree(tex, options.katexOptions || {});
    return layout(tree, ctx, layoutOptions(options));
}

/**
 * Like `layoutTeXSync`, but loads the fonts the formula needs first, so the
 * layout is final. `options.fontSet` selects the FontFaceSet to load into
 * (default: `document.fonts`, or `self.fonts` in workers).
 */
export async function layoutTeX(katex, tex, ctx, options) {
    checkVersion(katex);
    const tree = katex.__renderToHTMLTree(tex, options.katexOptions || {});
    // The fonts are collected by a layout that measures nothing: in
    // Chromium's workers, a font string measured before its font was loaded
    // keeps measuring with the fallback font.
    const { fonts } = layout(tree, NOT_MEASURING, layoutOptions(options));
    await loadFonts(fonts, { fontSet: options.fontSet });
    return layout(tree, ctx, layoutOptions(options));
}

const NOT_MEASURING = {
    font: "",
    save() {},
    restore() {},
    measureText: (text) => ({ width: text.length }),
};
