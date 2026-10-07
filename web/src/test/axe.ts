import axe from "axe-core";

/*
 * Automated accessibility checks with axe-core, the engine behind most
 * accessibility tooling (browser extensions, Lighthouse). Used directly
 * rather than through a wrapper package: the common Vitest wrapper hasn't
 * had a stable release since 2022, and this is all it would add.
 */

/** WCAG 2.0, 2.1, and 2.2 at levels A and AA (our target), plus axe's best-practice rules. */
const RULE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/**
 * Runs axe against the rendered page and fails the test with a readable
 * list of violations: rule, impact, what it means, and which elements.
 *
 * Colour contrast is switched off on purpose. jsdom doesn't render real
 * colours or layout, so axe can't measure contrast here and would only
 * report it as "incomplete". Contrast is covered instead by the ratios
 * calculated for every colour pair in styles/tokens.css. Automated checks
 * also can't judge things like whether copy makes sense or focus order
 * feels right, so these tests complement manual keyboard and screen
 * reader checks rather than replacing them.
 *
 * @param root - What to check. Defaults to the whole document, so landmarks and headings are checked in context.
 */
export async function expectNoAxeViolations(root: Element = document.body): Promise<void> {
  const results = await axe.run(root, {
    runOnly: { type: "tag", values: RULE_TAGS },
    rules: { "color-contrast": { enabled: false } },
  });

  if (results.violations.length === 0) return;

  // Thrown as one readable message rather than compared as an array:
  // Vitest truncates long arrays in failure output ("[ …(2) ]"), which
  // would hide exactly which rule failed and on which element.
  const report = results.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n");
      return `- ${violation.id} (${violation.impact ?? "unknown impact"}): ${violation.help}\n${targets}`;
    })
    .join("\n");

  throw new Error(`axe found ${String(results.violations.length)} accessibility violation(s):\n${report}`);
}
