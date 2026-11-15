"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const read = path => fs.readFileSync(path,"utf8");
const auth = read("Frontend/assets/js/controllers/auth.js");
const admin = read("Frontend/assets/js/controllers/admin.js");
const booking = read("Frontend/booking.html");
const adapter = read("Frontend/assets/js/services/api.js");
const payment = read("API/api/services/booking_service.py");
const schema = read("API/api/schemas/booking_schema.py");
const sqlTest = read("scripts/test_tham_delivery.js");
const qr = read("Frontend/assets/js/services/vietqr-service.js");

assert(!auth.includes("user.password !== password"),"Offline authentication by local password");
assert(!auth.includes("users[userIndex].password ="),"Anonymous password reset in browser");
assert(!/password:\s*password\b/.test(auth),"Plaintext password in stored profile");
assert(auth.includes("password: _oldPassword"),"Old password localStorage migration missing");
const team = admin.slice(admin.indexOf("const TEAM_ADMIN_ACCOUNTS = ["),
  admin.indexOf("];",admin.indexOf("const TEAM_ADMIN_ACCOUNTS = ["))+2);
assert(!/password\s*:/.test(team),"Public admin credentials bundled with JS");
assert(!admin.includes('targetUser.password ||'),"Quick-login password fallback remains");
assert(!booking.includes("// Tự động fallback khi backend offline"),"Fake offline booking remains");
assert(!booking.includes('https://img.vietqr.io/image/'),"Public scannable bank QR remains");
assert(!/accountNo:\s*["'][0-9]{9,14}/.test(qr),"Personal bank account exposed in QR client");
assert(adapter.includes("const payload = {") &&
  adapter.includes("customer_name:"),"Booking schema whitelist missing");
assert(!adapter.includes("auto_confirm: autoConfirm"),"Customer self confirmation request");
const paymentAction = payment.slice(payment.indexOf("def confirm_customer_payment"),
  payment.indexOf("def booking_dict"));
assert(!paymentAction.includes('booking.status = "PAID"'),"Unverified customer payment can mark PAID");
assert(paymentAction.includes("PENDING_MANUAL_VERIFICATION"),"Bank review status missing");
assert(schema.includes("customer_identity: str | None"),"Current form's identity field still mandatory");
assert(!/password:\s*["'][^"']+["']/.test(sqlTest),"Plaintext SmarterASP credential committed");
assert(sqlTest.includes("encrypt: true"),"SQL Server TLS disabled");
assert(!qr.includes("img.vietqr.io") && !qr.includes("api.vietqr.io"),
  "Unverified payable VietQR generator has been restored");
assert(qr.includes('return "assets/images/bank_qr_demo.svg"'),
  "VietQR helper must remain demo-only");
assert(booking.includes('const qrUrl = "assets/images/bank_qr_demo.svg";'),
  "Checkout must not create scannable bank payment QR before webhook verification");
assert(!booking.includes("Tài khoản nhận thanh toán chính thức"),
  "Official bank payment messaging requires settlement approval");
assert(!booking.includes("SePay sẽ tự động đối soát"),
  "Do not claim unverified SePay auto-settlement in checkout");
assert(booking.includes("const finalTotal = rawBookingSubtotal;"),
  "Server quoted price is VAT-inclusive; never charge another 10%");
assert(booking.includes("const calculatedTotal = rawSubtotal;"),
  "Second step must not add VAT again to the server quoted price");
console.log("PASS: release-critical security, payment disclaimer and VAT-inclusive contract assertions");
