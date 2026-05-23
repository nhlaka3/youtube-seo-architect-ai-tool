import fs from 'fs';
import path from 'path';

function checkAccessibility(htmlContent, filename) {
  console.log(`\nChecking ${filename}...`);

  // Check for basic accessibility issues
  const issues = [];

  // Missing alt text
  const imgRegex = /<img[^>]*>/gi;
  const images = htmlContent.match(imgRegex) || [];
  images.forEach(img => {
    if (!img.includes('alt=')) {
      issues.push('Missing alt attribute on img element');
    }
  });

  // Missing labels for inputs
  const inputRegex = /<input[^>]*>/gi;
  const inputs = htmlContent.match(inputRegex) || [];
  inputs.forEach((input, index) => {
    if (input.includes('type="file"') && input.includes('style="display: none;"')) {
      // Hidden file input triggered by button - skip
      return;
    }
    if (!input.includes('aria-label=') && !input.includes('aria-labelledby=')) {
      // Check if there's a corresponding label
      const idMatch = input.match(/id="([^"]*)"/);
      if (idMatch) {
        const labelRegex = new RegExp(`<label[^>]*for="${idMatch[1]}"[^>]*>`, 'i');
        if (!labelRegex.test(htmlContent)) {
          issues.push(`Input element id="${idMatch[1]}" missing label or aria-label`);
        }
      } else {
        issues.push(`Input element at position ${index} missing id, label, or aria-label`);
      }
    }
  });

  // Check for headings
  const headingRegex = /<h[1-6][^>]*>.*?<\/h[1-6]>/gi;
  const headings = htmlContent.match(headingRegex) || [];
  console.log(`  Found ${headings.length} headings`);

  // Check for landmarks
  const landmarkRoles = ['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search'];
  let landmarkCount = 0;
  landmarkRoles.forEach(role => {
    if (htmlContent.includes(`role="${role}"`)) {
      landmarkCount++;
    }
  });
  console.log(`  Found ${landmarkCount} ARIA landmarks`);

  // Check for skip links
  const hasSkipLinks = htmlContent.includes('skip-link');
  console.log(`  Skip links: ${hasSkipLinks ? 'Present' : 'Missing'}`);

  // Check for lang attribute
  const hasLang = htmlContent.includes('<html lang=');
  console.log(`  HTML lang attribute: ${hasLang ? 'Present' : 'Missing'}`);

  // Check for title
  const hasTitle = /<title[^>]*>.*?<\/title>/i.test(htmlContent);
  console.log(`  Page title: ${hasTitle ? 'Present' : 'Missing'}`);

  if (issues.length > 0) {
    console.log(`  Issues found: ${issues.length}`);
    issues.forEach(issue => console.log(`    - ${issue}`));
  } else {
    console.log('  No basic issues found');
  }

  return issues;
}

async function checkAllHTMLFiles() {
  const files = ['index.html', 'dashboard.html'];

  console.log('Starting accessibility audit...\n');

  let totalIssues = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const issues = checkAccessibility(content, file);
      totalIssues += issues.length;
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }

  console.log(`\nAudit complete. Total issues: ${totalIssues}`);
}

checkAllHTMLFiles();