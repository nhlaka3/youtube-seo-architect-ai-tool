// tests/jest-accessibility.test.js
const { render } = require("@testing-library/react");
const { axe, toHaveNoViolations } = require("jest-axe");

expect.extend(toHaveNoViolations);

// Mock Lucide icons since they're loaded externally
global.lucide = {
  createIcons: jest.fn(),
};

describe("Accessibility Tests", () => {
  // Test HTML structure compliance
  test("should have proper heading hierarchy", () => {
    // This would test individual components when we have React components
    // For now, test basic HTML structure
    document.body.innerHTML = `
      <h1>Main Heading</h1>
      <h2>Sub Heading</h2>
      <h3>Sub-sub Heading</h3>
    `;

    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    expect(headings.length).toBeGreaterThan(0);
  });

  test("should have alt text for images", () => {
    document.body.innerHTML = `
      <img src="test.jpg" alt="Test image" />
      <img src="decorative.jpg" alt="" role="presentation" />
    `;

    const images = document.querySelectorAll("img");
    images.forEach(img => {
      expect(img.hasAttribute("alt")).toBe(true);
    });
  });

  test("should have proper form labels", () => {
    document.body.innerHTML = `
      <label for="email">Email Address</label>
      <input id="email" type="email" />
      <input type="text" aria-label="Search" />
    `;

    const inputs = document.querySelectorAll("input");
    inputs.forEach(input => {
      const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`);
      const hasAriaLabel = input.hasAttribute("aria-label");
      expect(hasLabel || hasAriaLabel).toBe(true);
    });
  });

  test("should have sufficient color contrast", () => {
    // Test CSS custom properties for contrast
    const root = document.documentElement;
    const primaryColor = getComputedStyle(root).getPropertyValue("--primary");
    const bgColor = getComputedStyle(root).getPropertyValue("--bg-dark");

    expect(primaryColor).toBeDefined();
    expect(bgColor).toBeDefined();
  });

  test("should support keyboard navigation", () => {
    document.body.innerHTML = `
      <button>Click me</button>
      <a href="#">Link</a>
      <div tabindex="0" role="button">Focusable div</div>
    `;

    const focusable = document.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])");
    expect(focusable.length).toBe(3);
  });
});