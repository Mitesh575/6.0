import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const pagesToTest = [
  { name: 'Homepage (AIRO 6.0)', url: 'http://127.0.0.1:8080/index.html' },
  { name: 'Registration Page', url: 'http://127.0.0.1:8080/register.html' },
  { name: 'Delegate Portal Dashboard', url: 'http://127.0.0.1:8080/portal.html' },
  { name: 'Volunteer Scanner Desk', url: 'http://127.0.0.1:8080/scanner.html' },
  { name: 'Organizing Team', url: 'http://127.0.0.1:8080/team.html' },
  { name: 'Arena 01 — Tech Auction', url: 'http://127.0.0.1:8080/events/tech-auction.html' },
  { name: 'Arena 02 — Code Combat', url: 'http://127.0.0.1:8080/events/code-combat.html' },
  { name: 'Arena 03 — Agentic Paradox', url: 'http://127.0.0.1:8080/events/agentic-paradox.html' },
  { name: 'Arena 04 — Tech Crime Scene', url: 'http://127.0.0.1:8080/events/tech-crime-scene.html' },
  { name: 'Arena 05 — Workshop', url: 'http://127.0.0.1:8080/events/workshop.html' },
  { name: 'Arena 06 — Paper Presentation', url: 'http://127.0.0.1:8080/events/paper-presentation.html' }
];

async function runAudit() {
  console.log('🚀 Launching Playwright Chromium audit on AIRO 6.0...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const results = [];
  const screenshotsDir = './audit_screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  for (const item of pagesToTest) {
    const page = await context.newPage();
    const consoleLogs = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
    });

    try {
      const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1200);

      const status = response ? response.status() : 'N/A';
      const pageTitle = await page.title();
      
      const safeName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const buttonsCount = await page.$$eval('button, a.btn, a.btn-pill, .btn-primary, .btn-login, .portal-nav a', els => els.length);

      results.push({
        name: item.name,
        url: item.url,
        status,
        pageTitle,
        buttonsCount,
        consoleErrors: consoleLogs,
        pageErrors,
        failedRequests,
        screenshot: screenshotPath,
        success: (status === 200 || status === 304) && pageErrors.length === 0 && failedRequests.length === 0
      });

      console.log(`✅ [${status}] ${item.name}`);
      console.log(`   Title: "${pageTitle}"`);
      console.log(`   Interactive Elements: ${buttonsCount}`);
      console.log(`   Errors: ${pageErrors.length} | Failed Assets: ${failedRequests.length}\n`);
    } catch (err) {
      console.error(`❌ Failed testing ${item.name}:`, err.message);
      results.push({
        name: item.name,
        url: item.url,
        status: 'ERROR',
        error: err.message,
        success: false
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  
  fs.writeFileSync('./audit_report.json', JSON.stringify(results, null, 2));
  console.log('🎉 Audit Complete! All 10 pages tested.');
}

runAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
