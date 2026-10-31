/**
 * Test Suite: Booking Cancellation and Refund Management (Phase 5)
 * Verifies cancellation policy tiers, refund calculations, ticket invalidation,
 * seat release, gate scan rejection, and duplicate cancellation protection.
 */

import { calculateRefund } from "../services/booking-service/src/services/cancellation.service.js";

const GATEWAY_URL = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("====================================================");
  console.log("ShowTime: Running Phase 5 Cancellation & Refund Test Suite");
  console.log("====================================================");

  // Test 1: Cancellation Policy Tier Calculations
  console.log("\n[Test 1] Policy Tier Calculations:");
  const future72h = new Date(Date.now() + 72 * 3600 * 1000).toISOString().split("T")[0];
  const tier100 = calculateRefund({ totalAmount: 2000, eventDate: future72h, eventTime: "19:00" });
  assert(tier100.eligible === true && tier100.refundPercentage === 100 && tier100.refundAmount === 2000, "> 48h qualifies for 100% refund");

  const future36h = new Date(Date.now() + 36 * 3600 * 1000).toISOString().split("T")[0];
  const tier75 = calculateRefund({ totalAmount: 2000, eventDate: future36h, eventTime: "19:00" });
  assert(tier75.eligible === true && tier75.refundPercentage === 75 && tier75.refundAmount === 1500, "24-48h qualifies for 75% refund");

  const future12h = new Date(Date.now() + 12 * 3600 * 1000).toISOString().split("T")[0];
  const tier50 = calculateRefund({ totalAmount: 2000, eventDate: future12h, eventTime: "19:00" });
  assert(tier50.eligible === true && tier50.refundPercentage === 50 && tier50.refundAmount === 1000, "4-24h qualifies for 50% refund");

  const pastDate = "2020-01-01";
  const pastTier = calculateRefund({ totalAmount: 2000, eventDate: pastDate, eventTime: "19:00" });
  assert(pastTier.eligible === false, "Past event is ineligible for cancellation");

  // Test 2: Create a booking to test cancellation flow
  console.log("\n[Test 2] Create Confirmed Booking for Cancellation Flow:");
  const testBookingId = "BK_CAN_TEST_" + Date.now().toString(36).toUpperCase();
  const testSeats = ["K1", "K2"];

  const bkgRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: testBookingId,
      eventId: "e001",
      seats: testSeats,
      total: 3000,
      paymentMethod: "UPI",
      user: {
        id: "usr_cancel_tester",
        name: "Cancellation Tester",
        email: "canceltester@showtime.local",
        phone: "+91 9998887777",
      },
      event: {
        id: "e001",
        title: "A.R. Rahman – The Wonderment Tour",
        date: future72h,
        time: "7:00 PM",
        venue: "Jawaharlal Nehru Stadium",
        city: "Delhi",
      },
    }),
  });

  const bkgData = await bkgRes.json();
  assert(bkgRes.ok && bkgData.status === "CONFIRMED", `Booking created and confirmed: ${testBookingId}`);

  // Test 3: Preview Cancellation
  console.log("\n[Test 3] Preview Cancellation Policy & Breakdown:");
  const previewRes = await fetch(`${GATEWAY_URL}/api/bookings/${testBookingId}/cancellation`);
  const previewJson = await previewRes.json();
  assert(previewRes.ok && previewJson.success === true, "Cancellation preview returned 200 OK");
  assert(previewJson.data.eligible === true, "Preview shows eligible for refund");
  assert(previewJson.data.refundAmount === 3000, "Preview calculates ₹3,000 full refund (>48h)");

  // Test 4: Execute Cancellation
  console.log("\n[Test 4] Execute Cancellation & Process Refund:");
  const cancelRes = await fetch(`${GATEWAY_URL}/api/bookings/${testBookingId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "usr_cancel_tester",
    },
    body: JSON.stringify({ reason: "Testing full cancellation and refund" }),
  });

  const cancelJson = await cancelRes.json();
  assert(cancelRes.ok && cancelJson.success === true, "Cancellation returned 200 OK");
  assert(cancelJson.data.status === "CANCELLED", "Booking status updated to CANCELLED");
  assert(cancelJson.data.refundAmount === 3000, "Refund amount matches expected ₹3,000");
  assert(cancelJson.data.refundReference.startsWith("REF_"), "Valid refund reference generated");

  // Test 5: Verify Ticket Invalidation & Gate Denial
  console.log("\n[Test 5] Verify Cancelled Tickets are Denied at Gate:");
  const gateRes = await fetch(`${GATEWAY_URL}/api/tickets/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({ identifier: `TKT_${testBookingId}_K1` }),
  });

  const gateJson = await gateRes.json();
  assert(gateRes.status === 400 && gateJson.code === "CANCELLED", "Cancelled ticket is immediately barred at gate security");

  // Test 6: Verify Released Seats Can Be Booked Again
  console.log("\n[Test 6] Verify Cancelled Seats are Released:");
  const rebookId = "BK_REBOOK_" + Date.now().toString(36).toUpperCase();
  const rebookRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId: rebookId,
      eventId: "e001",
      seats: testSeats, // Using the same seats K1, K2 that were previously cancelled
      total: 3000,
      paymentMethod: "UPI",
      user: {
        id: "usr_rebooker",
        name: "New Customer",
        phone: "+91 9991112222",
      },
      event: {
        id: "e001",
        title: "A.R. Rahman – The Wonderment Tour",
        date: future72h,
        time: "7:00 PM",
      },
    }),
  });

  const rebookJson = await rebookRes.json();
  assert(rebookRes.ok && rebookJson.status === "CONFIRMED", "Released seats can be immediately rebooked by another customer");

  // Test 7: Duplicate Cancellation Protection (Idempotent)
  console.log("\n[Test 7] Duplicate Cancellation Protection:");
  const dupCancelRes = await fetch(`${GATEWAY_URL}/api/bookings/${testBookingId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "usr_cancel_tester",
    },
    body: JSON.stringify({ reason: "Duplicate cancel attempt" }),
  });
  const dupCancelJson = await dupCancelRes.json();
  assert(dupCancelRes.ok && (dupCancelJson.data?.alreadyCancelled || dupCancelJson.data?.status === "CANCELLED"), "Duplicate cancellation handled gracefully without double-refund");

  console.log("\n====================================================");
  console.log(`Cancellation Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("====================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});

