import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const GATEWAY_URL = "http://localhost:5000";

async function waitForGateway(maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status === 207) return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function runSagaPaymentFailureTest() {
  console.log("======================================================================");
  console.log("ShowTime Saga Compensation & Payment Failure Test");
  console.log("======================================================================\n");

  const services = [
    { name: "Auth Service", dir: "services/auth-service", port: 5001 },
    { name: "Event Service", dir: "services/event-service", port: 5002 },
    { name: "Booking Service", dir: "services/booking-service", port: 5003 },
    { name: "Payment Service", dir: "services/payment-service", port: 5004 },
    { name: "Ticket Service", dir: "services/ticket-service", port: 5005 },
    { name: "API Gateway", dir: "api-gateway", port: 5000 },
  ];

  const spawned = [];
  const alreadyRunning = await waitForGateway(2);
  if (!alreadyRunning) {
    console.log("Starting microservices suite in background for Saga test...");
    for (const svc of services) {
      const p = spawn("node", ["server.js"], {
        cwd: path.join(ROOT, svc.dir),
        stdio: "ignore",
        shell: true,
        env: { ...process.env, PORT: svc.port },
      });
      spawned.push(p);
    }
    const ready = await waitForGateway(20);
    if (!ready) {
      console.error("FATAL: Failed to connect to API Gateway after timeout.");
      for (const p of spawned) p.kill("SIGTERM");
      process.exit(1);
    }
  }

  try {
    const eventsRes = await fetch(`${GATEWAY_URL}/api/events`);
    const events = await eventsRes.json();
    const testEvent = events[0];

    const testSeat = "SAGA_TEST_SEAT_" + Date.now().toString(36);
    const bookingRef = "BK_FAIL_" + Date.now().toString(36).toUpperCase();

    console.log(`[TEST STEP 1] Initiating booking for seat "${testSeat}" with failing payment...`);
    const failBookingRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: bookingRef,
        eventId: testEvent.id,
        seats: [testSeat],
        total: 1200,
        paymentMethod: "FAIL", // Triggers simulated payment authorization decline
        event: testEvent,
        user: { name: "Failed Payer", phone: "+91 9999911111", email: "fail@test.com" },
      }),
    });

    console.log(`  Booking response status: ${failBookingRes.status} (Expected: 402 or 400)`);
    if (failBookingRes.status !== 402 && failBookingRes.status !== 400) {
      throw new Error(`Expected payment failure status (402/400) but received: ${failBookingRes.status}`);
    }
    const failBody = await failBookingRes.json();
    console.log(`  Error message returned to client: "${failBody.error}"`);

    // STEP 2: Verify Ticket Service has ZERO tickets generated for this booking
    console.log(`\n[TEST STEP 2] Verifying Ticket Service has NO tickets for ${bookingRef}...`);
    const ticketRes = await fetch(`${GATEWAY_URL}/api/tickets/booking/${bookingRef}`);
    let tickets = [];
    if (ticketRes.ok) {
      const tData = await ticketRes.json();
      tickets = tData.data || tData || [];
    }
    console.log(`  Ticket count for failed booking: ${tickets.length} (Expected: 0)`);
    if (tickets.length > 0) {
      throw new Error(`CRITICAL SAGA FAILURE: Tickets were generated for an unpaid, failed booking!`);
    }

    // STEP 3: Verify the seat was RELEASED by attempting a successful booking on the same seat
    console.log(`\n[TEST STEP 3] Verifying seat "${testSeat}" was released by compensation...`);
    const recoveryBookingRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: testEvent.id,
        seats: [testSeat],
        total: 1200,
        paymentMethod: "UPI", // Legitimate payment
        event: testEvent,
        user: { name: "Honest Payer", phone: "+91 9999922222", email: "honest@test.com" },
      }),
    });

    console.log(`  Subsequent booking on same seat status: ${recoveryBookingRes.status} (Expected: 201)`);
    if (recoveryBookingRes.status !== 201) {
      const recBody = await recoveryBookingRes.json().catch(() => ({}));
      throw new Error(`Seat was not released! Error: ${JSON.stringify(recBody)}`);
    }

    const recData = await recoveryBookingRes.json();
    console.log(`  Successfully confirmed new booking ${recData.bookingId} for seat "${testSeat}".`);

    console.log("\n======================================================================");
    console.log("PASS: Saga Compensation verified! Payment failure cannot result in an");
    console.log("incorrectly confirmed booking or ticket, and held seats are safely released.");
    console.log("======================================================================\n");
  } finally {
    for (const p of spawned) {
      try {
        p.kill("SIGTERM");
      } catch (_) {}
    }
  }
}

runSagaPaymentFailureTest().catch((err) => {
  console.error("Saga test failed with error:", err.message);
  process.exit(1);
});

