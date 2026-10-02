# Changelog

## 0.1.0

First release: the canvas backend of the CindyJS KaTeX plugin as a package of its own.

- `layout` and `render`: lay out a tree from KaTeX's `__renderToHTMLTree` and draw it on a 2D canvas,
  matching KaTeX's HTML output.
- `drawTeX`, `layoutTeX`, `layoutTeXSync`: typeset with the KaTeX module you pass in.
- `render` anchors formulas with `align` and `baseline`, like `textAlign` and `textBaseline`.
- Font loading: `loadFonts`, `fontsLoaded`, and `registerKatexFonts` for use without `katex.css`, e.g. in
  workers.
- Supports KaTeX `>=0.18.9 <0.20`.
