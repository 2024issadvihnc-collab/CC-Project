// ShowTime API Service - Connects frontend to Express Backend (AWS Cloud-Ready)

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

/**
 * Returns standard request headers, automatically attaching the JWT Bearer token
 * if a authenticated user is stored in localStorage.
 */
function getAuthHeaders(extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  try {
    const saved = localStorage.getItem("showtime_user");
    if (saved) {
      const user = JSON.parse(saved);
      if (user?.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }
    }
  } catch (_) {}
  return headers;
}

export async function getEvents(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.category && params.category !== "all") query.append("category", params.category);
    if (params.city && params.city !== "All") query.append("city", params.city);
    if (params.q) query.append("q", params.q);
    if (params.sort) query.append("sort", params.sort);

    const qs = query.toString();
    const res = await fetch(`${API_BASE}/events${qs ? `?${qs}` : ""}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch events");
    return await res.json();
  } catch (err) {
    console.warn("API getEvents fallback:", err.message);
    return null;
  }
}

export async function getEventById(id) {
  try {
    const res = await fetch(`${API_BASE}/events/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Event not found");
    return await res.json();
  } catch (err) {
    console.warn("API getEventById fallback:", err.message);
    return null;
  }
}

export async function getEventSeats(id) {
  try {
    let res = await fetch(`${API_BASE}/bookings/events/${id}/seats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      res = await fetch(`${API_BASE}/events/${id}/seats`, {
        headers: getAuthHeaders(),
      });
    }
    if (!res.ok) throw new Error("Failed to fetch seats");
    const json = await res.json();
    return json.data || json;
  } catch (err) {
    console.warn("API getEventSeats fallback:", err.message);
    return null;
  }
}

export async function registerUser({ name, phone, email, password }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

export async function loginUser({ identifier, password }) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function googleLogin({ email, name, googleId, idToken, photoUrl }) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, googleId, idToken, photoUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Google sign-in failed");
  return data.data || data;
}

export async function resetPassword({ identifier, newPassword }) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to reset password");
  return data;
}

export async function changePassword({ currentPassword, newPassword, userId }) {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword, userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || "Failed to update password");
  return data;
}

export async function updateProfile(profileData) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update profile");
  return data;
}

export async function deleteAccount({ userId, phone, email }) {
  const res = await fetch(`${API_BASE}/auth/account`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, phone, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete account");
  return data;
}

export async function sendOtp(identifier) {
  const isEmail = String(identifier).includes("@");
  const payload = isEmail ? { email: identifier, identifier } : { phone: identifier, identifier };
  const res = await fetch(`${API_BASE}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send OTP");
  return data;
}

export async function verifyOtp(identifier, otp) {
  const isEmail = String(identifier).includes("@");
  const payload = isEmail ? { email: identifier, identifier, otp } : { phone: identifier, identifier, otp };
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid OTP");
  return data.data || data;
}

export async function initiatePayment(payload) {
  const res = await fetch(`${API_BASE}/payments/initiate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return await res.json();
}

export async function verifyPayment(payload) {
  const res = await fetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Payment verification failed");
  return data;
}

export async function getPaymentDetails(ref) {
  try {
    const res = await fetch(`${API_BASE}/payments/${ref}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

export async function createBooking(bookingPayload) {
  const res = await fetch(`${API_BASE}/bookings`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(bookingPayload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Booking failed");
  return data;
}

export async function getBookingById(bookingId) {
  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Booking not found");
    return await res.json();
  } catch (err) {
    console.warn("API getBookingById fallback:", err.message);
    return null;
  }
}

export async function getUserBookings(query = {}) {
  try {
    const q = new URLSearchParams();
    if (typeof query === "string") {
      if (query.includes("@")) q.append("email", query);
      else q.append("phone", query);
    } else if (query) {
      if (query.phone) q.append("phone", query.phone);
      if (query.email) q.append("email", query.email);
    }

    const res = await fetch(`${API_BASE}/bookings?${q.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch user bookings");
    return await res.json();
  } catch (err) {
    console.warn("API getUserBookings fallback:", err.message);
    return [];
  }
}

export async function validateTicket(identifier, staffPin = "1234") {
  const res = await fetch(`${API_BASE}/tickets/validate`, {
    method: "POST",
    headers: getAuthHeaders({ "x-staff-pin": staffPin }),
    body: JSON.stringify({ identifier, staffPin }),
  });
  return await res.json();
}

export async function scanTicket({ identifier, gateLocation = "MAIN_ENTRANCE", scannedBy = "staff_gate_01", staffPin = "1234" }) {
  const res = await fetch(`${API_BASE}/tickets/scan`, {
    method: "POST",
    headers: getAuthHeaders({ "x-staff-pin": staffPin }),
    body: JSON.stringify({ identifier, gateLocation, scannedBy, staffPin }),
  });
  return await res.json();
}

export async function getRecentTicketScans(limit = 20, staffPin = "1234") {
  try {
    const res = await fetch(`${API_BASE}/tickets/scans/recent?limit=${limit}`, {
      headers: getAuthHeaders({ "x-staff-pin": staffPin }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.warn("API getRecentTicketScans fallback:", err.message);
    return [];
  }
}

// =============================================================================
// IN-APP NOTIFICATIONS & ALERTS
// =============================================================================

export async function getNotifications(limit = 30) {
  try {
    const res = await fetch(`${API_BASE}/notifications?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { data: [], unreadCount: 0 };
    return await res.json();
  } catch (err) {
    console.warn("API getNotifications fallback:", err.message);
    return { data: [], unreadCount: 0 };
  }
}

export async function getUnreadNotificationsCount() {
  try {
    const res = await fetch(`${API_BASE}/notifications/unread-count`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.unreadCount || 0;
  } catch (_) {
    return 0;
  }
}

export async function markNotificationRead(id) {
  try {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err) {
    console.warn("API markNotificationRead fallback:", err.message);
    return null;
  }
}

export async function markAllNotificationsRead() {
  try {
    const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err) {
    console.warn("API markAllNotificationsRead fallback:", err.message);
    return null;
  }
}

// =============================================================================
// CANCELLATION & REFUNDS
// =============================================================================

export async function cancelBooking({ bookingReference, reason = "Customer requested cancellation" }) {
  const res = await fetch(`${API_BASE}/bookings/${bookingReference}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  return await res.json();
}

export async function getCancellationDetails(bookingReference) {
  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingReference}/cancellation`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("API getCancellationDetails fallback:", err.message);
    return null;
  }
}
