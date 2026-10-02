// Helpers shared by the examples (not part of the package).

/**
 * Sizes a canvas for the device's pixel ratio: `width` x `height` CSS
 * pixels, drawn in CSS pixel coordinates. Returns the context.
 */
export function hidpi(canvas, width, height) {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
}

/** The width of the content box of the canvas' parent, to fill it. */
export function fitWidth(canvas) {
    const parent = canvas.parentElement;
    const style = getComputedStyle(parent);
    return Math.floor(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
}

/** A colour of the page's theme (shared.css), e.g. "--ink". */
export function themeColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The shared page header. */
export function header(current) {
    const pages = [
        ["index.html", "Overview"],
        ["playground.html", "Playground"],
        ["alignment.html", "Alignment"],
        ["animation.html", "Animation"],
        ["plot.html", "Plot labels"],
        ["worker.html", "Worker"],
        ["../report/index.html", "Comparison gallery"],
    ];
    const nav = pages
        .map(([href, title]) => (href === current ? `<b>${title}</b>` : `<a href="${href}">${title}</a>`))
        .join("");
    document.body.insertAdjacentHTML(
        "afterbegin",
        `<main id="top"><header class="top"><a class="home" href="index.html">katex-canvas</a><nav>${nav}</nav></header></main>`,
    );
    const main = document.getElementById("top");
    for (const el of [...document.body.children]) if (el !== main && el.tagName !== "SCRIPT") main.appendChild(el);
    main.insertAdjacentHTML(
        "beforeend",
        `<footer>katex-canvas is an independent project; it is not affiliated with or endorsed by KaTeX or
        Khan Academy. KaTeX is MIT licensed, its fonts SIL OFL.
        <a href="https://github.com/strobelm/katex-canvas">Source on GitHub</a>.</footer>`,
    );
}
