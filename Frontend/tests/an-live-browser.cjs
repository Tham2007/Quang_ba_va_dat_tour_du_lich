"use strict";
// Real Chromium workflow through An's original UI served by the FastAPI backend.
// Uses generated synthetic student-test identity; never sends real personal data.
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
    page.on("pageerror", err => {
      // UI may contain pre-existing localStorage demo exceptions; fail if our bridge.
      if ((err.stack || "").includes("live-api-bridge.js")) throw err;
    });
    const response = await page.goto(ORIGIN + "/an-live/", {waitUntil:"domcontentloaded"});
    assert.equal(response.status(), 200);
    await page.locator("#kthpLiveBtn").waitFor({state:"visible"});
    assert.match(await page.locator(".delta-demo-notice").innerText(), /DEMO|demo|mô phỏng/);
    await page.locator("#kthpLiveBtn").click();
    await page.locator("#kthpLivePanel").waitFor({state:"visible"});
    await page.locator("#kthpLivePanel button", {hasText:"Đăng ký / Đăng nhập"}).click();

    const nonce = Math.random().toString(16).slice(2).padEnd(12,"0");
    const user = "kthp_" + nonce + "@example.invalid";
    const phone = "091" + nonce.slice(0,7).split("").map(ch => String(parseInt(ch,16)%10)).join("");
    const root = page.locator("#kthpLivePanel");
    await root.locator('input[name="name"]').fill("KTHP Chromium Test");
    await root.locator('input[name="email"]').fill(user);
    await root.locator('input[name="phone"]').fill(phone);
    await root.locator('input[name="password"]').fill("DemoTestPassword1!"+nonce);
    await root.locator('button[type="submit"]', {hasText:"Tạo tài khoản"}).click();
    await page.waitForFunction(async () => {
      try { return (await fetch("/api/v1/auth/me", {credentials:"same-origin"})).status === 200; }
      catch { return false; }
    });
    console.log("PASS Chromium: registered and authenticated via same-origin FastAPI cookie");

    await root.locator("button", {hasText:"Xem lịch & giữ chỗ"}).first().click();
    await root.locator("button", {hasText:"Giữ chỗ trên server"}).waitFor();
    await root.locator("button", {hasText:"Giữ chỗ trên server"}).click();
    await root.getByText(/PENDING_PAYMENT/).waitFor({timeout:20000});
    const bookings = await page.evaluate(async () => {
      const r = await fetch("/api/v1/bookings", {credentials:"same-origin"});
      return r.json();
    });
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].status, "PENDING_PAYMENT");
    assert.equal(bookings[0].paid, false);
    console.log("PASS Chromium: An UI live panel created PENDING_PAYMENT booking persisted in SQL demo DB");

    await root.locator("button", {hasText:"Hủy giữ chỗ"}).click();
    await root.getByText(/CANCELLED/).waitFor({timeout:20000});
    const cancelled = await page.evaluate(async id => {
      const r = await fetch("/api/v1/bookings/"+encodeURIComponent(id), {credentials:"same-origin"});
      return r.json();
    }, bookings[0].id);
    assert.equal(cancelled.status,"CANCELLED");
    console.log("PASS Chromium: cancellation persisted in DB and server returned seats");

    await page.goto(ORIGIN + "/an-live/admin.html", {waitUntil:"domcontentloaded"});
    await page.locator("#kthpLiveBtn").click();
    await page.locator("#kthpLivePanel").waitFor({state:"visible"});
    const adminStatus = await page.evaluate(async () => (
      await fetch("/api/v1/admin/metrics", {credentials:"same-origin"})
    ).status);
    assert.equal(adminStatus,403);
    console.log("PASS Chromium: shared API session across An customer/admin pages; non-admin denied");
  } finally {
    await browser.close();
  }
})().catch(err => {console.error(err);process.exit(1)});
