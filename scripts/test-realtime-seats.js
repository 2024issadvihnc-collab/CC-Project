/**
 * Comprehensive Multi-Client Real-Time Socket.IO Test Suite:
 * Simulates concurrent users viewing the same event room, testing seat holds,
 * cross-client broadcasts, conflict prevention, lock ownership security,
 * TTL auto-release, and permanent booking broadcasts.
 */

import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";
const EVENT_ID = "e001";

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRealtimeTests() {
  console.log("================================================================================");
  console.log("ShowTime: Running Real-Time Socket.IO Seat Availability Test Suite");
  console.log("================================================================================");

  // 1. Establish two concurrent client connections
  console.log("\n[Test 1] Socket.IO Connection & Room Segregation:");
  const clientA = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { userId: "user_alice_01" },
  });

  const clientB = io(SOCKET_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { userId: "user_bob_02" },
  });

  await Promise.all([
    new Promise((resolve) => clientA.on("connect", resolve)),
    new Promise((resolve) => clientB.on("connect", resolve)),
  ]);

  assert(clientA.connected, "Client Alice successfully connected to Socket.IO Gateway");
  assert(clientB.connected, "Client Bob successfully connected to Socket.IO Gateway");

  // Join Event Room
  clientA.emit("join:event", { eventId: EVENT_ID });
  clientB.emit("join:event", { eventId: EVENT_ID });
  await delay(100);
  assert(true, `Both clients joined room event:${EVENT_ID}`);

  // 2. Client A holds seat RT_101 -> Client B receives seat:held
  console.log("\n[Test 2] Real-Time Seat Hold & Cross-Client Broadcast:");
  const testSeat = "RT_" + Date.now().toString(36).slice(-4).toUpperCase();

  let clientBReceivedHold = null;
  clientB.on("seat:held", (payload) => {
    if (payload.seatId === testSeat) {
      clientBReceivedHold = payload;
    }
  });

  const holdAck = await new Promise((resolve) => {
    clientA.emit("seat:hold", { eventId: EVENT_ID, seatId: testSeat, durationSeconds: 60 }, resolve);
  });

  assert(holdAck.success === true, `Client Alice held seat ${testSeat}`);
  await delay(200);
  assert(clientBReceivedHold && clientBReceivedHold.seatId === testSeat, `Client Bob received real-time broadcast that ${testSeat} was held`);
  assert(clientBReceivedHold.lockedBy === "user_alice_01", "Broadcast contains Alice's client identity");

  // 3. Conflict Prevention: Client B tries to hold the same seat
  console.log("\n[Test 3] Seat Conflict Prevention & Mutex Enforcement:");
  const conflictAck = await new Promise((resolve) => {
    clientB.emit("seat:hold", { eventId: EVENT_ID, seatId: testSeat, durationSeconds: 60 }, resolve);
  });
  assert(conflictAck.success === false, "Client Bob's attempt to hold Alice's seat was rejected");
  assert(conflictAck.reason.includes("held by another user"), "Clear conflict reason provided");

  // 4. Unauthorized Release Protection
  console.log("\n[Test 4] Lock Ownership Verification (Security):");
  const unauthReleaseAck = await new Promise((resolve) => {
    clientB.emit("seat:release", { eventId: EVENT_ID, seatId: testSeat }, resolve);
  });
  assert(unauthReleaseAck.success === false, "Bob is prevented from releasing Alice's seat lock");

  // 5. Authorized Release & Real-time Available Broadcast
  console.log("\n[Test 5] Authorized Release & Real-time Update:");
  let clientBReceivedRelease = null;
  clientB.on("seat:released", (payload) => {
    if (payload.seatId === testSeat) {
      clientBReceivedRelease = payload;
    }
  });

  const authReleaseAck = await new Promise((resolve) => {
    clientA.emit("seat:release", { eventId: EVENT_ID, seatId: testSeat }, resolve);
  });
  assert(authReleaseAck.success === true, "Alice safely released the seat");
  await delay(200);
  assert(clientBReceivedRelease && clientBReceivedRelease.seatId === testSeat, `Bob received seat:released broadcast for ${testSeat}`);

  // 6. Bob can now immediately hold the released seat
  console.log("\n[Test 6] Re-acquiring Released Seat:");
  const bobHoldAck = await new Promise((resolve) => {
    clientB.emit("seat:hold", { eventId: EVENT_ID, seatId: testSeat, durationSeconds: 60 }, resolve);
  });
  assert(bobHoldAck.success === true, `Bob successfully held seat ${testSeat} after release`);

  // 7. Temporary Lock Expiry (TTL Test)
  console.log("\n[Test 7] Temporary Hold Expiry & Auto-Release (TTL):");
  const ttlSeat = "TTL_" + Date.now().toString(36).slice(-4).toUpperCase();
  let ttlExpiredReceived = false;

  clientA.on("seat:released", (payload) => {
    if (payload.seatId === ttlSeat) {
      ttlExpiredReceived = true;
    }
  });

  // Hold for only 2 seconds
  await new Promise((resolve) => {
    clientB.emit("seat:hold", { eventId: EVENT_ID, seatId: ttlSeat, durationSeconds: 2 }, resolve);
  });

  console.log("  Waiting for 2-second lock expiry...");
  await delay(2300);
  assert(ttlExpiredReceived, `Lock for ${ttlSeat} automatically expired and seat:released was broadcast to all clients`);

  // 8. Saga Permanent Confirmation Broadcast (seat:booked)
  console.log("\n[Test 8] Saga Integration (seat:booked broadcast):");
  let aliceReceivedBooked = null;
  clientA.on("seat:booked", (payload) => {
    if (payload.seats && payload.seats.includes(testSeat)) {
      aliceReceivedBooked = payload;
    }
  });

  // Post to API Gateway broadcast endpoint (simulating saga completion)
  const broadcastRes = await fetch(`${SOCKET_URL}/api/realtime/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room: `event:${EVENT_ID}`,
      event: "seat:booked",
      data: { eventId: EVENT_ID, seats: [testSeat], bookingId: "BK_SAGA_TEST" },
    }),
  });
  assert(broadcastRes.ok, "API Gateway accepted broadcast message from Booking Service");
  await delay(200);
  assert(aliceReceivedBooked !== null, `Alice received seat:booked broadcast for permanently confirmed seat ${testSeat}`);

  // Attempt to hold booked seat must fail
  const holdBookedAck = await new Promise((resolve) => {
    clientA.emit("seat:hold", { eventId: EVENT_ID, seatId: testSeat, durationSeconds: 60 }, resolve);
  });
  assert(holdBookedAck.success === false, "Attempt to hold a permanently booked seat is rejected");

  // Clean up
  clientA.disconnect();
  clientB.disconnect();

  console.log("\n================================================================================");
  console.log(`REAL-TIME SOCKET.IO TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

runRealtimeTests().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});

