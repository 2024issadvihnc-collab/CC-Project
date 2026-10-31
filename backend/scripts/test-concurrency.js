/**
 * =============================================================================
 * ShowTime Seat Booking Concurrency Test Runner
 * Simulates simultaneous booking attempts for the exact same seat.
 * Verifies that the atomic database transaction & unique index prevent duplicate booking.
 *
 * Usage:
 *   node scripts/test-concurrency.js [http://localhost:5000]
 * =============================================================================
 */

const BASE_URL = process.argv[2] || "http://localhost:5000";

async function runConcurrencyTest() {
  console.log("==========================================================");
  console.log("SHOWTIME CONCURRENCY & ATOMIC RESERVATION TEST");
  console.log(`Target Backend: ${BASE_URL}`);
  console.log("==========================================================");

  // 1. Fetch available event
  console.log("\n[1/3] Fetching test event...");
  const eventsRes = await fetch(`${BASE_URL}/api/events`);
  if (!eventsRes.ok) {
    throw new Error(`Failed to fetch events from ${BASE_URL}: ${eventsRes.status}`);
  }
  const events = await eventsRes.json();
  const testEvent = events[0];
  console.log(`Testing with Event: "${testEvent.title}" (ID: ${testEvent.id})`);

  // Target a unique seat ID for this test run
  const testSeat = "Z" + Math.floor(Math.random() * 900 + 100);
  const concurrentUsers = 5;

  console.log(`\n[2/3] Simulating ${concurrentUsers} simultaneous users booking SEAT [${testSeat}] at the exact same instant...`);

  const bookingPromises = Array.from({ length: concurrentUsers }, (_, idx) => {
    const payload = {
      eventId: testEvent.id,
      event: testEvent,
      seats: [testSeat],
      tickets: [{ seatId: testSeat, tierLabel: "VIP Lounge", price: 2500 }],
      total: 2500,
      paymentMethod: "upi",
      user: {
        id: `concurrent_user_${idx + 1}`,
        name: `Concurrent Tester #${idx + 1}`,
        phone: `+91 999000111${idx}`,
        email: `tester${idx + 1}@showtime.test`,
      },
    };

    return fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      return {
        userId: `User #${idx + 1}`,
        status: res.status,
        ok: res.ok,
        bookingId: body.bookingId,
        error: body.error,
      };
    });
  });

  const results = await Promise.all(bookingPromises);

  console.log("\n[3/3] Concurrent Execution Results:");
  console.table(results);

  const successes = results.filter((r) => r.ok && r.status === 201);
  const conflicts = results.filter((r) => r.status === 409 || !r.ok);

  console.log("\n==========================================================");
  console.log("CONCURRENCY VERIFICATION SUMMARY:");
  console.log("==========================================================");
  console.log(`Total Requests:   ${concurrentUsers}`);
  console.log(`Successful:       ${successes.length} (Booking ID: ${successes[0]?.bookingId || "None"})`);
  console.log(`Rejected (409):   ${conflicts.length}`);

  if (successes.length === 1 && conflicts.length === concurrentUsers - 1) {
    console.log("SUCCESS: Exactly ONE user acquired the seat! Concurrency test passed without duplicate bookings.");
  } else if (successes.length > 1) {
    console.error("CRITICAL FAILURE: Duplicate seats booked! Concurrency isolation failed.");
    process.exit(1);
  } else {
    console.warn("Test inconclusive or all failed.");
  }
  console.log("==========================================================\n");
}

runConcurrencyTest().catch((err) => {
  console.error("Test execution failed:", err.message);
  process.exit(1);
});

