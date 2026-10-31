import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:5000";

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  FAIL: ${testName}`);
    failedCount++;
  }
}

async function waitForGateway(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status === 207) return true;
    } catch (_) { }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function runTests() {
  console.log("======================================================================");
  console.log("ShowTime Microservices Architecture Automated Verification Suite");
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
  // Check if gateway is running
  const alreadyRunning = await waitForGateway(2);
  if (!alreadyRunning) {
    console.log("Starting microservices suite in background for testing...");
    for (const svc of services) {
      const p = spawn("node", ["server.js"], {
        cwd: path.join(ROOT, svc.dir),
        stdio: "ignore",
        shell: true,
        env: { ...process.env, PORT: svc.port },
      });
      spawned.push(p);
    }
    const ready = await waitForGateway(25);
    if (!ready) {
      console.error("FATAL: Failed to connect to API Gateway after timeout.");
      for (const p of spawned) p.kill("SIGTERM");
      process.exit(1);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: API Gateway Aggregated Health Check
    // -------------------------------------------------------------------------
    console.log("--- Suite 1: API Gateway & Aggregated Health Check ---");
    const healthRes = await fetch(`${GATEWAY_URL}/api/health`);
    assert(healthRes.status === 200 || healthRes.status === 207, "Gateway /api/health returned 200/207 status");
    const healthData = await healthRes.json();
    assert(healthData.gateway === "showtime-api-gateway", "Gateway identifier present");
    assert(healthData.services && Object.keys(healthData.services).length === 5, "All 5 microservices monitored in aggregated health");
    console.log();

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Auth Service via API Gateway
    // -------------------------------------------------------------------------
    console.log("--- Suite 2: Auth Service (User Registration & Authentication) ---");
    const testPhone = "+91 99" + Math.floor(10000000 + Math.random() * 90000000);
    const testEmail = `testuser_${Date.now()}@example.com`;
    const testPass = "SecurePass123!";

    const regRes = await fetch(`${GATEWAY_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        phone: testPhone,
        email: testEmail,
        password: testPass,
      }),
    });
    assert(regRes.status === 201, "User registered successfully (201 Created)");
    const regData = await regRes.json();
    assert(regData.success === true && regData.data?.token, "JWT token returned in registration response");
    const authToken = regData.data.token;

    // Login test
    const loginRes = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: testEmail, password: testPass }),
    });
    assert(loginRes.status === 200, "User logged in with credentials (200 OK)");
    const loginData = await loginRes.json();
    assert(loginData.data?.user?.email === testEmail.toLowerCase(), "Logged in user email matches");

    // OTP test
    const otpSendRes = await fetch(`${GATEWAY_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone }),
    });
    assert(otpSendRes.status === 200, "OTP requested successfully");
    const otpData = await otpSendRes.json();
    const generatedOtp = otpData.data?.otp || "123456";

    const otpVerifyRes = await fetch(`${GATEWAY_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, otp: generatedOtp }),
    });
    assert(otpVerifyRes.status === 200, "OTP verified successfully");
    console.log();

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Event Service via API Gateway
    // -------------------------------------------------------------------------
    console.log("--- Suite 3: Event Service (Catalog & Seat Layouts) ---");
    const eventsRes = await fetch(`${GATEWAY_URL}/api/events`);
    assert(eventsRes.status === 200, "Events listing returned 200 OK");
    const events = await eventsRes.json();
    assert(Array.isArray(events) && events.length > 0, `Events catalog has items (Count: ${events.length})`);

    const firstEvent = events[0];
    const eventDetailRes = await fetch(`${GATEWAY_URL}/api/events/${firstEvent.id}`);
    assert(eventDetailRes.status === 200, `Event details fetched for ID: ${firstEvent.id}`);

    const seatsRes = await fetch(`${GATEWAY_URL}/api/events/${firstEvent.id}/seats`);
    assert(seatsRes.status === 200, "Event seat layout fetched successfully");
    const seatsData = await seatsRes.json();
    assert(Array.isArray(seatsData.layout) && seatsData.layout.length > 0, "Seat layout tiers configured properly");
    console.log();

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Payment Service via API Gateway
    // -------------------------------------------------------------------------
    console.log("--- Suite 4: Payment Service (Idempotency & Processing) ---");
    const testBookingRef = "BK_TEST_" + Date.now().toString(36).toUpperCase();
    const idempKey = "IDEMP_" + Date.now();

    const payRes1 = await fetch(`${GATEWAY_URL}/api/payments/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingReference: testBookingRef,
        amount: 1500,
        paymentMethod: "UPI",
        idempotencyKey: idempKey,
      }),
    });
    assert(payRes1.status === 201, "Payment processed successfully (201 Created)");
    const payData1 = await payRes1.json();
    assert(payData1.data?.payment_status === "COMPLETED", "Payment status is COMPLETED");

    // Idempotency verification: exact duplicate request
    const payRes2 = await fetch(`${GATEWAY_URL}/api/payments/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingReference: testBookingRef,
        amount: 1500,
        paymentMethod: "UPI",
        idempotencyKey: idempKey,
      }),
    });
    const payData2 = await payRes2.json();
    assert(payData2.data?.isDuplicate === true, "Idempotent duplicate request recognized without double charging");
    console.log();

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Ticket Service via API Gateway
    // -------------------------------------------------------------------------
    console.log("--- Suite 5: Ticket Service (QR Code Generation & Gate Scan) ---");
    const tktGenRes = await fetch(`${GATEWAY_URL}/api/tickets/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingReference: testBookingRef,
        eventId: firstEvent.id,
        eventTitle: firstEvent.title,
        seats: ["A-01"],
        total: 1500,
        user: { name: "Test Attendee", phone: testPhone },
      }),
    });
    assert(tktGenRes.status === 201, "Ticket and QR code generated (201 Created)");
    const tktGenData = await tktGenRes.json();
    const createdTicket = tktGenData.data?.tickets?.[0];
    assert(createdTicket?.qrCode?.startsWith("data:image/png;base64,"), "Valid scannable PNG QR code generated");

    // Scan ticket at gate
    const scanRes = await fetch(`${GATEWAY_URL}/api/tickets/${createdTicket.ticket_reference}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-pin": "1234" },
      body: JSON.stringify({ gateLocation: "NORTH_GATE", scannedBy: "usher_01", staffPin: "1234" }),
    });
    assert(scanRes.status === 200, "Ticket admitted successfully at gate scanner");

    // Scan again should reject with already used
    const scanRes2 = await fetch(`${GATEWAY_URL}/api/tickets/${createdTicket.ticket_reference}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-pin": "1234" },
      body: JSON.stringify({ gateLocation: "NORTH_GATE", scannedBy: "usher_01", staffPin: "1234" }),
    });
    assert(scanRes2.status === 400, "Second scan of same ticket safely rejected (Already Used)");
    console.log();

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Booking Service & Saga Distributed Flow
    // -------------------------------------------------------------------------
    console.log("--- Suite 6: Booking Service (End-to-End Booking Saga) ---");
    const uniqueSeat = "SEAT_" + Date.now().toString(36).slice(4);

    const bookingRes = await fetch(`${GATEWAY_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        eventId: firstEvent.id,
        seats: [uniqueSeat],
        total: 800,
        paymentMethod: "upi",
        event: firstEvent,
        user: { name: "Test User", phone: testPhone, email: testEmail },
      }),
    });
    assert(bookingRes.status === 201, "End-to-end booking created successfully through Saga (201 Created)");
    const bookingData = await bookingRes.json();
    assert(bookingData.bookingId && bookingData.status === "CONFIRMED", "Booking confirmed and reference ID issued");
    assert(bookingData.ticket && bookingData.ticket.tickets?.length > 0, "QR ticket generated during booking confirmation");

    // Fetch user bookings
    const userBookingsRes = await fetch(`${GATEWAY_URL}/api/bookings?email=${testEmail}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(userBookingsRes.status === 200, "User booking history fetched successfully");
    const userBookings = await userBookingsRes.json();
    assert(Array.isArray(userBookings) && userBookings.length > 0, "Created booking appears in user history");

    // Clean up test account
    await fetch(`${GATEWAY_URL}/api/auth/account`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ phone: testPhone, email: testEmail }),
    });
  } finally {
    for (const p of spawned) {
      try {
        p.kill("SIGTERM");
      } catch (_) { }
    }
  }

  console.log("======================================================================");
  console.log(`Test Execution Summary:`);
  console.log(`  Passed: ${passedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log("======================================================================");

  if (failedCount > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch((err) => {
  console.error("Test runner encountered an error:", err);
  process.exit(1);
});

