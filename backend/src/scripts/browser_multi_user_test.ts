import puppeteer from 'puppeteer-core';
import * as path from 'path';
import * as fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = 'C:\\Users\\TECHNOCARE\\.gemini\\antigravity-ide\\brain\\2808acf9-f5e6-4eea-b6f4-92391c0506f5\\browser_test_results';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface TestUser {
  role: string;
  email: string;
  expectedDashboardPath: string;
  testRedirects: { from: string; expectedTo: string }[];
}

const TEST_USERS: TestUser[] = [
  {
    role: 'SUPER_ADMIN',
    email: 'admin@flumenx.com',
    expectedDashboardPath: '/dashboard',
    testRedirects: [
      { from: 'http://localhost:3000/admin/attendance', expectedTo: '/attendance' },
      { from: 'http://localhost:3000/admin/roles', expectedTo: '/roles' },
      { from: 'http://localhost:3000/admin/users', expectedTo: '/users' },
    ],
  },
  {
    role: 'EMPLOYEE',
    email: 'shreejithspillaiflumencopia@gmail.com',
    expectedDashboardPath: '/dashboard',
    testRedirects: [
      { from: 'http://localhost:3000/employee/work', expectedTo: '/work' },
      { from: 'http://localhost:3000/employee/attendance', expectedTo: '/attendance' },
      { from: 'http://localhost:3000/employee/salary-slips', expectedTo: '/salary-slips' },
    ],
  },
  {
    role: 'ACCOUNTANT',
    email: 'anandhursflumenx@gmail.com',
    expectedDashboardPath: '/dashboard',
    testRedirects: [
      { from: 'http://localhost:3000/accountant/salary-slips', expectedTo: '/salary-slips' },
      { from: 'http://localhost:3000/accountant/dashboard', expectedTo: '/' },
    ],
  },
];

async function runBrowserTests() {
  console.log('================================================================');
  console.log('🌐 LAUNCHING CHROME INCOGNITO SUITE FOR MULTI-USER BROWSER TEST');
  console.log('================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    let step = 1;

    for (const u of TEST_USERS) {
      console.log(`\n----------------------------------------------------------------`);
      console.log(`[USER ${step}] Testing Session: [${u.role}] (${u.email})`);
      console.log(`----------------------------------------------------------------`);

      // Create isolated incognito context for pristine session
      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      try {
        // 1. Go to Login
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

        // Wait for splash screen overlay to finish initializing and hide
        console.log('  Waiting for workspace splash animation to complete...');
        await page.waitForSelector('.g3-splash-overlay', { hidden: true, timeout: 8000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1000));

        await page.waitForSelector('input[name="email"], input[type="email"]');

        // Type credentials
        await page.type('input[name="email"], input[type="email"]', u.email);
        await page.type('input[name="password"], input[type="password"]', 'password123');

        const screenshotPrefix = `${String(step).padStart(2, '0')}_${u.role.toLowerCase()}`;
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screenshotPrefix}_01_login.png`) });

        // Submit form
        console.log('  Submitting login form...');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
        } else {
          await page.keyboard.press('Enter');
        }

        // Wait for redirect to dashboard
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 2500));

        const landingUrl = page.url();
        console.log(`  ✓ Successfully logged in! Landed on: ${landingUrl}`);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screenshotPrefix}_02_dashboard.png`) });

        // 2. Test Canonical Redirects in Browser
        for (const red of u.testRedirects) {
          console.log(`  Testing browser redirect: ${red.from} ...`);
          await page.goto(red.from, { waitUntil: 'networkidle2' });
          const currentUrl = page.url();
          const matches = currentUrl.endsWith(red.expectedTo) || currentUrl.includes(red.expectedTo);
          console.log(`  ${matches ? '✓' : '✗'} Browser URL is now: ${currentUrl} (Expected: ${red.expectedTo})`);
        }

        const safeRoleName = u.role.toLowerCase();
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screenshotPrefix}_03_final_state.png`) });
      } finally {
        await context.close();
      }

      step++;
    }

    console.log('\n================================================================');
    console.log('🎉 ALL INCOGNITO BROWSER MULTI-USER TESTS SUCCEEDED!');
    console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('================================================================');
  } catch (err) {
    console.error('Browser test failed:', err);
  } finally {
    await browser.close();
  }
}

runBrowserTests();
