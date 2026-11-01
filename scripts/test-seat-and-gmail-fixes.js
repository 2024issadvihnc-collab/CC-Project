import http from "http";

const BASE_URL = "http://3.26.228.188"; // Frontend Nginx proxying to Backend

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("====================================================");
  console.log("SHOWTIME LIVE AWS VERIFICATION — SEAT AVAILABILITY & GMAIL LOGIN");
  console.log("Testing against:", BASE_URL);
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // ── TEST 1: Google / Gmail Login with Existing User (sadvihn@gmail.com) ──
  console.log("--- TEST SUITE 1: GOOGLE / GMAIL AUTHENTICATION ---");
  const gLoginRes = await request("/api/auth/google", {
    method: "POST",
    body: { email: "sadvihn@gmail.com", name: "Sadvi" },
  });
  assert(gLoginRes.status === 200, `POST /api/auth/google status is 200 (got ${gLoginRes.status})`);
  assert(gLoginRes.data?.data?.user?.email === "sadvihn@gmail.com", "Google login returned user sadvihn@gmail.com");
  assert(Boolean(gLoginRes.data?.data?.token), "Google login returned valid JWT access token");
  const userToken = gLoginRes.data?.data?.token;

  // ── TEST 2: Google / Gmail Login Auto-Registration with New Gmail ──
  const uniqueGmail = `test.showtime.${Date.now()}@gmail.com`;
  const gNewRes = await request("/api/auth/google", {
    method: "POST",
    body: { email: uniqueGmail, name: "New Google User" },
  });
  assert(gNewRes.status === 200, `Auto-register new Gmail status is 200 (got ${gNewRes.status})`);
  assert(gNewRes.data?.data?.user?.email === uniqueGmail, `Auto-created user with email ${uniqueGmail}`);
  assert(Boolean(gNewRes.data?.data?.token), "Auto-registration returned valid JWT token");

  // ── TEST 3: OTP Authentication with Gmail ──
  const otpSendRes = await request("/api/auth/send-otp", {
    method: "POST",
    body: { identifier: "sadvihn@gmail.com" },
  });
  assert(otpSendRes.status === 200, "POST /api/auth/send-otp with Gmail succeeded");

  const otpVerifyRes = await request("/api/auth/verify-otp", {
    method: "POST",
    body: { identifier: "sadvihn@gmail.com", otp: "123456" },
  });
  assert(otpVerifyRes.status === 200, "POST /api/auth/verify-otp with Gmail succeeded");
  assert(otpVerifyRes.data?.data?.verified === true, "OTP verified successfully");
  assert(Boolean(otpVerifyRes.data?.data?.token), "OTP verification returned JWT token");

  // ── TEST 4: Seat Availability & Booking Updates ──
  console.log("\n--- TEST SUITE 2: SEAT BOOKING & REAL-TIME AVAILABILITY UPDATE ---");
  const eventId = "e002"; // Diljit Dosanjh
  const seatToBook = `SEAT_${Date.now().toString(36).slice(-4).toUpperCase()}`;

  // Step A: Check current booked seats before booking
  const seatsBeforeRes = await request(`/api/bookings/events/${eventId}/seats`);
  assert(seatsBeforeRes.status === 200, `GET /api/bookings/events/${eventId}/seats status is 200`);
  const bookedBefore = seatsBeforeRes.data?.data?.bookedSeats || [];
  assert(!bookedBefore.includes(seatToBook), `Seat ${seatToBook} is currently unbooked and available`);

  // Step B: Submit booking for seatToBook (even if hold existed)
  const bookingRes = await request("/api/bookings", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      eventId,
      seats: [seatToBook],
      tickets: [{ seatId: seatToBook, price: 1500, tierLabel: "Premium" }],
      total: 1545,
      paymentMethod: "UPI",
      user: {
        id: gLoginRes.data?.data?.user?.id,
        name: "Sadvi",
        email: "sadvihn@gmail.com",
        phone: "+91 9874563219",
      },
    },
  });

  assert(bookingRes.status === 201, `POST /api/bookings returned HTTP 201 Created (got ${bookingRes.status})`);
  assert(Boolean(bookingRes.data?.bookingId || bookingRes.data?.booking_reference), "Booking reference generated");
  console.log("Confirmed Booking ID:", bookingRes.data?.bookingId || bookingRes.data?.booking_reference);

  // Step C: Verify seat availability immediately reflects the booked seat!
  const seatsAfterRes = await request(`/api/bookings/events/${eventId}/seats`);
  const bookedAfter = seatsAfterRes.data?.data?.bookedSeats || [];
  assert(bookedAfter.includes(seatToBook), `Seat ${seatToBook} is now reported as BOOKED in /api/bookings/events/${eventId}/seats!`);

  // Step D: Verify event-service endpoint also reflects the booked seat
  const eventSeatsRes = await request(`/api/events/${eventId}/seats`);
  const eventBooked = eventSeatsRes.data?.bookedSeats || [];
  assert(eventBooked.includes(seatToBook), `Seat ${seatToBook} is also reported as BOOKED in /api/events/${eventId}/seats!`);

  // Step E: Attempting to book the same seat again must result in conflict
  const duplicateBookingRes = await request("/api/bookings", {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
    body: {
      eventId,
      seats: [seatToBook],
      tickets: [{ seatId: seatToBook, price: 1500, tierLabel: "Premium" }],
      total: 1545,
      paymentMethod: "UPI",
      user: {
        id: "usr_another_user",
        name: "Another Customer",
        email: "another@gmail.com",
      },
    },
  });
  assert(
    duplicateBookingRes.status === 409 || duplicateBookingRes.status === 400,
    `Double-booking seat ${seatToBook} correctly rejected with Conflict status (got ${duplicateBookingRes.status})`
  );

  console.log("\n====================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
