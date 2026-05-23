import { AxePuppeteer } from "@axe-core/puppeteer";
import puppeteer from "puppeteer";

async function runBasicAccessibilityCheck() {
  console.log("Starting basic accessibility check...");

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Test local HTML files
    console.log("Testing index.html...");
    await page.goto(`file://${process.cwd()}/index.html`);

    // Basic checks
    const title = await page.title();
    console.log(`Page title: ${title}`);

    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', hs => hs.map(h => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent.trim()
    })));
    console.log(`Found ${headings.length} headings`);

    // Check for missing alt text
    const images = await page.$$eval('img', imgs => imgs.map(img => ({
      src: img.src,
      alt: img.alt,
      hasAlt: img.hasAttribute('alt')
    })));

    const missingAlt = images.filter(img => !img.hasAlt);
    console.log(`Images: ${images.length} total, ${missingAlt.length} missing alt text`);

    // Check for forms
    const inputs = await page.$$eval('input, textarea, select', elements =>
      elements.map(el => ({
        type: el.type || el.tagName.toLowerCase(),
        hasLabel: el.id && !!document.querySelector(`label[for="${el.id}"]`),
        hasAriaLabel: el.hasAttribute('aria-label')
      }))
    );

    const unlabeledInputs = inputs.filter(inp => !inp.hasLabel && !inp.hasAriaLabel);
    console.log(`Form inputs: ${inputs.length} total, ${unlabeledInputs.length} unlabeled`);

    // Check for landmarks
    const landmarks = await page.$$eval('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]', els => els.length);
    console.log(`ARIA landmarks: ${landmarks}`);

    await browser.close();

    console.log("\nBasic accessibility check completed!");
    console.log("Summary:");
    console.log(`- Missing alt text: ${missingAlt.length}`);
    console.log(`- Unlabeled inputs: ${unlabeledInputs.length}`);
    console.log(`- Landmarks found: ${landmarks}`);

  } catch (error) {
    console.error("Error during accessibility check:", error);
  }
}

runBasicAccessibilityCheck();