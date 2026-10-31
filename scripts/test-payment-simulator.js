/**
 * ShowTime Feature 2 Verification: Realistic Payment Simulator Lifecycle & Idempotency
 */

const API_BASE = "http://localhost:5000/api";

async function runPaymentSimulatorTests() {
  console.log("======================================================================");
  console.log("ShowTime – Feature 2: Realistic Payment Simulator Test Suite");
  console.log("======================================================================\n");

  const bookingRef = "BK_PAY_TEST_" + Date.now().toString(36).toUpperCase();
  const idempotencyKey = `idemp_${bookingRef}_1`;

  // TEST 1: Initiate Payment Session
  console.log("[Test 1] Initiating payment session in Payment Service...");
  const initRes = await fetch(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: bookingRef,
      amount: 1850,
      paymentMethod: "UPI",
      idempotencyKey,
      currency: "INR",
    }),
  });

  const initData = await initRes.json();
  if (!initRes.ok || !initData.success) {
    throw new Error(`Initiation failed: ${JSON.stringify(initData)}`);
  }

  const paymentRef = initData.data.paymentReference;
  console.log(`✓ Payment Session Initiated:`);
  console.log(`  Payment Reference: ${paymentRef}`);
  console.log(`  Gateway Transaction ID: ${initData.data.gatewayTransactionId}`);
  console.log(`  Status: ${initData.data.status}`);
  console.log(`  Amount: INR ${initData.data.amount}`);

  // TEST 2: Idempotency Protection
  console.log("\n[Test 2] Verifying idempotency protection against duplicate initiate requests...");
  const dupRes = await fetch(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: bookingRef,
      amount: 1850,
      paymentMethod: "UPI",
      idempotencyKey,
    }),
  });

  const dupData = await dupRes.json();
  if (dupRes.ok && (dupData.data.isDuplicate || dupData.data.paymentReference === paymentRef)) {
    console.log(`✓ Idempotency Confirmed: Duplicate request safely returned original payment ${dupData.data.paymentReference}`);
  } else {
    throw new Error(`Idempotency failed: ${JSON.stringify(dupData)}`);
  }

  // TEST 3: Simulate Bank Decline
  console.log("\n[Test 3] Simulating bank authorization decline (insufficient funds)...");
  const declineBookingRef = "BK_DECLINE_" + Date.now().toString(36).toUpperCase();
  const initDeclineRes = await fetch(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: declineBookingRef,
      amount: 4500,
      paymentMethod: "CARD",
    }),
  });
  const declinePayRef = (await initDeclineRes.json()).data.paymentReference;

  const verifyDeclineRes = await fetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentReference: declinePayRef,
      action: "DECLINE",
      failureReason: "Card declined: Insufficient funds in bank account",
    }),
  });

  const declineData = await verifyDeclineRes.json();
  if (verifyDeclineRes.status === 402 && declineData.paymentStatus === "FAILED") {
    console.log(`✓ Decline Flow Verified: HTTP 402 received with status FAILED`);
    console.log(`  Reason: ${declineData.error}`);
  } else {
    throw new Error(`Decline simulation failed: ${JSON.stringify(declineData)}`);
  }

  // TEST 4: Simulate Gateway Timeout
  console.log("\n[Test 4] Simulating gateway network timeout...");
  const timeoutBookingRef = "BK_TIMEOUT_" + Date.now().toString(36).toUpperCase();
  const initTimeoutRes = await fetch(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingReference: timeoutBookingRef,
      amount: 1200,
      paymentMethod: "NETBANKING",
    }),
  });
  const timeoutPayRef = (await initTimeoutRes.json()).data.paymentReference;

  const verifyTimeoutRes = await fetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentReference: timeoutPayRef,
      action: "TIMEOUT",
    }),
  });

  const timeoutData = await verifyTimeoutRes.json();
  if (verifyTimeoutRes.status === 504 && timeoutData.paymentStatus === "FAILED") {
    console.log(`✓ Timeout Flow Verified: HTTP 504 received with status FAILED`);
    console.log(`  Reason: ${timeoutData.error}`);
  } else {
    throw new Error(`Timeout simulation failed: ${JSON.stringify(timeoutData)}`);
  }

  // TEST 5: Simulate Successful Payment Authorization
  console.log("\n[Test 5] Simulating successful payment authorization & settlement...");
  const verifySuccessRes = await fetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentReference: paymentRef,
      action: "AUTHORIZE",
    }),
  });

  const successData = await verifySuccessRes.json();
  if (verifySuccessRes.ok && successData.data?.status === "COMPLETED") {
    console.log(`✓ Payment Authorized & Settled:`);
    console.log(`  Status: ${successData.data.status}`);
    console.log(`  Gateway Transaction ID: ${successData.data.gatewayTransactionId}`);
    console.log(`  Settled At: ${successData.data.settledAt}`);
  } else {
    throw new Error(`Success verification failed: ${JSON.stringify(successData)}`);
  }

  // TEST 6: Payment Details Retrieval by Booking Reference
  console.log("\n[Test 6] Fetching payment record by booking reference...");
  const fetchRes = await fetch(`${API_BASE}/payments/booking/${bookingRef}`);
  const fetchData = await fetchRes.json();
  if (fetchRes.ok && fetchData.data?.payment_reference === paymentRef) {
    console.log(`✓ Payment Record Retrieved: Status=${fetchData.data.payment_status}, Method=${fetchData.data.payment_method}`);
  } else {
    throw new Error(`Fetch payment failed: ${JSON.stringify(fetchData)}`);
  }

  console.log("\n======================================================================");
  console.log("All Feature 2 (Realistic Payment Simulator) Tests PASSED Successfully!");
  console.log("======================================================================");
}

runPaymentSimulatorTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

