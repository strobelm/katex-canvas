import { readFileSync } from "node:fs";

import { assert } from "chai";
import katex from "katex";

import {
    drawTeX,
    fontsLoaded,
    layout,
    layoutTeX,
    layoutTeXSync,
    loadFonts,
    registerKatexFonts,
    render,
    SUPPORTED_KATEX,
} from "../../src/index.mjs";

// The convenience layer: font loading, layoutTeX and the KaTeX version check.

const measureCtx = {
    font: "",
    save() {},
    restore() {},
    measureText(text) {
        // Wider once the font is "loaded", to see the second layout.
        return { width: (loadedFaces.has(this.font.replace(/ [\d.]+px /, " ")) ? 10 : 7) * text.length };
    },
};

let loadedFaces = new Set();

/** A FontFaceSet stand-in that knows the given families. */
function fakeFontSet(families, { fail = false } = {}) {
    const set = {
        loads: [],
        added: [],
        add(face) {
            this.added.push(face);
        },
        load(font) {
            this.loads.push(font);
            const family = font.split(" ").pop();
            if (fail) return Promise.reject(new Error("network error"));
            if (!families.includes(family)) return Promise.resolve([]);
            loadedFaces.add(font.replace(/ [\d.]+px /, " "));
            return Promise.resolve([{ family }]);
        },
    };
    return set;
}

function quietly(fn) {
    const warn = console.warn;
    const warnings = [];
    console.warn = (m) => warnings.push(m);
    return Promise.resolve(fn())
        .finally(() => (console.warn = warn))
        .then((r) => ({ result: r, warnings }));
}

describe("font loading", function () {
    beforeEach(function () {
        loadedFaces = new Set();
    });

    it("loads every face once and reports whether anything was new", async function () {
        const fontSet = fakeFontSet(["KaTeX_Main", "KaTeX_Math"]);
        const fonts = ["normal normal 20px KaTeX_Main", "italic normal 20px KaTeX_Math"];
        assert.isFalse(fontsLoaded(fonts, { fontSet }));
        assert.isTrue(await loadFonts(fonts, { fontSet }));
        assert.isTrue(fontsLoaded(fonts, { fontSet }));
        // Other sizes of the same faces are loaded already.
        assert.isFalse(await loadFonts(["normal normal 30px KaTeX_Main"], { fontSet }));
        assert.lengthOf(fontSet.loads, 2);
    });

    it("gives up on faces that fail to load, with a warning, and retries them", async function () {
        const fontSet = fakeFontSet([], { fail: true });
        const fonts = ["normal normal 20px KaTeX_AMS"];
        const { result, warnings } = await quietly(() => loadFonts(fonts, { fontSet }));
        assert.isFalse(result);
        assert.isTrue(fontsLoaded(fonts, { fontSet }));
        assert.match(warnings[0], /KaTeX_AMS could not be loaded/);
        const again = await quietly(() => loadFonts(fonts, { fontSet }));
        assert.lengthOf(fontSet.loads, 2);
        assert.lengthOf(again.warnings, 0, "warned once");
    });

    it("loads faces that were not defined yet once they are", async function () {
        const families = [];
        const fontSet = fakeFontSet(families);
        const fonts = ["normal normal 20px KaTeX_Script"];
        const { result, warnings } = await quietly(() => loadFonts(fonts, { fontSet }));
        // Nothing to lay out again for, but nothing to wait for either.
        assert.isFalse(result);
        assert.isTrue(fontsLoaded(fonts, { fontSet }));
        assert.match(warnings[0], /KaTeX_Script is not defined/);
        families.push("KaTeX_Script"); // the stylesheet arrived
        assert.isTrue(await loadFonts(fonts, { fontSet }));
        assert.isFalse(await loadFonts(fonts, { fontSet }));
        assert.lengthOf(fontSet.loads, 2);
    });

    it("registers KaTeX's faces", function () {
        const created = [];
        globalThis.FontFace = class {
            constructor(family, source, descriptors) {
                Object.assign(this, { family, source, ...descriptors });
                created.push(this);
            }
        };
        try {
            const fontSet = fakeFontSet([]);
            const faces = registerKatexFonts("https://example.com/katex/fonts", { fontSet });
            assert.lengthOf(faces, 20);
            assert.deepEqual(fontSet.added, created);
            const bold = faces.find((f) => f.family === "KaTeX_Main" && f.weight === "bold" && f.style === "italic");
            assert.equal(
                bold.source,
                'url("https://example.com/katex/fonts/KaTeX_Main-BoldItalic.woff2") format("woff2")',
            );
            const size1 = faces.find((f) => f.family === "KaTeX_Size1");
            assert.include(size1.source, "/KaTeX_Size1-Regular.woff2");
            assert.strictEqual(registerKatexFonts("https://example.com/katex/fonts/", { fontSet }), faces);
            assert.lengthOf(fontSet.added, 20, "registered once");
            assert.lengthOf(registerKatexFonts("https://example.com/katex/fonts", { fontSet, format: "woff" }), 20);
            assert.throws(() => registerKatexFonts("x", { fontSet, format: "otf" }), /unknown format/);
        } finally {
            delete globalThis.FontFace;
        }
    });
});

describe("layoutTeX", function () {
    beforeEach(function () {
        loadedFaces = new Set();
    });

    it("lays out again once the fonts are loaded", async function () {
        const fontSet = fakeFontSet(["KaTeX_Main", "KaTeX_Math"]);
        const before = layoutTeXSync(katex, measureCtx, "ab", { fontSize: 20 });
        const box = await layoutTeX(katex, measureCtx, "ab", { fontSize: 20, fontSet });
        assert.isAbove(box.width, before.width);
        assert.deepEqual(box.fonts, ["italic normal 20px KaTeX_Math"]);
    });

    it("passes KaTeX options through", function () {
        const box = layoutTeXSync(katex, measureCtx, "\\R", {
            fontSize: 20,
            katexOptions: { macros: { "\\R": "\\mathbb{R}" } },
        });
        assert.deepEqual(box.fonts, ["normal normal 20px KaTeX_AMS"]);
        assert.throws(() => layoutTeXSync(katex, measureCtx, "\\frac{", { fontSize: 20 }), katex.ParseError);
    });

    it("rejects a missing font size and things that are not KaTeX", function () {
        assert.throws(() => layoutTeXSync(katex, measureCtx, "x"), /fontSize must be a positive number/);
        assert.throws(() => layoutTeXSync(katex, measureCtx, "x", { fontSize: NaN }), /fontSize/);
        const notKatex = { version: "0.19.0" };
        for (let i = 0; i < 2; ++i) {
            assert.throws(() => layoutTeXSync(notKatex, measureCtx, "x", { fontSize: 20 }), /pass the KaTeX module/);
        }
    });

    it("warns about untested KaTeX versions, once per module", async function () {
        const fake = { version: "0.16.4", __renderToHTMLTree: katex.__renderToHTMLTree };
        const { warnings } = await quietly(() => {
            layoutTeXSync(fake, measureCtx, "x", { fontSize: 20 });
            layoutTeXSync(fake, measureCtx, "y", { fontSize: 20 });
        });
        assert.lengthOf(warnings, 1);
        assert.match(warnings[0], /KaTeX 0\.16\.4 is outside the tested range/);
        const current = await quietly(() => layoutTeXSync(katex, measureCtx, "x", { fontSize: 20 }));
        assert.lengthOf(current.warnings, 0);
    });
});

describe("colours", function () {
    it("drops colours the canvas does not accept", function () {
        // A context that, like a real one, ignores invalid fill styles.
        const ctx = {
            ...measureCtx,
            style: "#000000",
            get fillStyle() {
                return this.style;
            },
            set fillStyle(v) {
                if (/^(#[0-9a-f]{6}|red|blue)$/.test(v)) this.style = v === "red" ? "#ff0000" : v;
            },
        };
        const tree = katex.__renderToHTMLTree("\\color{red}{a\\color{nocolour}{b}}", { strict: "ignore" });
        const box = layout(tree, ctx, { fontSize: 20 });
        const colours = [];
        (function walk(ops) {
            for (const op of ops) {
                if (op.type === "text") colours.push([op.text, op.color]);
                if (op.ops) walk(op.ops);
            }
        })(box.ops);
        assert.deepEqual(colours, [
            ["a", "red"],
            ["b", "red"],
        ]);
    });
});

describe("colours without CSS.supports", function () {
    // A context that, like a real one, ignores invalid fill styles.
    function strictCtx() {
        return {
            ...measureCtx,
            style: "#000000",
            get fillStyle() {
                return this.style;
            },
            set fillStyle(v) {
                if (/^(#[0-9a-f]{6}|red|blue)$/.test(v)) this.style = v === "red" ? "#ff0000" : v;
            },
        };
    }

    it("are checked on the context by layoutTeX too", async function () {
        const box = await layoutTeX(katex, strictCtx(), "\\textcolor{bogus}{x}", {
            fontSize: 20,
            fontSet: fakeFontSet(["KaTeX_Math"]),
        });
        const texts = [];
        (function walk(ops) {
            for (const op of ops) {
                if (op.type === "text") texts.push(op.color);
                if (op.ops) walk(op.ops);
            }
        })(box.ops);
        assert.deepEqual(texts, [null]);
    });
});

describe("package", function () {
    it("states the supported KaTeX versions in one way", function () {
        const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
        assert.equal(SUPPORTED_KATEX, pkg.peerDependencies.katex);
    });
});

describe("fonts the browser loaded already", function () {
    it("count as loaded", function () {
        const fontSet = Object.assign([{ family: '"KaTeX_Main"', status: "loaded" }], {
            check: () => true,
            load: () => assert.fail("nothing to load"),
        });
        assert.isTrue(fontsLoaded(["normal normal 20px KaTeX_Main"], { fontSet }));
        // check() is also true for faces that are not defined at all.
        assert.isFalse(fontsLoaded(["normal normal 20px KaTeX_AMS"], { fontSet: Object.assign([], fontSet) }));
    });
});

describe("render and drawTeX", function () {
    function recordingCtx() {
        return {
            ...measureCtx,
            fillStyle: "#000000",
            translations: [],
            getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
            setTransform() {},
            translate(x, y) {
                this.translations.push([x, y]);
            },
            fillText() {},
            fillRect() {},
        };
    }

    it("anchors the box like fillText", function () {
        const box = { width: 40, height: 12, depth: 4, ops: [] };
        const at = (options) => {
            const ctx = recordingCtx();
            render(ctx, box, 100, 50, options);
            return ctx.translations[0];
        };
        assert.deepEqual(at(), [100, 50]);
        assert.deepEqual(at({ align: "center", baseline: "top" }), [80, 62]);
        assert.deepEqual(at({ align: "right", baseline: "bottom" }), [60, 46]);
        assert.deepEqual(at({ baseline: "middle" }), [100, 54]);
        assert.throws(() => at({ align: "middle" }), /unknown align/);
    });

    it("draws right away when the fonts are loaded", function () {
        const ctx = recordingCtx();
        const fontSet = Object.assign([{ family: "KaTeX_Math", status: "loaded" }], { check: () => true });
        drawTeX(katex, ctx, "x", 10, 20, { fontSize: 20, fontSet });
        assert.lengthOf(ctx.translations, 1, "drawn synchronously");
    });

    it("draws later with the context's state at the call", async function () {
        const ctx = {
            ...recordingCtx(),
            transform: "T0",
            fills: [],
            getTransform() {
                return this.transform;
            },
            setTransform(t) {
                this.transform = t;
            },
            fillText() {
                this.fills.push([this.fillStyle, this.transform]);
            },
        };
        ctx.fillStyle = "red";
        ctx.transform = "T1";
        const drawn = drawTeX(katex, ctx, "x", 10, 20, { fontSize: 20, fontSet: fakeFontSet(["KaTeX_Math"]) });
        ctx.fillStyle = "blue";
        ctx.transform = "T2";
        await drawn;
        assert.deepEqual(ctx.fills, [["red", "T1"]]);
    });

    it("rejects parse errors", async function () {
        let error = null;
        await drawTeX(katex, recordingCtx(), "\\frac{", 0, 0, { fontSize: 20 }).catch((e) => (error = e));
        assert.instanceOf(error, katex.ParseError);
    });

    it("draws in one call", async function () {
        const ctx = recordingCtx();
        const box = await drawTeX(katex, ctx, "x", 10, 20, {
            fontSize: 20,
            align: "right",
            fontSet: fakeFontSet(["KaTeX_Math"]),
        });
        assert.isAbove(box.width, 0);
        assert.deepEqual(ctx.translations[0], [10 - box.width, 20]);
    });
});
