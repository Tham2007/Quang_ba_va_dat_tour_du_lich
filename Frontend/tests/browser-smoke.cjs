/* Browser smoke for An's static demo; intentionally no live auth/payment. */
const { chromium } = require("playwright-core");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

async function main() {
  const server = spawn("python", ["-m", "http.server", "8766", "--bind", "127.0.0.1", "--directory", "Frontend"], {
    stdio: "ignore"
  });
  let browser;
  const base = "http://127.0.0.1:8766";
  const pageErrors = [];
  const assetErrors = [];
  try {
    const chrome = process.env.CHROME_BIN || "/usr/bin/google-chrome";
    browser = await chromium.launch({
      executablePath: chrome,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.on("pageerror", err => pageErrors.push(String(err.message)));
    page.on("response", response => {
      if (response.url().startsWith(base) && response.status() >= 400) {
        assetErrors.push(response.status() + " " + response.url());
      }
    });
    let ready = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        const response = await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 2500 });
        if (response && response.status() === 200) { ready = true; break; }
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert(ready, "HTTP server never started");
    assert((await page.locator("body").innerText()).includes("Bản demo học phần"), "Client demo banner missing");
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => typeof window.renderTourCards), "function", "Tour UI controller unavailable");
    // Require a demo page to stay a demo even if the user chooses QR.
    assert.equal(await page.evaluate(() => document.body.innerHTML.includes('cardCvv')), false, "CVV input found");

    // KTHP regression: optional identity must reject text-only input.
    const documentCases = await page.evaluate(() => ({
      empty: isIdentityDocumentFormatValid(""),
      id: isIdentityDocumentFormatValid("000000000000"),
      passport: isIdentityDocumentFormatValid("B1234567"),
      text: isIdentityDocumentFormatValid("onlyletters"),
      short: isIdentityDocumentFormatValid("12345"),
      punct: isIdentityDocumentFormatValid("<script>")
    }));
    assert.deepEqual(documentCases, {
      empty: true, id: true, passport: true,
      text: false, short: false, punct: false
    });
    const booking = await page.evaluate(() => {
      const count = getLocalBookings().length;
      openBookingModal(TOURS_DATA[0].id);
      document.getElementById("customerName").value = "Khach Hang Test";
      document.getElementById("customerPhone").value = "0987654321";
      document.getElementById("customerEmail").value = "demo@example.test";
      document.getElementById("customerCCCD").value = "onlyletters";
      handleBookingSubmission({ preventDefault() {} });
      const invalidRejected = getLocalBookings().length === count;

      document.getElementById("customerCCCD").value = "B1234567";
      handleBookingSubmission({ preventDefault() {} });
      const orders = getLocalBookings();
      const created = orders.length === count + 1 ? orders[0] : null;
      const documentIsNotStored = created?.customer?.cccd === "Không thu thập (bản demo)";
      const inputIsCleared = document.getElementById("customerCCCD").value === "";
      const beforePay = JSON.stringify(orders);
      handleCustomerPayNow(created?.bookingId);
      const paymentCouldNotMutateOrder = JSON.stringify(getLocalBookings()) === beforePay;
      return { invalidRejected, created: Boolean(created), documentIsNotStored, inputIsCleared, paymentCouldNotMutateOrder };
    });
    assert.deepEqual(booking, {
      invalidRejected: true, created: true, documentIsNotStored: true,
      inputIsCleared: true, paymentCouldNotMutateOrder: true
    });
    console.log("PASS: identity format, booking rejects all letters, no ID persistence and no client-side PAID.");

    await page.goto(base + "/admin.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    assert((await page.locator("body").innerText()).includes("Cổng quản trị DEMO"), "Admin demo banner missing");
    assert.equal(await page.evaluate(() => typeof window.handleQuickAdminLogin), "function", "Admin UI not initialized");
    await page.evaluate(() => window.handleQuickAdminLogin("USR-01"));
    await page.waitForTimeout(500);
    const unlocked = await page.locator("#adminLayoutWrapper").evaluate(el => getComputedStyle(el).display !== "none");
    assert(unlocked, "Demo admin shortcut did not show the dashboard");

    assert.deepEqual(assetErrors, [], "Missing same-origin assets: " + assetErrors.join(" | "));
    assert.deepEqual(pageErrors, [], "Browser JavaScript exceptions: " + pageErrors.join(" | "));
    console.log("PASS: Chrome visited customer + admin, loaded assets without HTTP errors, demo admin login works, no JS exceptions.");
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error("FAIL: " + (err.stack || err));
  process.exitCode = 1;
});
