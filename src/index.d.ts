/**
 * The context `layout` measures with: any 2D canvas context, or a stand-in
 * with these members.
 */
export interface MeasuringContext {
    font: string;
    fillStyle?: unknown;
    save(): void;
    restore(): void;
    measureText(text: string): { width: number; fontBoundingBoxAscent?: number; fontBoundingBoxDescent?: number };
}

/** The context `render` draws on. */
export type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The tree returned by KaTeX's `__renderToHTMLTree`; its shape is KaTeX's business. */
export type HtmlTree = object & { readonly __katexHtmlTree?: never };

/**
 * The KaTeX module. KaTeX's own typings do not declare the internal
 * `__renderToHTMLTree` this package relies on, hence optional here; its
 * presence is checked at runtime.
 */
export interface KatexLike {
    version: string;
    __renderToHTMLTree?(tex: string, options?: object): HtmlTree;
}

/** Images for `\includegraphics`, by URL; anything `drawImage` accepts. */
export type Images = Record<string, CanvasImageSource | null | undefined>;

export interface LayoutOptions {
    /** CSS pixels per TeX em: the font size of KaTeX's `.katex` element. */
    fontSize: number;
    /**
     * Device pixels per CSS pixel. If given, rules are snapped to device
     * pixels as browsers do, which makes the result match KaTeX's HTML
     * output when drawn without rotation or scaling.
     */
    pixelRatio?: number | null;
    /** Width that equation tags (`\tag`) are right-aligned to; defaults to the formula's width. */
    displayWidth?: number;
    /** Loaded images; their natural size matters for images with only one of width and height given. */
    images?: Images;
}

/** A laid-out formula. Coordinates are CSS pixels, relative to the left end of the baseline. */
export interface Box {
    width: number;
    /** Extent above the baseline. */
    height: number;
    /** Extent below the baseline. */
    depth: number;
    /** CSS font strings of the KaTeX faces used; load them before the layout counts as final. */
    fonts: string[];
    /** URLs of `\includegraphics` images, to be passed to `layout` and `render` once loaded. */
    images: string[];
    /** Constructs that could not be laid out (empty if all is well). */
    unsupported: string[];
    /** The drawing operations; internal, may change in any release. */
    readonly ops: unknown[];
}

export interface RenderOptions {
    /** Loaded images by URL; missing ones are skipped. */
    images?: Images;
    /** Stroke everything with the context's stroke style and line width before filling. */
    outline?: boolean;
    /** Which point of the box x refers to, as the canvas' `textAlign`. Default "left". */
    align?: "left" | "center" | "right";
    /** Which point of the box y refers to, as the canvas' `textBaseline`. Default "alphabetic" (the baseline). */
    baseline?: "alphabetic" | "top" | "middle" | "bottom";
}

export interface TeXOptions extends LayoutOptions {
    /** Options for KaTeX, as for `katex.render`. */
    katexOptions?: object;
    /** The FontFaceSet to load fonts into; default `document.fonts`, or `self.fonts` in workers. */
    fontSet?: FontFaceSet;
}

export interface FontOptions {
    fontSet?: FontFaceSet;
}

/** The KaTeX versions this release is tested with, as a semver range. */
export const SUPPORTED_KATEX: string;

/** Lays out a tree from `katex.__renderToHTMLTree`. */
export function layout(tree: HtmlTree, ctx: MeasuringContext, options: LayoutOptions): Box;

/** Draws a box at (x, y), by default the left end of its baseline, in the context's current fill style. */
export function render(ctx: DrawingContext, box: Box, x: number, y: number, options?: RenderOptions): void;

/** Typesets and lays out `tex` without waiting for fonts (see `fontsLoaded`). Throws KaTeX's ParseError. */
export function layoutTeXSync(katex: KatexLike, tex: string, ctx: MeasuringContext, options: TeXOptions): Box;

/** Typesets and lays out `tex`, loading the fonts it needs first. */
export function layoutTeX(katex: KatexLike, tex: string, ctx: MeasuringContext, options: TeXOptions): Promise<Box>;

/** Typesets, lays out and draws `tex` at (x, y) like `fillText`; resolves to the box. */
export function drawTeX(
    katex: KatexLike,
    ctx: DrawingContext,
    tex: string,
    x: number,
    y: number,
    options: TeXOptions & RenderOptions,
): Promise<Box>;

/** Whether all of `fonts` have been loaded by `loadFonts`. */
export function fontsLoaded(fonts: readonly string[], options?: FontOptions): boolean;

/** Loads `fonts`; resolves to true if a layout made before needs to be redone. */
export function loadFonts(fonts: readonly string[], options?: FontOptions): Promise<boolean>;

/** Registers KaTeX's fonts from `baseUrl` (KaTeX's `dist/fonts/` directory) without `katex.css`. */
export function registerKatexFonts(
    baseUrl: string | URL,
    options?: FontOptions & { format?: "woff2" | "woff" | "ttf" },
): FontFace[];
