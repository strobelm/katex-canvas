import { devices } from "@playwright/test";

import base from "./playwright.config.mjs";

/**
 * The comparison suite in Firefox and WebKit (`npm run test:engines`). Not
 * required to pass: Firefox measures canvas text slightly wider than its
 * own HTML text, see the README. CI runs it for information.
 */
const use = { viewport: { width: 4000, height: 2400 }, deviceScaleFactor: 1 };

export default {
    ...base,
    use: {},
    projects: [
        { name: "firefox", use: { ...devices["Desktop Firefox"], ...use } },
        { name: "webkit", use: { ...devices["Desktop Safari"], ...use } },
    ],
};
