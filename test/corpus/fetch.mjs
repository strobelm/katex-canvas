/**
 * Fetches KaTeX's screenshot test cases (test/screenshotter/ss_data.yaml)
 * for a KaTeX version and converts them into the corpus format:
 *
 *     node test/corpus/fetch.mjs [version] [--frozen]
 *
 * The version defaults to the installed one. The result goes to
 * test/corpus/cache/katex-<version>.json, which the corpus prefers over the
 * committed snapshot (katex-screenshotter.json); with --frozen it replaces
 * that snapshot instead.
 *
 * The test cases are part of KaTeX, MIT licensed; see LICENSE-KaTeX.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";

// KaTeX's test image, replaced by one of ours (relative to the harness page).
const KATEX_IMAGE = "../../website/static/img/khan-academy.png";
export const IMAGE = "../corpus/image.png";

export function convert(yamlText) {
    const cases = {};
    for (const [name, entry] of Object.entries(parse(yamlText))) {
        const e = typeof entry === "string" ? { tex: entry } : entry;
        // `pre`, `post` and `styles` decorate the surrounding HTML, which a
        // canvas has none of; `nolatex` concerns KaTeX's LaTeX comparison.
        const c = { tex: e.tex.replaceAll(KATEX_IMAGE, IMAGE).replace(/\n$/, "") };
        if (e.display) c.display = true;
        if (e.macros) c.macros = e.macros;
        if (e.noThrow) c.noThrow = true;
        if (e.errorColor) c.errorColor = e.errorColor;
        cases[name] = c;
    }
    return cases;
}

async function main() {
    const args = process.argv.slice(2);
    const frozen = args.includes("--frozen");
    const version =
        args.find((a) => !a.startsWith("--")) ||
        JSON.parse(readFileSync(new URL("../../node_modules/katex/package.json", import.meta.url), "utf8")).version;
    const url = `https://raw.githubusercontent.com/KaTeX/KaTeX/v${version}/test/screenshotter/ss_data.yaml`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
    const cases = convert(await response.text());
    const out = frozen
        ? new URL("./katex-screenshotter.json", import.meta.url)
        : new URL(`./cache/katex-${version}.json`, import.meta.url);
    mkdirSync(new URL("./cache/", import.meta.url), { recursive: true });
    writeFileSync(out, JSON.stringify({ version, cases }, null, 1) + "\n");
    console.log(`${Object.keys(cases).length} cases of KaTeX ${version} -> ${out.pathname}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
