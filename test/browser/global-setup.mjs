/**
 * Playwright global setup: starts the static server for the harness page
 * and, on teardown, writes the gallery (report/index.html) from the
 * per-case results.
 */

import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { OUT_DIR, REPO_ROOT, writeReport } from "./report.mjs";
import { startStaticServer } from "./static-server.mjs";

export default async function globalSetup() {
    await rm(join(OUT_DIR, "results"), { recursive: true, force: true });
    await rm(join(OUT_DIR, "img"), { recursive: true, force: true });
    await mkdir(join(OUT_DIR, "results"), { recursive: true });
    await mkdir(join(OUT_DIR, "img"), { recursive: true });

    const server = await startStaticServer(REPO_ROOT);
    process.env.HARNESS_BASE_URL = server.url;

    return async () => {
        await server.close();
        await writeReport();
    };
}
