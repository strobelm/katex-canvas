// Draws formulas on an OffscreenCanvas in a worker, with the fonts
// registered by registerKatexFonts (no katex.css, no DOM). Used by
// worker.spec.mjs.

import katex from "../../node_modules/katex/dist/katex.mjs";
import { layoutTeX, registerKatexFonts, render } from "../../src/index.mjs";

registerKatexFonts(new URL("../../node_modules/katex/dist/fonts/", import.meta.url));

self.onmessage = async ({ data: { tex, fontSize, width, height, x, y } }) => {
    try {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        const box = await layoutTeX(katex, tex, ctx, { fontSize, pixelRatio: 1, katexOptions: { strict: "ignore" } });
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#000";
        render(ctx, box, x, y);
        self.postMessage({ bitmap: canvas.transferToImageBitmap(), width: box.width });
    } catch (e) {
        self.postMessage({ error: String((e && e.stack) || e) });
    }
};
