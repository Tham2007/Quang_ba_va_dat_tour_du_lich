"use strict";
// End-to-end test of An's *actual* booking.html form and FastAPI session.
// Uses a disposable staging-only SQLite database from ci-an-live-browser.yml.
// No real payment instructions, personal bank transactions or customer data.
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");

const ORIGIN = "http://127.0.0.1:8999";

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    const resp = await page.goto(ORIGIN + "/booking.html?tourId=DL-HL01", {
      waitUntil: "domcontentloaded"
    });
    assert.equal(resp.status(), 200);
    await page.locator("#customerFullName").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const schedule = document.querySelector("#bookingScheduleSelect");
      return schedule && !schedule.disabled && schedule.value && !schedule.value.startsWith("SCHED-");
    }, { timeout: 25000 });

    // Translating to English must not resurrect unimplemented payment claims.
    const localized = await page.evaluate(() => {
      setAppLanguage("en");
      const en = {
        qr: document.querySelector('[data-i18n="pay_qr_title"]').textContent,
        desc: document.querySelector('[data-i18n="pay_qr_desc"]').textContent,
        insurance: document.querySelector('[data-i18n="inv_insurance"]').textContent,
        total: document.querySelector('[data-i18n="inv_total_label"]').textContent
      };
      setAppLanguage("vi");
      const vi = {
        qr: document.querySelector('[data-i18n="pay_qr_title"]').textContent,
        desc: document.querySelector('[data-i18n="pay_qr_desc"]').textContent,
        insurance: document.querySelector('[data-i18n="inv_insurance"]').textContent
      };
      return {en,vi};
    });
    assert.match(localized.en.qr, /demo/i);
    assert.match(localized.en.desc, /Do not scan/i);
    assert.match(localized.en.insurance, /not integrated/i);
    assert.match(localized.en.total, /UNPAID/i);
    assert.match(localized.vi.qr, /DEMO/i);
    assert.match(localized.vi.desc, /Không quét/i);
    assert.match(localized.vi.insurance, /chưa tích hợp/i);
    await page.waitForFunction(() => {
      const select = document.querySelector("#bookingScheduleSelect");
      return select && !select.disabled && !!select.value;
    });
    console.log("PASS: VI and EN checkout labels both disclose no payment or insurance gateway");

    // Financial contract: An's displayed gross price must match the server.
    // VAT is included in published prices, not added again on top.
    const quoteAndDisplay = async () => page.evaluate(async () => {
      const schedule_id = document.querySelector("#bookingScheduleSelect").value;
      const adults = Number(document.querySelector("#numAdults").value);
      const children = Number(document.querySelector("#numChildren").value);
      const infants = Number(document.querySelector("#numInfants").value);
      const response = await fetch("/api/v1/bookings/quote", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({schedule_id,adults,children,infants})
      });
      return {
        status: response.status, quote: await response.json(),
        shownGross: Number(document.querySelector("#totalPriceDisplay").textContent.replace(/[^0-9]/g, "")),
        shownNet: Number(document.querySelector("#subtotalDisplay").textContent.replace(/[^0-9]/g, "")),
        shownVat: Number(document.querySelector("#vatAmountDisplay").textContent.replace(/[^0-9]/g, "")),
        voucherDisabled: document.querySelector("#voucherCodeInput").disabled
      };
    });
    let initial = await quoteAndDisplay();
    assert.equal(initial.status, 200, JSON.stringify(initial.quote));
    assert.equal(initial.shownGross, initial.quote.totalPrice, "Double VAT charged on checkout");
    assert.equal(initial.shownNet + initial.shownVat, initial.shownGross,
      "Displayed VAT breakdown does not reconcile to authoritative price");
    assert.equal(initial.voucherDisabled, true, "Unsupported coupon must be disabled");

    // Regression for Thắm's screenshot: a stale price from the tour endpoint
    // must be corrected from the authoritative /bookings/quote when the page
    // first loads, instead of blocking the first checkout click with a warning.
    const stalePage = await browser.newPage({ viewport: {width: 1280, height: 900} });
    let mockedTour = false;
    await stalePage.route("**/api/v1/tours/DL-HL01", async route => {
      const response = await route.fetch();
      const data = await response.json();
      assert.equal(response.status(), 200);
      assert.equal(Number(data.price), Number(initial.quote.unitPrice));
      data.price = Number(data.price) + 500000;
      mockedTour = true;
      await route.fulfill({response, json:data});
    });
    await stalePage.goto(ORIGIN + "/booking.html?tourId=DL-HL01", {
      waitUntil: "domcontentloaded"
    });
    await stalePage.waitForFunction(expected => {
      const val = document.querySelector("#unitPriceDisplay")?.textContent || "";
      const displayed = Number(val.replace(/[^0-9]/g, ""));
      return displayed === expected &&
        document.querySelector("#totalPriceDisplay")?.dataset.serverQuoteMatch === "true";
    }, Number(initial.quote.unitPrice), {timeout:20000});
    assert(mockedTour, "Failed to simulate stale tour-catalog price");
    await stalePage.close();
    console.log("PASS: stale catalog price automatically syncs with server quote before checkout");


    // Child discount is a frequent source of client/server rounding drift.
    await page.locator("#numChildren").fill("1");
    await page.evaluate(() => recalcPrice());
    const withChild = await quoteAndDisplay();
    assert.equal(withChild.status, 200);
    assert.equal(withChild.shownGross, withChild.quote.totalPrice, "Child fare mismatch");
    assert.equal(withChild.shownNet + withChild.shownVat, withChild.shownGross);
    await page.locator("#numChildren").fill("0");
    await page.evaluate(() => recalcPrice());
    console.log("PASS: client and server quote match for adult and child, VAT included exactly once");

    const email = "actual-checkout-" + Math.random().toString(16).slice(2, 15) + "@example.test";
    const registration = await page.evaluate(async (email) => {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: "Khach Kiem Thu", email, phone: "0912345678",
          password: "PrivateCiOnlyPassword-1234!"
        })
      });
      return { status: response.status, body: await response.json() };
    }, email);
    assert.equal(registration.status, 201, JSON.stringify(registration.body).slice(0, 250));

    await page.locator("#customerFullName").fill("Khach Kiem Thu");
    await page.locator("#customerPhone").fill("0912345678");
    await page.locator("#customerEmail").fill(email);
    await page.evaluate(async () => { await submitBookingOrder(); });
    await page.locator("#bookingSuccessReceipt").waitFor({ state: "visible", timeout: 20000 });

    const persisted = await page.evaluate(async () => {
      const response = await fetch("/api/v1/bookings", { credentials: "same-origin" });
      return { status: response.status, data: await response.json() };
    });
    assert.equal(persisted.status, 200);
    assert.equal(persisted.data.length, 1, "An's real checkout must create exactly one server booking");
    const booking = persisted.data[0];
    assert.equal(booking.status, "PENDING_PAYMENT");
    assert.equal(booking.paid, false);
    assert(booking.id && booking.reference);
    const receiptDisplayed = await page.locator("#receiptTotal").innerText();
    const receiptGross = Number(receiptDisplayed.replace(/[^0-9]/g, ""));
    assert.equal(receiptGross, booking.totalPrice, "Receipt total does not match server booking");
    assert.equal(receiptGross, initial.quote.totalPrice, "Form, quote and receipt totals disagree");
    assert((await page.locator("#receiptStatusBadge").innerText()).includes("PENDING"));
    const printed = await page.evaluate(() => {
      const prepared = prepareOfficialInvoiceDOM();
      const container = document.querySelector("#officialInvoicePrintContainer");
      return {
        amount: prepared?.grandTotal,
        subtotal: prepared?.subtotal,
        vat: prepared?.vatAmount,
        shownAmount: Number(document.querySelector("#invGrandTotal").textContent.replace(/[^0-9]/g, "")),
        title: container?.innerText || "",
        ref: document.querySelector("#invNumberDisplay").textContent,
        status: document.querySelector("#invPaymentStatusBadge").textContent
      };
    });
    assert.equal(printed.amount, booking.totalPrice, "Printable receipt must follow server booking");
    assert.equal(printed.subtotal + printed.vat, booking.totalPrice, "Printed VAT must reconcile exactly");
    assert.equal(printed.shownAmount, booking.totalPrice, "Visible printable total mismatch");
    assert(printed.title.includes("PHIẾU GIỮ CHỖ THỬ NGHIỆM"));
    assert(printed.title.includes("KHÔNG PHẢI HÓA ĐƠN THUẾ"));
    assert(!printed.title.includes("HÓA ĐƠN GTGT GỐC"));
    assert(!printed.title.includes("Mã tra cứu CQT:"));
    assert(!printed.title.includes("Chuyển khoản VietQR MBBank"));
    assert(printed.ref.startsWith("MÃ GIỮ CHỖ:"));
    assert.equal(printed.status, "CHƯA THANH TOÁN");
    console.log("PASS: print-ready demo receipt does not impersonate a tax invoice or bank payment");
    console.log("PASS: booking form, live price quote and saved booking receipt have identical VND total");
    console.log("PASS: original booking.html created one real server-side PENDING_PAYMENT booking");

    // Customer's own claim cannot mark a booking paid.
    const proof = await page.evaluate(async bookingId => {
      const csrf = document.cookie.split("; ").find(c => c.startsWith("delta_csrf="));
      const token = csrf ? decodeURIComponent(csrf.slice("delta_csrf=".length)) : "";
      const response = await fetch("/api/v1/bookings/" + encodeURIComponent(bookingId) + "/pay", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({reference:"UNVERIFIED-CI-CLAIM-123456"})
      });
      return {status: response.status, data: await response.json()};
    }, booking.id);
    assert.equal(proof.status, 200);
    assert.equal(proof.data.paid, false);
    assert.equal(proof.data.status, "PENDING_PAYMENT");
    console.log("PASS: customer-supplied reference cannot self-confirm bank payment");

    const cancel = await page.evaluate(async bookingId => {
      const csrf = document.cookie.split("; ").find(c => c.startsWith("delta_csrf="));
      const token = csrf ? decodeURIComponent(csrf.slice("delta_csrf=".length)) : "";
      const response = await fetch("/api/v1/bookings/" + encodeURIComponent(bookingId) + "/cancel", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: "{}"
      });
      return {status: response.status, data: await response.json()};
    }, booking.id);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.data.status, "CANCELLED");
    assert.deepEqual(errors, [], "Browser JS exceptions");
    console.log("PASS: authenticated cancellation of actual stored booking via FastAPI and original UI");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
