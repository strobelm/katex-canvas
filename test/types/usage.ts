// Type-checked by `npm run test:types`: the declarations fit KaTeX's own
// typings and the documented usage.
import katex from "katex";
import { fontsLoaded, layout, layoutTeX, layoutTeXSync, loadFonts, registerKatexFonts, render } from "katex-canvas";
import type { Box, HtmlTree } from "katex-canvas";

declare const canvas: HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

async function main(): Promise<void> {
    const box: Box = await layoutTeX(katex, "\\frac{a}{b}", ctx, { fontSize: 24, katexOptions: { displayMode: true } });
    render(ctx, box, 10, 10 + box.height);

    let sync = layoutTeXSync(katex, "x^2", ctx, { fontSize: 24 });
    if (!fontsLoaded(sync.fonts) && (await loadFonts(sync.fonts))) {
        sync = layoutTeXSync(katex, "x^2", ctx, { fontSize: 24 });
    }
    render(ctx, sync, 0, 0, { outline: true });

    const tree: HtmlTree = (katex as unknown as { __renderToHTMLTree(t: string): HtmlTree }).__renderToHTMLTree("y");
    layout(tree, ctx, { fontSize: 20, pixelRatio: devicePixelRatio });

    const offscreen = new OffscreenCanvas(100, 100).getContext("2d")!;
    render(offscreen, box, 0, 0);
    registerKatexFonts(new URL("https://example.com/fonts/"), { format: "woff" });
}

main();
