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
    const filterLayout = await page.evaluate(() => ({
      sidebar: !!document.querySelector(".tour-catalog-layout > aside .tour-filter-sidebar"),
      results: !!document.querySelector(".tour-catalog-layout #toursContainer"),
      filterCount: document.querySelectorAll("#advancedTourFilters input, #advancedTourFilters select").length
    }));
    assert.deepEqual(filterLayout, { sidebar: true, results: true, filterCount: 7 },
      "Tour filters and results must use the catalog sidebar layout");
    const stickyFilter = await page.evaluate(() => {
      const sidebar = document.querySelector(".tour-filter-sidebar");
      const bounds = sidebar.getBoundingClientRect();
      return {
        position: getComputedStyle(sidebar).position,
        height: bounds.height,
        viewportHeight: window.innerHeight
      };
    });
    assert.equal(stickyFilter.position, "sticky", "Tour filter sidebar must remain visible while scrolling");
    assert(stickyFilter.height >= stickyFilter.viewportHeight * 0.8,
      "Tour filter sidebar should fill most of the viewport");
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      const sidebar = document.querySelector(".tour-filter-sidebar");
      window.scrollTo(0, window.scrollY + sidebar.getBoundingClientRect().top + 500);
    });
    const stickyTop = await page.locator(".tour-filter-sidebar").evaluate(el =>
      Math.round(el.getBoundingClientRect().top)
    );
    assert(stickyTop <= 102, "Tour filter sidebar must stay pinned at the top while viewing results");
    const filterMatch = await page.evaluate(() => {
      const sample = [
        {
          id: "north",
          title: "Du thuyền Hạ Long",
          region: "north",
          regionName: "Miền Bắc",
          description: "Vịnh Lan Hạ",
          departure: "Hà Nội",
          price: 2000000,
          duration: "3N2Đ",
          transport: "Du thuyền",
          schedules: [{ departureAt: "2027-01-10T09:00:00Z", availableSeats: 5 }]
        },
        {
          id: "south",
          title: "Tour Phú Quốc",
          region: "south",
          regionName: "Miền Nam",
          description: "",
          departure: "TP. Hồ Chí Minh",
          price: 4000000,
          duration: "3N2Đ",
          transport: "Máy bay",
          schedules: [{ departureAt: "2027-01-10T09:00:00Z", availableSeats: 5 }]
        }
      ];
      const filters = {
        region: "north",
        destination: "Hạ Long",
        departure_location: "Hà Nội",
        departure_date: "2027-01-10",
        min_price: 2000000,
        max_price: 3000000,
        duration: "3N2Đ",
        transport: "du thuyền",
        availability: "available",
        sort_by: "relevance"
      };
      return filterLegacyApiTours(sample, filters).map(tour => tour.id);
    });
    assert.deepEqual(filterMatch, ["north"], "Tour search must match the selected catalog filters");
    // Require a demo page to stay a demo even if the user chooses QR.
    assert.equal(await page.evaluate(() => document.body.innerHTML.includes('cardCvv')), false, "CVV input found");

    // New An UI navigates to booking.html rather than keeping the old modal on index.
    // Verify the actual page and ensure sensitive identifiers cannot be persisted by
    // a client-only demo when there is no connected backend.
    const indexOffline = await page.evaluate(async () => {
      const count = getLocalBookings().length;
      const order = { bookingId: "DEMO-SMOKE", isPaid: false, statusCode: "PENDING_DEMO" };
      localStorage.setItem("delta_bookings_v2", JSON.stringify([order]));
      const beforePay = JSON.stringify(getLocalBookings());
      await handleCustomerPayNow(order.bookingId);
      const paymentCouldNotMutateOrder = JSON.stringify(getLocalBookings()) === beforePay;
      localStorage.removeItem("delta_bookings_v2");
      return { count, paymentCouldNotMutateOrder };
    });
    assert(indexOffline.paymentCouldNotMutateOrder, "Offline demo must never self-confirm paid status");

    await page.goto(base + "/booking.html?tourId=DL-HL01", {waitUntil:"domcontentloaded"});
    const docField = page.locator("#customerCCCD");
    await docField.waitFor({state:"attached"});
    const documentCases = await docField.evaluate(input => {
      const valid = value => { input.value = value; return input.checkValidity(); };
      return { empty:valid(""), id:valid("000000000000"), passport:valid("B1234567"),
        text:valid("onlyletters"), short:valid("12345"), punct:valid("<script>") };
    });
    assert.deepEqual(documentCases, {
      empty:false, id:true, passport:false, text:false, short:false, punct:false
    });
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key =>
      (localStorage.getItem(key) || "").includes("000000000000"))), false,
      "Document number must not persist to localStorage");
    console.log("PASS: actual booking page validates CCCD; demo has no offline payment confirmation or ID persistence.");

    await page.goto(base + "/admin.html", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const adminBanner = await page.locator(".delta-demo-notice").innerText();
    assert(adminBanner.includes("DEMO học phần") && adminBanner.includes("thao tác quản trị"),
      "Admin demo banner missing");
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
