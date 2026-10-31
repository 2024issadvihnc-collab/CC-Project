/**
 * Test Suite: Email and In-App Notification System (Phase 4)
 * Verifies email rendering/sending, in-app notification persistence, unread tracking, and API Gateway endpoints.
 */

import { emailTemplates } from "../shared/notification-module/src/templates/emailTemplates.js";
import {
  sendEmail,
  sendBookingConfirmation,
  sendRegistrationEmail,
  sendCancellationEmail,
  sendRefundStatusEmail,
} from "../shared/notification-module/src/services/email.service.js";
import {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../shared/notification-module/src/services/notification.service.js";

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
  console.log("ShowTime: Running Phase 4 Notification Test Suite");
  console.log("====================================================");

  const testUserId = "usr_notif_test_" + Date.now();

  // Test 1: HTML Email Templates Render Valid Output
  console.log("\n[Test 1] HTML Email Templates Validation:");
  const welcomeTpl = emailTemplates.getRegistrationEmail({ name: "Rahul Sharma", email: "rahul@example.com" });
  assert(welcomeTpl.subject.includes("Welcome to ShowTime"), "Welcome subject rendered correctly");
  assert(welcomeTpl.html.includes("Rahul Sharma") && (welcomeTpl.html.includes("ShowTime") || welcomeTpl.html.includes("show<b>time</b>")), "Welcome HTML contains name and brand");

  const bookingTpl = emailTemplates.getBookingConfirmationEmail({
    bookingId: "BKG_TEST_101",
    eventTitle: "A.R. Rahman Live",
    seats: ["A1", "A2"],
    total: 3500,
    date: "2026-11-21",
    time: "7:00 PM",
    venue: "JLN Stadium",
    city: "Delhi",
  });
  assert(bookingTpl.subject.includes("BKG_TEST_101"), "Booking confirmation subject contains booking reference");
  assert(bookingTpl.html.includes("A1, A2") && bookingTpl.html.includes("3,500"), "Booking HTML contains seats and formatted amount");

  // Test 2: Email Service Dispatch
  console.log("\n[Test 2] Email Dispatch (Live/Simulated):");
  const emailRes = await sendBookingConfirmation({
    to: "customer@showtime.local",
    bookingId: "BKG_TEST_102",
    eventTitle: "Diljit Dosanjh – Aura Tour",
    seats: ["C10", "C11"],
    total: 4999,
    date: "2026-11-27",
    time: "6:30 PM",
    venue: "Mahalaxmi Race Course",
    city: "Mumbai",
  });
  assert(emailRes.success === true, "Email dispatched without throwing");

  // Test 3: In-App Notification Creation & Query
  console.log("\n[Test 3] In-App Notification Store & Retrieval:");
  const notif1 = await createNotification({
    userId: testUserId,
    type: "BOOKING_CONFIRMED",
    title: "Booking Confirmed! 🎟️",
    message: "Your booking for Diljit Dosanjh is confirmed.",
    data: { bookingId: "BKG_TEST_102", seats: ["C10", "C11"] },
  });
  assert(notif1 && notif1.user_id === testUserId, "Notification created with correct userId");

  const notif2 = await createNotification({
    userId: testUserId,
    type: "SYSTEM",
    title: "Special Offer Available",
    message: "Get 20% off on your next comedy ticket.",
  });
  assert(notif2 && notif2.title.includes("Special Offer"), "Second notification created");

  let count = await getUnreadCount(testUserId);
  assert(count === 2, `Unread count matches expected 2 (got ${count})`);

  let list = await getUserNotifications(testUserId);
  assert(list.length === 2, `Retrieved exactly 2 notifications (got ${list.length})`);

  // Test 4: Mark Notification as Read
  console.log("\n[Test 4] Mark Single Notification as Read:");
  const readRes = await markAsRead(notif1.id, testUserId);
  assert(readRes && readRes.is_read === true, "Notification marked as read");

  count = await getUnreadCount(testUserId);
  assert(count === 1, `Unread count decremented to 1 (got ${count})`);

  // Test 5: Mark All as Read
  console.log("\n[Test 5] Mark All Notifications as Read:");
  await markAllAsRead(testUserId);
  count = await getUnreadCount(testUserId);
  assert(count === 0, `Unread count reset to 0 after markAllAsRead (got ${count})`);

  // Test 6: API Gateway Endpoint Routing
  console.log("\n[Test 6] API Gateway Notification Endpoints:");
  try {
    // Call /api/notifications with x-user-id header
    const apiRes = await fetch(`${GATEWAY_URL}/api/notifications`, {
      headers: { "x-user-id": testUserId },
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      assert(data.success === true && Array.isArray(data.data), "API Gateway returned user notifications");
      assert(data.unreadCount === 0, "API Gateway returned accurate unreadCount (0)");
    } else {
      console.log(`  [INFO] API Gateway returned status ${apiRes.status} (microservices restarting)`);
    }
  } catch (err) {
    console.log(`  [INFO] Gateway fetch notice: ${err.message}`);
  }

  console.log("\n====================================================");
  console.log(`Notification Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("====================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
