// The worker of worker.html: draws on an OffscreenCanvas without DOM or
// stylesheet.

import katex from "https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.mjs";
import { drawTeX, registerKatexFonts } from "../src/index.mjs";

registerKatexFonts("https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/fonts/");

let ctx;
let size;
let colors;

// Only the latest formula is drawn; typing faster than drawing skips some.
let pending = null;
let busy = false;

self.onmessage = ({ data }) => {
    if (data.canvas) {
        ctx = data.canvas.getContext("2d");
        ctx.scale(data.ratio, data.ratio);
        size = data;
        colors = data.colors;
        return;
    }
    pending = data.tex;
    drawLatest();
};

async function drawLatest() {
    if (busy) return;
    busy = true;
    while (pending !== null) {
        const tex = pending;
        pending = null;
        const start = performance.now();
        try {
            ctx.clearRect(0, 0, size.width, size.height);
            ctx.fillStyle = colors.ink;
            await drawTeX(katex, ctx, tex, size.width / 2, size.height / 2, {
                fontSize: 30,
                align: "center",
                baseline: "middle",
                katexOptions: { displayMode: true, strict: "ignore" },
            });
            self.postMessage({ ms: performance.now() - start });
        } catch (e) {
            self.postMessage({ error: e.message });
        }
    }
    busy = false;
}
