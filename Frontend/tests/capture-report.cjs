"use strict";
/** Authentic UI screenshots for the professor's Nov 16 project report.
 *  All pages are rendered by the real FastAPI + An UI in disposable CI,
 *  and generated credentials/accounts are synthetic. Never scan/pay any QR.
 */
const { chromium } = require("playwright-core");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const BASE = "http://127.0.0.1:8999";
const OUT = path.join(process.cwd(), "delta-report-screenshots");

(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || "/usr/bin/google-chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    page.setDefaultTimeout(25000);
    const capture = async (name) => {
      await page.screenshot({path:path.join(OUT,name),fullPage:true,animations:"disabled"});
      console.log("CAPTURED",name);
    };
    await page.goto(BASE+"/", {waitUntil:"domcontentloaded"});
    await page.locator(".delta-demo-notice").waitFor();
    await capture("01_trang_chu.png");
    await page.goto(BASE+"/booking.html?tourId=DL-HL01",{waitUntil:"domcontentloaded"});
    await page.locator("#customerFullName").waitFor();
    await page.waitForFunction(() => {
      const select=document.querySelector("#bookingScheduleSelect");
      return select && !select.disabled && !!select.value;
    });
    await capture("02_dat_tour_form.png");

    const email="report-"+Math.random().toString(16).slice(2,15)+"@example.test";
    const reg=await page.evaluate(async email => {
      const response=await fetch("/api/v1/auth/register",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({full_name:"Khach Kiem Thu Bao Cao",email,phone:"0931122334",password:"CiReportOnly-Secure-12345"})});
      return response.status;
    },email);
    assert.equal(reg,201,"Cannot create synthetic report booking account");
    await page.locator("#customerFullName").fill("Khach Kiem Thu Bao Cao");
    await page.locator("#customerPhone").fill("0931122334");
    await page.locator("#customerEmail").fill(email);
    await page.evaluate(async()=>{await submitBookingOrder();});
    await page.locator("#bookingSuccessReceipt").waitFor({state:"visible"});
    await capture("03_phieu_giu_cho_demo.png");

    const my=await page.evaluate(async()=>{
      const r=await fetch("/api/v1/bookings",{credentials:"same-origin"});
      return r.json();
    });
    assert.equal(my.length,1);
    const id=my[0].id;
    const csrf=await page.evaluate(()=>document.cookie.split("; ").find(v=>v.startsWith("delta_csrf="))?.split("=")[1]);
    const cancelled=await page.evaluate(async ({id,csrf})=>{
      const r=await fetch("/api/v1/bookings/"+encodeURIComponent(id)+"/cancel",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRF-Token":decodeURIComponent(csrf)},body:"{}"});
      return r.status;
    },{id,csrf});
    assert.equal(cancelled,200);

    await page.goto(BASE+"/my-bookings.html",{waitUntil:"domcontentloaded"});
    await capture("04_don_cua_toi.png");
    await page.goto(BASE+"/admin.html",{waitUntil:"domcontentloaded"});
    await page.locator(".delta-demo-notice").waitFor();
    await capture("05_quan_tri_login.png");
    console.log("PASS: 5 authentic screenshots of the original Delta Travel frontend generated from disposable CI.");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
