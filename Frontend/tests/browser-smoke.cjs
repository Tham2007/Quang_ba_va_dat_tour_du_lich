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

    // KTHP regression: CCCD is required and must contain exactly 12 digits.
    const documentCases = await page.evaluate(async () => {
      await openBookingModal(TOURS_DATA[0].id);
      const input = document.getElementById("customerCCCD");
      const valid = value => {
        input.value = value;
        return input.checkValidity();
      };
      return {
        empty: valid(""),
        id: valid("000000000000"),
        passport: valid("B1234567"),
        text: valid("onlyletters"),
        short: valid("12345"),
        punct: valid("<script>")
      };
    });
    assert.deepEqual(documentCases, {
      empty: false, id: true, passport: false,
      text: false, short: false, punct: false
    });
    const booking = await page.evaluate(async () => {
      const count = getLocalBookings().length;
      await openBookingModal(TOURS_DATA[0].id);
      document.getElementById("customerName").value = "Khach Hang Test";
      document.getElementById("customerPhone").value = "0987654321";
      document.getElementById("customerEmail").value = "demo@example.test";
      document.getElementById("bookingDepartureDate").value = AppState.currentSchedules[0]?.id || "";
      setCurrentUser({
        id: "DEMO-SMOKE-USER",
        fullName: "Khach Hang Test",
        email: "demo@example.test",
        phone: "0987654321",
        role: "CUSTOMER"
      });
      document.getElementById("customerCCCD").value = "onlyletters";
      await handleBookingSubmission({ preventDefault() {} });
      const invalidRejected = getLocalBookings().length === count;

      document.getElementById("customerCCCD").value = "000000000000";
      await handleBookingSubmission({ preventDefault() {} });
      const bookingBlockedOffline = getLocalBookings().length === count;
      const identityIsNotStored = !Object.keys(localStorage).some(key =>
        (localStorage.getItem(key) || "").includes("000000000000")
      );
      setCurrentUser(null);
      const order = {
        bookingId: "DEMO-SMOKE",
        isPaid: false,
        statusCode: "PENDING_DEMO"
      };
      localStorage.setItem("delta_bookings_v2", JSON.stringify([order]));
      const beforePay = JSON.stringify(getLocalBookings());
      await handleCustomerPayNow(order.bookingId);
      const paymentCouldNotMutateOrder = JSON.stringify(getLocalBookings()) === beforePay;
      localStorage.removeItem("delta_bookings_v2");
      return { invalidRejected, bookingBlockedOffline, identityIsNotStored, paymentCouldNotMutateOrder };
    });
    assert.deepEqual(booking, {
      invalidRejected: true, bookingBlockedOffline: true, identityIsNotStored: true,
      paymentCouldNotMutateOrder: true
    });
    console.log("PASS: required CCCD validation, no offline booking/ID persistence and no client-side PAID.");

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
