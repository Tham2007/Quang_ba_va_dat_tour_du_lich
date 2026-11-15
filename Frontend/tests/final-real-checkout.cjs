"use strict";
// Exercise An's exact booking.html, not a separate test-only live API panel.
// Isolated CI SQLite database only, never real money, admin credentials or customer PII.
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const ORIGIN = "http://127.0.0.1:8999";

(async () => {
  const browser = await chromium.launch({
    executablePath:process.env.CHROME_PATH || "/usr/bin/google-chrome",headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage({viewport:{width:1366,height:900}});
    const errors=[];
    page.on("pageerror",err=>errors.push(String(err)));
    const response=await page.goto(ORIGIN+"/booking.html?tourId=DL-HL01",{waitUntil:"domcontentloaded"});
    assert.equal(response.status(),200);
    await page.locator("#customerFullName").waitFor({state:"visible"});
    await page.waitForFunction(()=>{
      const select=document.getElementById("bookingScheduleSelect");
      return select && !select.disabled && !!select.value && !select.value.startsWith("SCHED-");
    },null,{timeout:25000});

    const email="ci-booking-"+Math.random().toString(16).slice(2,15)+"@example.test";
    const register=await page.evaluate(async email=>{
      const result=await fetch("/api/v1/auth/register",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({full_name:"CI Booking Test",email,phone:"0912345678",
          password:"CiOnly-SecurePassword-2026!"})
      });
      return {status:result.status,body:await result.json()};
    },email);
    assert.equal(register.status,201,JSON.stringify(register.body));

    const quote=await page.evaluate(async()=>{
      const schedule_id=document.getElementById("bookingScheduleSelect").value;
      const r=await fetch("/api/v1/bookings/quote",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({schedule_id,adults:1,children:0,infants:0})
      });
      return {status:r.status,body:await r.json()};
    });
    assert.equal(quote.status,200);
    await page.locator("#customerFullName").fill("CI Booking Test");
    await page.locator("#customerPhone").fill("0912345678");
    await page.locator("#customerEmail").fill(email);
    await page.evaluate(async()=>{await submitBookingOrder();});
    await page.locator("#bookingSuccessReceipt").waitFor({state:"visible",timeout:20000});

    const rows=await page.evaluate(async()=>{
      const r=await fetch("/api/v1/bookings",{credentials:"same-origin"});
      return {status:r.status,body:await r.json()};
    });
    assert.equal(rows.status,200);
    assert.equal(rows.body.length,1,"Frontend must persist exactly one server booking");
    const saved=rows.body[0];
    assert.equal(saved.status,"PENDING_PAYMENT");
    assert.equal(saved.totalPrice,quote.body.totalPrice,"Authoritative price and booking disagree");
    const local=await page.evaluate(()=>JSON.parse(localStorage.getItem("delta_customer_bookings")||"[]"));
    assert(local.every(x=>x.id===saved.id),"No fake locally generated booking allowed");
    console.log("PASS: actual booking.html persisted booking with server-controlled price");

    const claim=await page.evaluate(async id=>{
      const csrf=document.cookie.split("; ").find(x=>x.startsWith("delta_csrf="));
      const r=await fetch("/api/v1/bookings/"+encodeURIComponent(id)+"/pay",{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json","X-CSRF-Token":decodeURIComponent(csrf?.split("=")[1]||"")},
        body:JSON.stringify({reference:"UNVERIFIED-CI-CLAIM-2026"})
      });
      return {status:r.status,body:await r.json()};
    },saved.id);
    assert.equal(claim.status,200);
    assert.equal(claim.body.paid,false);
    assert.equal(claim.body.status,"PENDING_PAYMENT");
    assert.equal(claim.body.paymentReview,"PENDING_MANUAL_VERIFICATION");
    console.log("PASS: self-submitted payment reference cannot mark PAID");

    const cancel=await page.evaluate(async id=>{
      const csrf=document.cookie.split("; ").find(x=>x.startsWith("delta_csrf="));
      const r=await fetch("/api/v1/bookings/"+encodeURIComponent(id)+"/cancel",{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json","X-CSRF-Token":decodeURIComponent(csrf?.split("=")[1]||"")},
        body:"{}"
      });
      return {status:r.status,body:await r.json()};
    },saved.id);
    assert.equal(cancel.status,200);
    assert.equal(cancel.body.status,"CANCELLED");
    assert.deepEqual(errors,[],"Browser JS error");
    console.log("PASS: server booking cancelled and original UI has no JS exceptions");
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
