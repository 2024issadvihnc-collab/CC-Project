import express from "express";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
} from "../../../shared/notification-module/src/services/notification.service.js";
import {
  sendEmail,
  sendBookingConfirmation,
  sendRegistrationEmail,
} from "../../../shared/notification-module/src/services/email.service.js";

const router = express.Router();

function getUserId(req) {
  return req.headers["x-user-id"] || (req.user && req.user.id);
}

// GET /api/notifications - List user's notifications
router.get("/", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  const limit = parseInt(req.query.limit || "50", 10);
  const notifications = await getUserNotifications(userId, limit);
  const unreadCount = await getUnreadCount(userId);

  res.json({
    success: true,
    data: notifications,
    unreadCount,
  });
});

// POST /api/notifications - Create notification (from microservices or gateway)
router.post("/", async (req, res) => {
  const userId = req.body.userId || getUserId(req);
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }

  const { type = "SYSTEM", title = "Notification", message = "", data = {} } = req.body;
  const notif = await createNotification({
    userId,
    type,
    title,
    message,
    data,
  });

  res.status(201).json({
    success: true,
    data: notif,
  });
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  const unreadCount = await getUnreadCount(userId);
  res.json({
    success: true,
    unreadCount,
  });
});

// PATCH /api/notifications/:id/read - Mark one notification as read
router.patch("/:id/read", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  const result = await markAsRead(req.params.id, userId);
  res.json({
    success: true,
    data: result,
  });
});

// POST /api/notifications/mark-all-read - Mark all as read
router.post("/mark-all-read", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  await markAllAsRead(userId);
  res.json({
    success: true,
    message: "All notifications marked as read",
  });
});

// POST /api/notifications/send-test - Verification / trigger endpoint
router.post("/send-test", async (req, res) => {
  const userId = getUserId(req) || req.body.userId || "usr_demo_01";
  const { type = "SYSTEM", title = "Test Notification", message = "This is a test notification", email } = req.body;

  const notif = await createNotification({
    userId,
    type,
    title,
    message,
    data: req.body.data || {},
  });

  let emailResult = null;
  if (email) {
    emailResult = await sendEmail({
      to: email,
      subject: title,
      html: `<p>${message}</p>`,
    });
  }

  res.status(201).json({
    success: true,
    notification: notif,
    emailResult,
  });
});

export default router;
