# katex-canvas

> **Unofficial.** katex-canvas is an independent project. It is not affiliated with, endorsed by or
> maintained by the KaTeX project or Khan Academy. It uses KaTeX, which you install yourself; please
> report problems with this package [here](https://github.com/strobelm/katex-canvas/issues), not to KaTeX.

Draws [KaTeX](https://katex.org) formulas on a 2D canvas: vector glyphs and paths drawn directly on the
context, so formulas follow the context's transform (rotated, scaled, in animations) and need no DOM at
drawing time. The layout reproduces KaTeX's HTML output; in Chromium it is checked pixel by pixel against
it for several hundred formulas, including KaTeX's own screenshot test suite.

**[Examples and playground](https://strobelm.github.io/katex-canvas/examples/)** ·
[comparison gallery](https://strobelm.github.io/katex-canvas/report/)

```js
import katex from "katex";
import { drawTeX } from "katex-canvas";
import "katex/dist/katex.css"; // defines the fonts (or see registerKatexFonts below)

const ctx = canvas.getContext("2d");
ctx.fillStyle = "navy";
await drawTeX(katex, ctx, "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", 200, 50, {
    fontSize: 24,
    align: "center", // like the canvas' textAlign
    baseline: "middle", // like textBaseline
});
```

`npm install katex-canvas katex` — KaTeX is a peer dependency; you choose its version within the supported
range (currently `>=0.18.9 <0.20`).

## API

### `drawTeX(katex, ctx, tex, x, y, options) → Promise<Box>`

Typesets, lays out and draws in one call, like `fillText`. Takes the options of `layoutTeX` and `render`
below. To draw the same formula repeatedly (animations, redraws), lay it out once with `layoutTeX` and call
`render` each time instead.

### `layoutTeX(katex, tex, ctx, options) → Promise<Box>`

Typesets `tex` with the KaTeX module you pass in, loads the fonts the formula needs and lays it out for
`ctx`. Options:

- `fontSize` (required): CSS pixels per TeX em. KaTeX's stylesheet makes `.katex` 1.21 times the surrounding
  font size, so to match HTML text at 20px use `fontSize: 24.2`.
- `katexOptions`: as for `katex.render` (`displayMode`, `macros`, `throwOnError`, …). Parse errors are thrown
  as KaTeX's `ParseError`.
- `pixelRatio`: device pixels per CSS pixel. Pass it when drawing without rotation or scaling (other than
  that pixel ratio) to snap fraction bars and rules to device pixels like browsers do.
- `displayWidth`: width to right-align equation tags (`\tag`) to; defaults to the formula's width.
- `images`: loaded images by URL for `\includegraphics` (see below).
- `fontSet`: the `FontFaceSet` to load fonts into; default `document.fonts`, or `self.fonts` in workers.

The returned box has `width`, `height` (above the baseline), `depth` (below), `fonts`, `images` and
`unsupported` (constructs the backend could not lay out; empty normally). Its `ops` are internal.

### `render(ctx, box, x, y, options?)`

Draws a laid-out box at `(x, y)`. Parts without an explicit `\color` use the context's current
`fillStyle`; the context's transform applies as for any drawing. Options:

- `align`: `"left"` (default), `"center"` or `"right"`, as the canvas' `textAlign`.
- `baseline`: `"alphabetic"` (default: the formula's baseline), `"top"`, `"middle"` or `"bottom"`, as
  `textBaseline`, where top and bottom are the box's extent.
- `outline: true`: first stroke everything with the context's `strokeStyle` and `lineWidth`, e.g. for a
  halo around labels on busy backgrounds.
- `images`: as above.

### Synchronous use: `layoutTeXSync`, `fontsLoaded`, `loadFonts`

For draw loops that cannot wait:

```js
let box = layoutTeXSync(katex, tex, ctx, { fontSize: 24 });
if (!fontsLoaded(box.fonts)) {
    loadFonts(box.fonts).then(requestRedraw); // widths are those of fallback fonts until then
}
render(ctx, box, x, y);
```

`loadFonts(fonts)` resolves to `true` if it loaded anything new. A face that fails to load, or isn't defined
(no `katex.css` or `registerKatexFonts` yet), is given up on with a warning, and text falls back to other
fonts, so define the fonts before the first `loadFonts`.

### Low level: `layout(tree, ctx, options)`

Lays out a tree from KaTeX's internal `katex.__renderToHTMLTree(tex, options)`, with the layout options
above. `layoutTeX` and `layoutTeXSync` are thin wrappers around it.

## Fonts

The formulas use KaTeX's fonts, so they have to be defined:

- **With KaTeX's stylesheet** (`katex/dist/katex.css`, or `katex.min.css`), as for normal KaTeX use.
- **Without it**, e.g. in a worker: `registerKatexFonts(baseUrl)` registers the 20 faces from KaTeX's
  `dist/fonts/` directory, served at `baseUrl`. Faces load on demand.

    ```js
    registerKatexFonts("/assets/katex/fonts/"); // wherever katex/dist/fonts is served
    ```

The fonts are KaTeX's (SIL Open Font License), not part of this package.

In workers, use `layoutTeX`, or load the fonts before the first layout: Chromium keeps measuring a font
string with the fallback font if it was used before its font finished loading.

## Images

`\includegraphics` (with `trust` enabled in the KaTeX options) refers to images by URL. The box lists them
in `images`; load them and pass `{ [url]: image }` as `images` to both `layout` and `render`. Without them
the images are left out, and sizes given only partly can't be resolved.

## Compatibility

- **KaTeX**: the backend relies on KaTeX's internal HTML tree and re-implements the CSS of `katex.css`, so
  every KaTeX minor version is tested before the supported range is widened. A warning is logged for
  versions outside it.
- **Browsers**: Chromium is tested pixel by pixel against KaTeX's HTML, and with `OffscreenCanvas` in a
  worker. In Firefox, canvas text measures slightly wider (about 0.5%) than Firefox's own HTML text, so
  long formulas can be a pixel or two wider than KaTeX's HTML output there. WebKit runs in CI, without
  pixel guarantees yet.
- **Node**: `layout` works with any object providing `measureText`; drawing with node canvas
  implementations is not tested yet.
- Not covered: accessibility (a canvas has no text; consider an `aria-label` or KaTeX's MathML output next
  to it), links (`\href`), text selection.

## Development

```sh
npm install
npx playwright install chromium
npm test                # layout checks in node (mocha)
npm run test:browser    # pixel comparison against KaTeX's HTML; gallery in report/index.html
npm run test:types      # type-checks test/types/usage.ts against src/index.d.ts
npm run corpus [version] # fetch KaTeX's screenshot cases for another KaTeX version
```

Known deviations are recorded in `test/browser/expectations.json`; `KATEX_CANVAS_UPDATE=1 npm run
test:browser` regenerates it after deliberate changes.

## License

MIT, see [LICENSE](LICENSE). KaTeX and its fonts are not included; they are licensed by their authors
(MIT and SIL OFL). katex-canvas is not an official KaTeX package.

The test corpus includes KaTeX's screenshot test cases (MIT, see `test/corpus/LICENSE-KaTeX`).
