// tests/accessibility-test.js
const { AxePuppeteer } = require("@axe-core/puppeteer");
const puppeteer = require("puppeteer");

class AccessibilityAuditor {
  constructor(options = {}) {
    this.wcagLevel = options.wcagLevel || "AA";
    this.viewport = options.viewport || { width: 1920, height: 1080 };
  }

  async runFullAudit(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport(this.viewport);
    await page.goto(url, { waitUntil: "networkidle2" });

    const results = await new AxePuppeteer(page)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".no-a11y-check")
      .analyze();

    await browser.close();

    return {
      url,
      timestamp: new Date().toISOString(),
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          target: n.target,
          failureSummary: n.failureSummary,
        })),
      })),
      score: this.calculateScore(results),
    };
  }

  calculateScore(results) {
    const weights = { critical: 10, serious: 5, moderate: 2, minor: 1 };
    let totalWeight = 0;
    results.violations.forEach((v) => {
      totalWeight += weights[v.impact] || 0;
    });
    return Math.max(0, 100 - totalWeight);
  }
}

async function runAccessibilityTests() {
  const auditor = new AccessibilityAuditor();

  console.log("Running accessibility tests on YouTube SEO tool...");

  try {
    // Test main landing page
    console.log("\nTesting index.html...");
    const landingResults = await auditor.runFullAudit("http://localhost:3000");
    console.log(`Landing page score: ${landingResults.score}/100`);
    console.log(`Violations found: ${landingResults.violations.length}`);

    // Test dashboard (requires authentication, skip for now)
    console.log("\nDashboard testing requires authentication, skipping...");

    // Generate report
    console.log("\nGenerating accessibility report...");
    const report = generateHTMLReport(landingResults);
    require("fs").writeFileSync("accessibility-report.html", report);
    console.log("Report saved to accessibility-report.html");

  } catch (error) {
    console.error("Test failed:", error);
  }
}

function generateHTMLReport(results) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Accessibility Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .score { font-size: 48px; font-weight: bold; }
        .violation { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .critical { border-color: #f00; background: #fee; }
        .serious { border-color: #fa0; background: #ffe; }
    </style>
</head>
<body>
    <h1>Accessibility Audit Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>

    <div class="summary">
        <h2>Summary</h2>
        <div class="score">${results.score}/100</div>
        <p>Total Violations: ${results.violations.length}</p>
    </div>

    <h2>Violations</h2>
    ${results.violations
      .map(
        (v) => `
        <div class="violation ${v.impact}">
            <h3>${v.help}</h3>
            <p><strong>Impact:</strong> ${v.impact}</p>
            <p>${v.description}</p>
            <a href="${v.helpUrl}">Learn more</a>
        </div>
    `,
      )
      .join("")}
</body>
</html>`;
}

if (require.main === module) {
  runAccessibilityTests();
}

module.exports = { AccessibilityAuditor };