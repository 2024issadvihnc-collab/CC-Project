import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5000";

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

async function runConcurrencyTest() {
  console.log("======================================================================");
  console.log("ShowTime Microservices Concurrency & Double-Booking Stress Test");
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
    console.log("Starting microservices suite in background...");
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
    // 1. Fetch first available event
    const eventsRes = await fetch(`${GATEWAY_URL}/api/events`);
    const events = await eventsRes.json();
    const targetEvent = events[0];

    // Pick an exclusive high-demand target seat
    const contestedSeat = "CONCURRENT_HOT_SEAT_" + Date.now().toString(36);
    console.log(`Target Event: "${targetEvent.title}" (${targetEvent.id})`);
    console.log(`Contested Seat: "${contestedSeat}"`);
    console.log(`Dispatching 5 simultaneous booking requests at the exact same millisecond...\n`);

    const users = [
      { name: "Rival Alice", phone: "+91 9800000001", email: "alice@test.com" },
      { name: "Rival Bob", phone: "+91 9800000002", email: "bob@test.com" },
      { name: "Rival Charlie", phone: "+91 9800000003", email: "charlie@test.com" },
      { name: "Rival Diana", phone: "+91 9800000004", email: "diana@test.com" },
      { name: "Rival Evan", phone: "+91 9800000005", email: "evan@test.com" },
    ];

    // Fire 5 simultaneous requests simultaneously via Promise.all
    const promises = users.map((u, idx) => {
      const payload = {
        eventId: targetEvent.id,
        seats: [contestedSeat],
        total: 1000,
        paymentMethod: "upi",
        event: targetEvent,
        user: u,
      };

      return fetch(`${GATEWAY_URL}/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return {
          user: u.name,
          status: res.status,
          success: res.status === 201,
          body,
        };
      });
    });

    const results = await Promise.all(promises);

    let successCount = 0;
    let conflictCount = 0;

    console.log("Concurrency Test Results:");
    console.log("----------------------------------------------------------------------");
    results.forEach((r) => {
      if (r.status === 201) {
        successCount++;
        console.log(`  [201 SUCCESS]  ${r.user} -> Booking ID: ${r.body.bookingId}`);
      } else if (r.status === 409) {
        conflictCount++;
        console.log(`  [409 CONFLICT] ${r.user} -> Error: ${r.body.error}`);
      } else {
        console.log(`  [${r.status} OTHER]    ${r.user} -> ${JSON.stringify(r.body)}`);
      }
    });
    console.log("----------------------------------------------------------------------\n");

    console.log("Concurrency Assertions:");
    const passSingleSuccess = successCount === 1;
    const passConflictRejections = conflictCount === 4;

    console.log(`  ${passSingleSuccess ? "PASS" : "FAIL"}: Exactly 1 user succeeded (Actual: ${successCount})`);
    console.log(`  ${passConflictRejections ? "PASS" : "FAIL"}: Exactly 4 users safely rejected with 409 Conflict (Actual: ${conflictCount})`);

    if (passSingleSuccess && passConflictRejections) {
      console.log("\nCONCLUSION: High-concurrency protection VERIFIED. Zero double-booking occurred.");
    } else {
      console.error("\nCONCLUSION: Concurrency protection FAILED. Double-booking check did not pass.");
      process.exit(1);
    }
  } finally {
    for (const p of spawned) {
      try {
        p.kill("SIGTERM");
      } catch (_) {}
    }
  }
}

runConcurrencyTest().catch((err) => {
  console.error("Concurrency test failed with error:", err);
  process.exit(1);
});

