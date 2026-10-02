/*! katex-canvas | MIT License | Copyright (c) 2026 Michael Strobel */

/**
 * Font loading for the canvas backend. `layout` measures text with whatever
 * fonts are available at the time, so the KaTeX fonts a formula uses (the
 * box's `fonts`) have to be loaded before its layout is final: either lay
 * out, `loadFonts`, and lay out again if that loaded anything (which
 * `layoutTeX` does), or check `fontsLoaded` and come back later.
 *
 * The fonts are defined by KaTeX's stylesheet (`katex/dist/katex.css`), or
 * without it by `registerKatexFonts`, which also works in workers.
 */

// The faces KaTeX ships (katex/dist/fonts), as [family, style, weight].
const FACES = [
    ["KaTeX_AMS", "normal", "normal"],
    ["KaTeX_Caligraphic", "normal", "bold"],
    ["KaTeX_Caligraphic", "normal", "normal"],
    ["KaTeX_Fraktur", "normal", "bold"],
    ["KaTeX_Fraktur", "normal", "normal"],
    ["KaTeX_Main", "normal", "bold"],
    ["KaTeX_Main", "italic", "bold"],
    ["KaTeX_Main", "italic", "normal"],
    ["KaTeX_Main", "normal", "normal"],
    ["KaTeX_Math", "italic", "bold"],
    ["KaTeX_Math", "italic", "normal"],
    ["KaTeX_SansSerif", "normal", "bold"],
    ["KaTeX_SansSerif", "italic", "normal"],
    ["KaTeX_SansSerif", "normal", "normal"],
    ["KaTeX_Script", "normal", "normal"],
    ["KaTeX_Size1", "normal", "normal"],
    ["KaTeX_Size2", "normal", "normal"],
    ["KaTeX_Size3", "normal", "normal"],
    ["KaTeX_Size4", "normal", "normal"],
    ["KaTeX_Typewriter", "normal", "normal"],
];

function defaultFontSet() {
    if (typeof document !== "undefined" && document.fonts) return document.fonts;
    if (typeof self !== "undefined" && self.fonts) return self.fonts;
    return null;
}

/**
 * Registers KaTeX's fonts with a FontFaceSet, so that neither `katex.css`
 * nor a DOM is needed, e.g. in a worker drawing on an OffscreenCanvas.
 * `baseUrl` is the URL of KaTeX's `fonts` directory (`katex/dist/fonts/`,
 * wherever your setup serves it). The faces are loaded on demand, by
 * `loadFonts`. Returns the created FontFace objects.
 *
 * @param {string | URL} baseUrl
 * @param {{fontSet?: FontFaceSet, format?: "woff2" | "woff" | "ttf"}} [options]
 */
export function registerKatexFonts(baseUrl, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) throw new Error("registerKatexFonts: no FontFaceSet available");
    const format = options.format || "woff2";
    const base = String(baseUrl).replace(/\/?$/, "/");
    const formatName = { woff2: "woff2", woff: "woff", ttf: "truetype" }[format];
    return FACES.map(([family, style, weight]) => {
        const variant = (weight === "bold" ? "Bold" : "") + (style === "italic" ? "Italic" : "") || "Regular";
        const url = `${base}${family}-${variant}.${format}`;
        const face = new FontFace(family, `url(${JSON.stringify(url)}) format("${formatName}")`, { style, weight });
        fontSet.add(face);
        return face;
    });
}

// Per FontFaceSet: font face (without the size) -> true once loaded or
// failed, or the promise while loading.
const states = new WeakMap();
const warned = new Set();

function stateOf(fontSet) {
    let state = states.get(fontSet);
    if (!state) {
        state = new Map();
        states.set(fontSet, state);
    }
    return state;
}

function faceOf(font) {
    return font.replace(/ [\d.]+px /, " ");
}

/**
 * Whether all of `fonts` (a box's `fonts`) have been loaded by `loadFonts`.
 *
 * @param {string[]} fonts
 * @param {{fontSet?: FontFaceSet}} [options]
 */
export function fontsLoaded(fonts, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) return true;
    const state = stateOf(fontSet);
    return fonts.every((font) => state.get(faceOf(font)) === true);
}

/**
 * Loads `fonts` (a box's `fonts`). Resolves to true if any of them was not
 * loaded before, i.e. if a layout made before needs to be redone. A face
 * that fails to load counts as loaded, so that formulas are then drawn in a
 * fallback font rather than waited for forever; a face that is not defined
 * at all (no `katex.css`, no `registerKatexFonts`) is tried again next time.
 * Both cases are reported once with console.warn.
 *
 * @param {string[]} fonts
 * @param {{fontSet?: FontFaceSet}} [options]
 * @returns {Promise<boolean>}
 */
export async function loadFonts(fonts, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) return false;
    const state = stateOf(fontSet);
    const warn = (face, why) => {
        if (warned.has(face)) return;
        warned.add(face);
        console.warn(`katex-canvas: font ${face} ${why}; formulas use a fallback font`);
    };
    let changed = false;
    await Promise.all(
        fonts.map((font) => {
            const face = faceOf(font);
            let s = state.get(face);
            if (s === true) return null;
            if (s === undefined) {
                s = fontSet.load(font).then(
                    (faces) => {
                        if (faces.length > 0) {
                            state.set(face, true);
                            return true;
                        }
                        state.delete(face);
                        warn(face, "is not defined (load katex.css or call registerKatexFonts)");
                        return false;
                    },
                    (e) => {
                        state.set(face, true);
                        warn(face, `could not be loaded (${(e && e.message) || e})`);
                        return true;
                    },
                );
                state.set(face, s);
            }
            return s.then((loaded) => {
                if (loaded) changed = true;
            });
        }),
    );
    return changed;
}
