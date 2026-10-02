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
 * wherever your setup serves it); a relative URL is resolved by the browser
 * against the document, or in a worker against the worker's script. The
 * faces are loaded on demand, by `loadFonts`. Returns the FontFace objects;
 * registering the same URL and format again returns the same ones.
 *
 * @param {string | URL} baseUrl
 * @param {{fontSet?: FontFaceSet, format?: "woff2" | "woff" | "ttf"}} [options]
 */
export function registerKatexFonts(baseUrl, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) throw new Error("registerKatexFonts: no FontFaceSet available");
    const format = options.format || "woff2";
    const formatName = { woff2: "woff2", woff: "woff", ttf: "truetype" }[format];
    if (!formatName) throw new Error(`registerKatexFonts: unknown format ${format}`);
    const base = String(baseUrl).replace(/\/?$/, "/");
    const { registered } = stateOf(fontSet);
    const key = format + " " + base;
    if (registered.has(key)) return registered.get(key);
    const faces = FACES.map(([family, style, weight]) => {
        const variant = (weight === "bold" ? "Bold" : "") + (style === "italic" ? "Italic" : "") || "Regular";
        const url = `${base}${family}-${variant}.${format}`;
        const face = new FontFace(family, `url(${JSON.stringify(url)}) format("${formatName}")`, { style, weight });
        fontSet.add(face);
        return face;
    });
    registered.set(key, faces);
    return faces;
}

// Per FontFaceSet: font face (without the size) -> LOADED, GAVE_UP (failed
// or not defined; tried again by the next loadFonts), or the promise while
// loading.
const LOADED = "loaded";
const GAVE_UP = "gave up";
const sets = new WeakMap();

function stateOf(fontSet) {
    let s = sets.get(fontSet);
    if (!s) {
        s = { faces: new Map(), warned: new Set(), registered: new Map() };
        sets.set(fontSet, s);
    }
    return s;
}

function faceOf(font) {
    return font.replace(/ [\d.]+px /, " ");
}

const unquote = (family) => family.trim().replace(/^["']|["']$/g, "");

/**
 * Whether the browser has loaded `font` already, e.g. for KaTeX's HTML output
 * on the same page: `check` is also true when no face matches at all, hence
 * the look for a loaded face of the family.
 */
function loadedByBrowser(fontSet, font) {
    if (typeof fontSet.check !== "function" || typeof fontSet[Symbol.iterator] !== "function") return false;
    try {
        if (!fontSet.check(font)) return false;
    } catch {
        return false;
    }
    const family = unquote(font.slice(font.indexOf("px ") + 3).split(",")[0]);
    for (const face of fontSet) if (face.status === "loaded" && unquote(face.family) === family) return true;
    return false;
}

/** The state of `font`'s face, noting faces the browser loaded already. */
function settle(fontSet, faces, font) {
    const face = faceOf(font);
    let s = faces.get(face);
    if ((s === undefined || s === GAVE_UP) && loadedByBrowser(fontSet, font)) {
        s = LOADED;
        faces.set(face, s);
    }
    return s;
}

/**
 * Whether `loadFonts` is done with all of `fonts` (a box's `fonts`): each is
 * loaded, or was given up on (it failed to load or is not defined). A
 * synchronous caller can draw once this is true, in fallback fonts where
 * given up.
 *
 * @param {string[]} fonts
 * @param {{fontSet?: FontFaceSet}} [options]
 */
export function fontsLoaded(fonts, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) return true;
    const { faces } = stateOf(fontSet);
    return fonts.every((font) => {
        const s = settle(fontSet, faces, font);
        return s === LOADED || s === GAVE_UP;
    });
}

/** Whether all of `fonts` are really loaded (none given up on); internal. */
export function fontsReady(fonts, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) return true;
    const { faces } = stateOf(fontSet);
    return fonts.every((font) => settle(fontSet, faces, font) === LOADED);
}

/**
 * Loads `fonts` (a box's `fonts`). Resolves to true if any of them became
 * available, i.e. if a layout made before needs to be redone. A face that
 * fails to load or is not defined (no `katex.css` or `registerKatexFonts`
 * yet) is reported once with console.warn and given up on for now, so that
 * nobody waits forever; the next `loadFonts` tries it again.
 *
 * @param {string[]} fonts
 * @param {{fontSet?: FontFaceSet}} [options]
 * @returns {Promise<boolean>}
 */
export async function loadFonts(fonts, options = {}) {
    const fontSet = options.fontSet || defaultFontSet();
    if (!fontSet) return false;
    const { faces, warned } = stateOf(fontSet);
    const giveUp = (face, why) => {
        faces.set(face, GAVE_UP);
        if (warned.has(face)) return false;
        warned.add(face);
        console.warn(`katex-canvas: font ${face} ${why}; formulas use a fallback font`);
        return false;
    };
    const results = await Promise.all(
        fonts.map((font) => {
            const face = faceOf(font);
            const s = faces.get(face);
            if (s === LOADED) return false;
            // Loaded meanwhile by the browser: a layout made before may have
            // used a fallback, so this counts as having become available.
            if ((s === undefined || s === GAVE_UP) && loadedByBrowser(fontSet, font)) {
                faces.set(face, LOADED);
                return true;
            }
            if (s !== undefined && s !== GAVE_UP) return s;
            const loading = fontSet.load(font).then(
                (loaded) => {
                    if (loaded.length === 0) {
                        return giveUp(face, "is not defined (load katex.css or call registerKatexFonts)");
                    }
                    faces.set(face, LOADED);
                    return true;
                },
                (e) => giveUp(face, `could not be loaded (${(e && e.message) || e})`),
            );
            faces.set(face, loading);
            return loading;
        }),
    );
    return results.some(Boolean);
}
