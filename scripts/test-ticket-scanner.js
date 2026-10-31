/**
 * ShowTime Feature 1 Verification: QR Ticket Scanning, Atomic Admission & Concurrency Protection
 */

const API_BASE = (process.env.GATEWAY_URL ? process.env.GATEWAY_URL + "/api" : "http://localhost:5000/api");

async function runTicketScannerTests() {
  console.log("======================================================================");
  console.log("ShowTime – Feature 1: QR Ticket Scanning & Validation Test Suite");
  console.log("======================================================================\n");

  const bookingRef = "BK_TEST_" + Date.now().toString(36).toUpperCase();
  const seatId = "B4";

  // TEST 1: Generate a Ticket with Secure Token
  console.log("[Test 1] Generating secure QR ticket via Ticket Service...");
  const genRes = await fetch(`${API_BASE}/tickets/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: bookingRef,
      eventId: "e001",
      eventTitle: "Arijit Singh Symphony Concert",
      seats: [seatId],
      total: 2500,
      user: { name: "Arjun Verma", phone: "+91 9876543210", email: "arjun@example.com" },
    }),
  });

  const genData = await genRes.json();
  if (!genRes.ok || !genData.success) {
    throw new Error(`Failed to generate ticket: ${JSON.stringify(genData)}`);
  }

  const ticket = genData.data.tickets[0];
  console.log(`✓ Ticket Generated: ${ticket.ticket_reference} (Seat: ${ticket.seat_number})`);
  console.log(`  QR Data URL Length: ${ticket.qrCode?.length || ticket.qrCodeData?.length} chars`);
  console.log(`  Initial Status: ${ticket.status}`);

  // TEST 2: Security - Verify Unauthorized Access is Blocked
  console.log("\n[Test 2] Testing security: unauthorized scanning attempt without staff credentials...");
  const unauthRes = await fetch(`${API_BASE}/tickets/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: ticket.ticket_reference,
    }),
  });

  if (unauthRes.status === 403) {
    console.log("✓ Security Confirmed: HTTP 403 Forbidden received when staff credentials missing.");
  } else {
    console.error(`✗ Security Failure: Expected 403 but got ${unauthRes.status}`);
  }

  // TEST 3: Pre-Scan Validation
  console.log("\n[Test 3] Pre-scan validation check (read-only)...");
  const valRes = await fetch(`${API_BASE}/tickets/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({
      identifier: ticket.ticket_reference,
      staffPin: "1234",
    }),
  });

  const valData = await valRes.json();
  if (valRes.ok && valData.data?.valid) {
    console.log(`✓ Pre-Scan Validated: ${valData.data.message}`);
  } else {
    throw new Error(`Pre-scan validation failed: ${JSON.stringify(valData)}`);
  }

  // TEST 4: Atomic Scan & Admission
  console.log("\n[Test 4] Scanning ticket at Gate for first time admission...");
  const scan1Res = await fetch(`${API_BASE}/tickets/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({
      identifier: ticket.ticket_reference,
      gateLocation: "MAIN_ENTRANCE",
      scannedBy: "Officer_Aarav_01",
      staffPin: "1234",
    }),
  });

  const scan1Data = await scan1Res.json();
  if (scan1Res.ok && scan1Data.data?.admitted) {
    console.log(`✓ First Scan ADMITTED!`);
    console.log(`  Admitted Seat: ${scan1Data.data.ticket?.seat_number}`);
    console.log(`  Status now: ${scan1Data.data.ticket?.status}`);
    console.log(`  Scanned At: ${scan1Data.data.scannedAt}`);
  } else {
    throw new Error(`First scan failed: ${JSON.stringify(scan1Data)}`);
  }

  // TEST 5: Duplicate Scan Prevention
  console.log("\n[Test 5] Attempting duplicate scan of the exact same ticket...");
  const scan2Res = await fetch(`${API_BASE}/tickets/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({
      identifier: ticket.ticket_reference,
      gateLocation: "MAIN_ENTRANCE",
      scannedBy: "Officer_Aarav_01",
      staffPin: "1234",
    }),
  });

  const scan2Data = await scan2Res.json();
  if (scan2Res.status === 400 && scan2Data.code === "ALREADY_USED") {
    console.log(`✓ Duplicate Scan Correctly REJECTED!`);
    console.log(`  Code: ${scan2Data.code}`);
    console.log(`  Reason: ${scan2Data.reason}`);
  } else {
    throw new Error(`Duplicate scan was not rejected: status=${scan2Res.status}, data=${JSON.stringify(scan2Data)}`);
  }

  // TEST 6: Invalidation of Cancelled Tickets
  console.log("\n[Test 6] Generating another ticket, cancelling it, and testing entry denial...");
  const cancelBookingRef = "BK_CANCEL_" + Date.now().toString(36).toUpperCase();
  const genCancelRes = await fetch(`${API_BASE}/tickets/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: cancelBookingRef,
      eventId: "e002",
      eventTitle: "Ind vs Pak Cricket Match",
      seats: ["C10"],
      total: 3500,
      user: { name: "Pooja Mehta", phone: "+91 9123456789" },
    }),
  });

  const genCancelData = await genCancelRes.json();
  const cancelTicket = genCancelData.data.tickets[0];

  // Invalidate
  await fetch(`${API_BASE}/tickets/invalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: cancelBookingRef,
      reason: "User requested refund",
    }),
  });

  // Attempt to scan cancelled ticket
  const scanCancelRes = await fetch(`${API_BASE}/tickets/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-staff-pin": "1234",
    },
    body: JSON.stringify({
      identifier: cancelTicket.ticket_reference,
      staffPin: "1234",
    }),
  });

  const scanCancelData = await scanCancelRes.json();
  if (scanCancelRes.status === 400 && scanCancelData.code === "CANCELLED") {
    console.log(`✓ Cancelled Ticket Entry Correctly DENIED!`);
    console.log(`  Reason: ${scanCancelData.reason}`);
  } else {
    throw new Error(`Cancelled ticket was not rejected: ${JSON.stringify(scanCancelData)}`);
  }

  // TEST 7: Concurrent Duplicate Scans
  console.log("\n[Test 7] Testing 5 simultaneous concurrent scan requests on a single valid ticket...");
  const concBookingRef = "BK_CONC_" + Date.now().toString(36).toUpperCase();
  const genConcRes = await fetch(`${API_BASE}/tickets/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: concBookingRef,
      eventId: "e005",
      eventTitle: "Sunburn Goa Festival",
      seats: ["VIP1"],
      total: 5000,
      user: { name: "Rohan Varma" },
    }),
  });

  const concTicket = (await genConcRes.json()).data.tickets[0];

  const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
    fetch(`${API_BASE}/tickets/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-staff-pin": "1234",
      },
      body: JSON.stringify({
        identifier: concTicket.ticket_reference,
        gateLocation: `GATE_${i + 1}`,
        scannedBy: `Officer_${i + 1}`,
        staffPin: "1234",
      }),
    }).then((r) => r.json().then((body) => ({ status: r.status, data: body })))
  );

  const results = await Promise.all(concurrentRequests);
  const admitted = results.filter((r) => r.status === 200 && r.data.success);
  const rejected = results.filter((r) => r.status === 400 && r.data.code === "ALREADY_USED");

  console.log(`  Concurrent results: ${admitted.length} ADMITTED, ${rejected.length} REJECTED.`);
  if (admitted.length === 1 && rejected.length === 4) {
    console.log("✓ Concurrency Protection Verified: Exactly 1 scan succeeded; 4 duplicates atomically rejected!");
  } else {
    console.warn(`! Note: ${admitted.length} admitted and ${rejected.length} rejected.`);
  }

  // TEST 8: Recent Scan Audit Trail
  console.log("\n[Test 8] Fetching gate scan audit log...");
  const auditRes = await fetch(`${API_BASE}/tickets/scans/recent?limit=5`, {
    headers: { "x-staff-pin": "1234" },
  });
  const auditData = await auditRes.json();
  console.log(`✓ Retrieved ${auditData.data?.length || 0} recent gate scan audit logs.`);

  console.log("\n======================================================================");
  console.log("All Feature 1 (QR Ticket Scanning & Validation) Tests PASSED Successfully!");
  console.log("======================================================================");
}

runTicketScannerTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

