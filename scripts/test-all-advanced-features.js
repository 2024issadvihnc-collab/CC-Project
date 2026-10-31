/**
 * Comprehensive End-to-End Verification Suite for All 4 Advanced Booking Features:
 * Feature 1: QR Ticket Scanning & Cryptographic Validation
 * Feature 2: Realistic Payment Simulator (Authorize, Decline, Timeout, Idempotency)
 * Feature 3: Email and In-App Notifications (Receipts, Confirmation, Cancellation, Mark-as-read)
 * Feature 4: Booking Cancellation, Policy Enforcement, Seat Release, and Refund Processing
 */

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5000";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    totalFailed++;
  }
}

async function runEndToEndSuite() {
  console.log("================================================================================");
  console.log("ShowTime: Running Full End-to-End Advanced Booking Features Verification Suite");
  console.log("================================================================================");

  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const testUserId = "usr_e2e_" + Date.now();
  const testEmail = "e2e_tester@showtime.local";
  const testSeats = [`V1_${suffix}`, `V2_${suffix}`];
  const bookingRef = "BK_E2E_" + suffix;

  // ---------------------------------------------------------------------------
  // 1. PAYMENT SIMULATOR (FEATURE 2) & SAGA BOOKING TRANSACTION
  // ---------------------------------------------------------------------------
  console.log("\n--- [Feature 2] Payment Simulator & Booking Confirmation ---");

  // A. Bank Decline Simulation (Verify Saga Compensation)
  const failRef = "BK_FAIL_" + Date.now().toString(36).toUpperCase();
  const failRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: failRef,
      eventId: "e001",
      seats: ["TEMP-X"],
      total: 1500,
      paymentMethod: "FAIL", // Triggers simulated bank decline
      simulateFailure: true,
      user: { id: testUserId, email: testEmail, phone: "+91 9888877777" },
    }),
  });
  assert(failRes.status === 402, "Saga halts on simulated bank decline with HTTP 402");

  // B. Successful Payment Simulator Authorization
  const bkgRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: bookingRef,
      eventId: "e001",
      seats: testSeats,
      total: 4500,
      paymentMethod: "UPI",
      user: {
        id: testUserId,
        name: "E2E Master Tester",
        email: testEmail,
        phone: "+91 9888877777",
      },
      event: {
        id: "e001",
        title: "A.R. Rahman – The Wonderment Tour",
        date: "2026-11-21",
        time: "7:00 PM",
        venue: "JLN Stadium",
        city: "Delhi",
      },
    }),
  });
  const bkgData = await bkgRes.json();
  assert(bkgRes.ok && bkgData.status === "CONFIRMED", `Booking confirmed via payment simulator: ${bookingRef}`);
  assert(bkgData.payment?.payment_status === "COMPLETED", "Payment status marked COMPLETED in payment service");

  // ---------------------------------------------------------------------------
  // 2. QR TICKET SCANNING AND VALIDATION (FEATURE 1)
  // ---------------------------------------------------------------------------
  console.log("\n--- [Feature 1] QR Ticket Scanning & Validation ---");

  const ticketRef = `TKT_${bookingRef}_V1_${suffix}`;

  // First Scan: Gate admission
  const scan1Res = await fetch(`${GATEWAY_URL}/api/tickets/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({
      identifier: ticketRef,
      gateLocation: "VIP_GATE_A",
      scannedBy: "staff_officer_01",
    }),
  });
  const scan1Data = await scan1Res.json();
  assert(scan1Res.ok && scan1Data.data?.admitted === true, "First ticket scan admitted at gate (status USED)");

  // Duplicate Scan: Instant rejection
  const scan2Res = await fetch(`${GATEWAY_URL}/api/tickets/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({
      identifier: ticketRef,
      gateLocation: "VIP_GATE_A",
      scannedBy: "staff_officer_02",
    }),
  });
  const scan2Data = await scan2Res.json();
  assert(scan2Res.status === 400 && scan2Data.code === "ALREADY_USED", "Duplicate gate scan rejected as ALREADY_USED");

  // ---------------------------------------------------------------------------
  // 3. EMAIL & IN-APP NOTIFICATIONS (FEATURE 3)
  // ---------------------------------------------------------------------------
  console.log("\n--- [Feature 3] Email & In-App Notification Delivery ---");

  // Query notifications for test user
  const notifRes = await fetch(`${GATEWAY_URL}/api/notifications`, {
    headers: { "x-user-id": testUserId },
  });
  const notifData = await notifRes.json();
  assert(notifRes.ok && Array.isArray(notifData.data), "Retrieved notifications via API Gateway");
  const hasConfirmNotif = notifData.data.some((n) => n.type === "BOOKING_CONFIRMED" || n.title.includes("Confirmed"));
  assert(hasConfirmNotif, "Booking confirmation in-app notification delivered to user");

  // Mark all notifications read
  const markRes = await fetch(`${GATEWAY_URL}/api/notifications/mark-all-read`, {
    method: "POST",
    headers: { "x-user-id": testUserId },
  });
  const markData = await markRes.json();
  assert(markRes.ok && markData.success === true, "Mark all notifications as read succeeded");

  // ---------------------------------------------------------------------------
  // 4. BOOKING CANCELLATION & REFUNDS (FEATURE 4)
  // ---------------------------------------------------------------------------
  console.log("\n--- [Feature 4] Booking Cancellation & Refunds ---");

  // Create a clean booking specifically to test cancellation
  const cancelTestRef = "BK_CAN_E2E_" + suffix;
  const cancelSeats = [`M1_${suffix}`, `M2_${suffix}`];

  await fetch(`${GATEWAY_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: cancelTestRef,
      eventId: "e001",
      seats: cancelSeats,
      total: 3500,
      paymentMethod: "UPI",
      user: { id: testUserId, email: testEmail, phone: "+91 9888877777" },
      event: {
        id: "e001",
        title: "A.R. Rahman – The Wonderment Tour",
        date: "2026-11-21",
        time: "7:00 PM",
      },
    }),
  });

  // Execute cancellation
  const cancelRes = await fetch(`${GATEWAY_URL}/api/bookings/${cancelTestRef}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": testUserId,
    },
    body: JSON.stringify({ reason: "Customer requested cancellation for test" }),
  });
  const cancelData = await cancelRes.json();
  assert(cancelRes.ok && cancelData.data?.status === "CANCELLED", "Booking successfully cancelled");
  assert(cancelData.data?.refundAmount === 3500, "100% full refund calculated and processed (₹3,500)");

  // Verify cancelled ticket is barred at gate
  const gateCheckRes = await fetch(`${GATEWAY_URL}/api/tickets/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-staff-pin": "1234" },
    body: JSON.stringify({ identifier: `TKT_${cancelTestRef}_M1_${suffix}` }),
  });
  const gateCheckData = await gateCheckRes.json();
  assert(gateCheckRes.status === 400 && gateCheckData.code === "CANCELLED", "Cancelled ticket is immediately barred at gate entry");

  // Verify cancelled seats can be rebooked
  const rebookRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: "BK_REBOOK_E2E_" + Date.now().toString(36).toUpperCase(),
      eventId: "e001",
      seats: cancelSeats,
      total: 3500,
      paymentMethod: "UPI",
      user: { id: "usr_rebook_e2e", phone: "+91 9888877777" },
      event: { id: "e001", title: "A.R. Rahman Live", date: "2026-11-21", time: "7:00 PM" },
    }),
  });
  const rebookData = await rebookRes.json();
  assert(rebookRes.ok && rebookData.status === "CONFIRMED", "Cancelled seats immediately available for another user to book");

  console.log("\n================================================================================");
  console.log(`FULL ADVANCED FEATURES SUITE RESULTS: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("================================================================================");

  if (totalFailed > 0) process.exit(1);
}

runEndToEndSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
