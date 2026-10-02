/**
 * Collects the per-case results of the comparison suite into a gallery
 * (report/index.html) and a summary, and regenerates
 * expectations.json when KATEX_CANVAS_UPDATE is set.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { katexCorpusVersion } from "../corpus/index.mjs";

export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
export const OUT_DIR = join(REPO_ROOT, "report");
export const EXPECTATIONS_FILE = join(REPO_ROOT, "test/browser/expectations.json");

export function fileName(id) {
    return id.replace(/[^A-Za-z0-9_-]/g, "_");
}

function escape(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function fmt(stats) {
    return stats ? (100 * stats.score).toFixed(2) + "%" : "–";
}

function shiftText(stats) {
    if (!stats || !stats.shift) return "";
    const s = stats.shift;
    return `ink edges Δ l${s.left} r${s.right} t${s.top} b${s.bottom}`;
}

const ORDER = { fail: 0, unsupported: 1, error: 2, pass: 3 };

export async function writeReport() {
    const dir = join(OUT_DIR, "results");
    let files;
    try {
        files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
        return;
    }
    const results = files.map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
    if (results.length === 0) return;
    results.sort(
        (a, b) =>
            ORDER[a.status] - ORDER[b.status] ||
            (b.stats ? b.stats.score : 0) - (a.stats ? a.stats.score : 0) ||
            a.id.localeCompare(b.id),
    );

    const counts = {};
    for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
    const katexVersion = JSON.parse(readFileSync(join(REPO_ROOT, "node_modules/katex/package.json"), "utf8")).version;
    const summary = { katex: katexVersion, corpus: katexCorpusVersion, total: results.length, counts };
    writeFileSync(join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));

    if (process.env.KATEX_CANVAS_UPDATE) {
        // Notes explaining known deviations are kept across updates.
        const previous = JSON.parse(readFileSync(EXPECTATIONS_FILE, "utf8"));
        const expectations = {};
        for (const r of results) {
            if (r.status === "fail" || r.status === "unsupported") {
                expectations[r.id] = { status: r.status, score: Math.round(r.stats.score * 1e4) / 1e4 };
                if (previous[r.id] && previous[r.id].note) expectations[r.id].note = previous[r.id].note;
            }
        }
        const sorted = Object.fromEntries(
            Object.keys(expectations)
                .sort()
                .map((k) => [k, expectations[k]]),
        );
        writeFileSync(EXPECTATIONS_FILE, JSON.stringify(sorted, null, 4) + "\n");
    }

    const rows = results
        .map((r) => {
            const img = r.status === "error" ? "" : `<img loading="lazy" src="img/${fileName(r.id)}.png">`;
            const details = [
                r.unsupported && r.unsupported.length ? `unsupported: ${r.unsupported.join(", ")}` : "",
                r.error ? `error: ${r.error}` : "",
                ...(r.problems || []),
                r.note ? `note: ${r.note}` : "",
                shiftText(r.stats),
            ]
                .filter(Boolean)
                .map(escape)
                .join("<br>");
            return `<tr class="${r.status}" data-set="${r.set}">
<td><b>${escape(r.id)}</b><br><span class="status">${r.status}</span></td>
<td class="num">${fmt(r.stats)}</td>
<td><code>${escape(r.tex)}</code><div class="details">${details}</div>${img}</td></tr>`;
        })
        .join("\n");

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>KaTeX canvas comparison</title>
<style>
body { font: 14px system-ui, sans-serif; margin: 16px; color: #222; background: #fafafa; }
table { border-collapse: collapse; width: 100%; }
td { border-top: 1px solid #ddd; padding: 8px; vertical-align: top; }
td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.fail .status { color: #c00; } tr.unsupported .status { color: #b60; }
tr.pass .status { color: #080; } tr.error .status { color: #666; }
code { white-space: pre-wrap; word-break: break-all; font-size: 12px; }
.details { color: #666; font-size: 12px; margin: 4px 0; }
img { display: block; max-width: 100%; margin-top: 6px; border: 1px solid #ccc; image-rendering: pixelated; }
.bar button { margin-right: 6px; }
.legend { color: #555; }
</style></head><body>
<h1>katex-canvas vs. KaTeX's HTML output</h1>
<p>KaTeX ${katexVersion}, screenshot cases from ${katexCorpusVersion}. ${results.length} formulas: ${Object.entries(
        counts,
    )
        .map(([k, v]) => `${v} ${k}`)
        .join(", ")}.</p>
<p class="legend">Images: reference (KaTeX HTML) | canvas | diff.
In the diffs, red marks ink only in the reference and blue ink only in the canvas.
Scores are mismatched pixels per inked reference pixel.</p>
<p class="bar">Show: <button data-f="all">all</button><button data-f="fail">fail</button>
<button data-f="unsupported">unsupported</button><button data-f="pass">pass</button><button data-f="error">error</button>
&nbsp; Set: <button data-s="all">all</button><button data-s="core">core</button>
<button data-s="everyday">everyday</button><button data-s="katex">katex</button></p>
<table><thead><tr><td>case</td><td>score</td><td>formula</td></tr></thead><tbody>
${rows}
</tbody></table>
<script>
let f = "all", s = "all";
function apply() {
    for (const tr of document.querySelectorAll("tbody tr")) {
        tr.hidden = (f !== "all" && tr.className !== f) || (s !== "all" && tr.dataset.set !== s);
    }
}
document.querySelectorAll("button[data-f]").forEach((b) => b.onclick = () => { f = b.dataset.f; apply(); });
document.querySelectorAll("button[data-s]").forEach((b) => b.onclick = () => { s = b.dataset.s; apply(); });
</script>
</body></html>
`;
    writeFileSync(join(OUT_DIR, "index.html"), html);
}
