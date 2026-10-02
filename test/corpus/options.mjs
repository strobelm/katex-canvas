// Shared by the node side and the browser harness, so free of node imports.

/** The KaTeX options a test case is rendered with. */
export function katexOptions(testCase) {
    return {
        strict: "ignore",
        displayMode: testCase.display,
        throwOnError: !testCase.noThrow,
        errorColor: testCase.errorColor || undefined,
        trust: true,
        macros: Object.assign({}, testCase.macros || {}),
    };
}
