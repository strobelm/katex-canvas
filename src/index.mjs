/*! katex-canvas | MIT License | Copyright (c) 2026 Michael Strobel */

/**
 * katex-canvas: draws KaTeX formulas on a 2D canvas.
 *
 *     import katex from "katex";
 *     import { drawTeX, layoutTeX, render } from "katex-canvas";
 *
 *     await drawTeX(katex, ctx, "\\frac{a}{b}", x, y, { fontSize: 24, align: "center" });
 *
 * or, to lay out once and draw many times:
 *
 *     const box = await layoutTeX(katex, ctx, "\\frac{a}{b}", { fontSize: 24 });
 *     render(ctx, box, x, baselineY);
 */

import { layout, render } from "./layout.mjs";
import { fontsReady, loadFonts } from "./fonts.mjs";

export { layout, render } from "./layout.mjs";
export { fontsLoaded, loadFonts, registerKatexFonts } from "./fonts.mjs";

/** The KaTeX versions this release is tested with. */
export const SUPPORTED_KATEX = ">=0.18.9 <0.20";

const checked = new WeakSet();

function checkVersion(katex) {
    if (checked.has(katex)) return;
    if (!katex || typeof katex.__renderToHTMLTree !== "function") {
        throw new Error("katex-canvas: pass the KaTeX module (it has no __renderToHTMLTree)");
    }
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
}

function layoutOptions(options) {
    return {
        fontSize: options.fontSize,
        pixelRatio: options.pixelRatio,
        displayWidth: options.displayWidth,
        images: options.images,
    };
}

function treeOf(katex, tex, options) {
    checkVersion(katex);
    return katex.__renderToHTMLTree(tex, options.katexOptions || {});
}

// The fonts a tree needs, from a layout that measures nothing: in Chromium's
// workers, a font string measured before its font was loaded keeps
// measuring with the fallback font, so nothing is measured before loading.
function fontsOf(tree, options) {
    return layout(tree, NOT_MEASURING, layoutOptions(options)).fonts;
}

const NOT_MEASURING = {
    font: "",
    save() {},
    restore() {},
    measureText: (text) => ({ width: text.length }),
};

/**
 * Typesets `tex` with KaTeX and lays it out for `ctx`, without waiting for
 * fonts: if `fontsLoaded(box.fonts)` is false, the widths are those of
 * fallback fonts; `loadFonts(box.fonts)` and lay out again. Throws KaTeX's
 * ParseError like `katex.render` (unless `katexOptions.throwOnError` is
 * false).
 *
 * @param katex the KaTeX module (`import katex from "katex"`)
 * @param ctx a 2D canvas context, used for measuring text
 * @param {string} tex
 * @param options `fontSize` (CSS pixels per TeX em), `katexOptions` (as for
 *        `katex.render`), and `pixelRatio`, `displayWidth`, `images` as for
 *        `layout`
 */
export function layoutTeXSync(katex, ctx, tex, options = {}) {
    return layout(treeOf(katex, tex, options), ctx, layoutOptions(options));
}

/**
 * Like `layoutTeXSync`, but loads the fonts the formula needs first, so the
 * layout is final. `options.fontSet` selects the FontFaceSet to load into
 * (default: `document.fonts`, or `self.fonts` in workers).
 */
export async function layoutTeX(katex, ctx, tex, options = {}) {
    const tree = treeOf(katex, tex, options);
    await loadFonts(fontsOf(tree, options), { fontSet: options.fontSet });
    return layout(tree, ctx, layoutOptions(options));
}

/**
 * Typesets, lays out and draws `tex` like `fillText`: at (x, y), anchored by
 * `options.align` and `options.baseline` (see `render`), in the context's
 * fill style. Takes the options of `layoutTeX` and `render`, and resolves to
 * the laid-out box.
 *
 * If the fonts are loaded, the formula is drawn right away. Otherwise it is
 * drawn once they are, with the transform, styles, line settings, alpha,
 * compositing, filter and shadow the context had at the call (not its
 * clipping region); await the result before clearing the canvas.
 */
export function drawTeX(katex, ctx, tex, x, y, options = {}) {
    let tree;
    let fonts;
    try {
        tree = treeOf(katex, tex, options);
        fonts = fontsOf(tree, options);
    } catch (e) {
        return Promise.reject(e);
    }
    const draw = () => {
        const box = layout(tree, ctx, layoutOptions(options));
        render(ctx, box, x, y, options);
        return box;
    };
    if (fontsReady(fonts, { fontSet: options.fontSet })) {
        try {
            return Promise.resolve(draw());
        } catch (e) {
            return Promise.reject(e);
        }
    }
    const state = saveState(ctx);
    return loadFonts(fonts, { fontSet: options.fontSet }).then(() => {
        ctx.save();
        try {
            restoreState(ctx, state);
            return draw();
        } finally {
            ctx.restore();
        }
    });
}

const STATE = [
    "fillStyle",
    "strokeStyle",
    "lineWidth",
    "lineJoin",
    "lineCap",
    "miterLimit",
    "globalAlpha",
    "globalCompositeOperation",
    "filter",
    "shadowColor",
    "shadowBlur",
    "shadowOffsetX",
    "shadowOffsetY",
];

function saveState(ctx) {
    const state = { transform: ctx.getTransform() };
    for (const k of STATE) if (k in ctx) state[k] = ctx[k];
    return state;
}

function restoreState(ctx, state) {
    ctx.setTransform(state.transform);
    for (const k of STATE) if (k in state) ctx[k] = state[k];
}
