/**
 * =============================================================================
 * ShowTime End-to-End Automated Test Suite (AWS Cloud-Ready Verification)
 * Runs automated integration and regression tests against the running ShowTime API.
 *
 * Usage:
 *   node scripts/run-all-tests.js [http://localhost:5000]
 * =============================================================================
 */

const BASE_URL = (process.argv[2] || "http://localhost:5000").replace(/\/+$/, "");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  PASS: ${testName} ${detail ? `(${detail})` : ""}`);
  } else {
    failedTests++;
    console.error(`  FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
  }
}

async function runTests() {
  console.log("==========================================================");
  console.log("SHOWTIME CLOUD SUITE: INTEGRATION & REGRESSION TESTS");
  console.log(`Target Backend: ${BASE_URL}`);
  console.log("==========================================================\n");

  // ── TEST SUITE 1: HEALTH & READINESS ──
  console.log("[SUITE 1] Health & Readiness Endpoints");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, "GET /api/health returns HTTP 200");
    const healthData = await healthRes.json();
    assert(healthData.status === "ok", "Health status is 'ok'");
    assert(healthData.version === "2.0.0-cloud", "Version matches 2.0.0-cloud");

    const readyRes = await fetch(`${BASE_URL}/api/health/ready`);
    assert([200, 503].includes(readyRes.status), "GET /api/health/ready responds with valid status", `HTTP ${readyRes.status}`);
    const readyData = await readyRes.json();
    assert(readyData.checks && readyData.checks.database, "Readiness report includes database check");
  } catch (err) {
    assert(false, "Suite 1 Health Check", err.message);
  }

  // ── TEST SUITE 2: EVENTS & SEAT MAPS ──
  console.log("\n[SUITE 2] Events, Categories & Seat Maps");
  let testEventId = "e001";
  try {
    const catRes = await fetch(`${BASE_URL}/api/categories`);
    const cats = await catRes.json();
    assert(Array.isArray(cats) && cats.length >= 7, "GET /api/categories returns 7 clean categories", `${cats.length} categories`);

    const cityRes = await fetch(`${BASE_URL}/api/cities`);
    const cities = await cityRes.json();
    assert(Array.isArray(cities) && cities.includes("Mumbai"), "GET /api/cities includes Mumbai", `${cities.length} cities`);

    const eventsRes = await fetch(`${BASE_URL}/api/events`);
    const events = await eventsRes.json();
    assert(Array.isArray(events) && events.length > 0, "GET /api/events returns event list", `${events.length} events loaded`);
    if (events[0]) testEventId = events[0].id;

    // Search filter
    const searchRes = await fetch(`${BASE_URL}/api/events?q=Rahman`);
    const searchData = await searchRes.json();
    assert(searchData.some((e) => e.title.includes("Rahman")), "GET /api/events?q=Rahman filters correctly");

    // Single event detail
    const detailRes = await fetch(`${BASE_URL}/api/events/${testEventId}`);
    assert(detailRes.status === 200, `GET /api/events/${testEventId} returns HTTP 200`);
    const detailData = await detailRes.json();
    assert(detailData.id === testEventId && detailData.price > 0, "Event detail includes pricing and metadata");

    // Seat map
    const seatsRes = await fetch(`${BASE_URL}/api/events/${testEventId}/seats`);
    assert(seatsRes.status === 200, `GET /api/events/${testEventId}/seats returns HTTP 200`);
    const seatsData = await seatsRes.json();
    assert(Array.isArray(seatsData.tiers) && seatsData.tiers.length === 3, "Seats response includes 3 tiers (VIP, Prime, Standard)");
    assert(Array.isArray(seatsData.soldSeats), "Seats response includes soldSeats array");
  } catch (err) {
    assert(false, "Suite 2 Events", err.message);
  }

  // ── TEST SUITE 3: AUTHENTICATION & SECURITY ──
  console.log("\n[SUITE 3] Authentication & Security");
  const uniquePhone = "9" + Math.floor(100000000 + Math.random() * 900000000);
  const uniqueEmail = `test_${Date.now()}@showtime.cloud`;
  let authToken = null;
  let testUserId = null;

  try {
    // 1. Registration
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cloud Test User",
        phone: uniquePhone,
        email: uniqueEmail,
        password: "SuperSecretPassword@123",
      }),
    });
    assert(regRes.status === 201, "POST /api/auth/register creates new account with HTTP 201");
    const regData = await regRes.json();
    assert(regData.token && regData.user, "Registration returns JWT token and sanitized user object");
    assert(!regData.user.password && !regData.user.password_hash, "Passwords are never exposed in response");
    authToken = regData.token;
    testUserId = regData.user.id;

    // 2. Duplicate prevention
    const dupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate User",
        phone: uniquePhone,
        email: uniqueEmail,
        password: "AnotherPassword123",
      }),
    });
    assert(dupRes.status === 409 || dupRes.status === 400, "Duplicate registration rejected with HTTP 409/400");

    // 3. Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: uniqueEmail,
        password: "SuperSecretPassword@123",
      }),
    });
    assert(loginRes.status === 200, "POST /api/auth/login succeeds with HTTP 200");
    const loginData = await loginRes.json();
    assert(loginData.token, "Login returns valid signed JWT token");

    // 4. Reset Password
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: uniquePhone,
        newPassword: "BrandNewPassword@456",
      }),
    });
    assert(resetRes.status === 200, "POST /api/auth/reset-password succeeds with HTTP 200");

    // 5. Verify Login with New Password
    const reloginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: uniqueEmail,
        password: "BrandNewPassword@456",
      }),
    });
    assert(reloginRes.status === 200, "Login succeeds with updated password");
  } catch (err) {
    assert(false, "Suite 3 Auth", err.message);
  }

  // ── TEST SUITE 4: OTP MANAGEMENT ──
  console.log("\n[SUITE 4] OTP Management & Cooldown");
  try {
    const otpPhone = "98" + Math.floor(10000000 + Math.random() * 90000000);
    const sendOtpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: otpPhone }),
    });
    assert(sendOtpRes.status === 200, "POST /api/auth/send-otp sends OTP with HTTP 200");
    const otpData = await sendOtpRes.json();
    assert(otpData.phone, "OTP response contains formatted phone");

    // Test verify demo OTP
    const verifyOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: otpPhone, otp: "123456" }),
    });
    assert(verifyOtpRes.status === 200, "POST /api/auth/verify-otp validates code and signs in user");
  } catch (err) {
    assert(false, "Suite 4 OTP", err.message);
  }

  // ── TEST SUITE 5: BOOKINGS & CONCURRENCY ──
  console.log("\n[SUITE 5] Bookings, Atomic Transactions & Concurrency");
  const uniqueSeat = "T" + Math.floor(Math.random() * 800 + 100);
  let confirmedBookingId = null;

  try {
    // 1. Initial Booking
    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        eventId: testEventId,
        seats: [uniqueSeat],
        tickets: [{ seatId: uniqueSeat, tierLabel: "Premium Tier", price: 1999 }],
        total: 1999,
        paymentMethod: "upi",
        user: { id: testUserId, name: "Cloud Test User", phone: uniquePhone, email: uniqueEmail },
      }),
    });
    assert(bookRes.status === 201, "POST /api/bookings creates confirmed booking with HTTP 201");
    const bookData = await bookRes.json();
    assert(bookData.bookingId && bookData.bookingId.startsWith("ST"), "Booking reference generated (e.g. ST******)", bookData.bookingId);
    confirmedBookingId = bookData.bookingId;

    // 2. Fetch booking by ID
    const fetchBookingRes = await fetch(`${BASE_URL}/api/bookings/${confirmedBookingId}`);
    assert(fetchBookingRes.status === 200, `GET /api/bookings/${confirmedBookingId} returns booking`);
    const fetchedBooking = await fetchBookingRes.json();
    assert(fetchedBooking.seats && fetchedBooking.seats.includes(uniqueSeat), "Booking record contains confirmed seats");

    // 3. User Bookings query
    const userBookingsRes = await fetch(`${BASE_URL}/api/bookings?phone=${uniquePhone}`);
    const userBookings = await userBookingsRes.json();
    assert(userBookings.some((b) => b.bookingId === confirmedBookingId), "User bookings history lists newly confirmed booking");

    // 4. Duplicate Seat Booking Attempt (Must Fail with HTTP 409 Conflict)
    const dupSeatRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: testEventId,
        seats: [uniqueSeat], // Same seat!
        total: 1999,
        user: { name: "Intruder User", phone: "9000000000" },
      }),
    });
    assert(dupSeatRes.status === 409, "Second attempt to book the same seat is rejected with HTTP 409 Conflict");
  } catch (err) {
    assert(false, "Suite 5 Bookings", err.message);
  }

  // ── TEST SUMMARY ──
  console.log("\n==========================================================");
  console.log("TEST EXECUTION COMPLETED");
  console.log("==========================================================");
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);

  if (failedTests === 0) {
    console.log("RESULT: ALL TESTS PASSED! ShowTime is verified AWS Cloud-Ready.");
  } else {
    console.error(`RESULT: ${failedTests} test(s) failed.`);
    process.exit(1);
  }
  console.log("==========================================================\n");
}

runTests().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});

