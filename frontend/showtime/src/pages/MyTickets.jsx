import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getUserBookings, cancelBooking, getCancellationDetails } from "../services/api";

export default function MyTickets({ tickets = [], user, setShowLogin }) {
  const navigate = useNavigate();
  const [allTickets, setAllTickets] = useState(tickets);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("Change of plans");
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (user?.phone || user?.email) {
      getUserBookings({ phone: user.phone, email: user.email }).then((serverBookings) => {
        if (serverBookings && serverBookings.length) {
          const combined = [...serverBookings];
          tickets.forEach((t) => {
            if (!combined.some((c) => c.bookingId === t.bookingId)) {
              combined.push(t);
            }
          });
          setAllTickets(combined);
        } else {
          setAllTickets(tickets);
        }
      });
    } else {
      setAllTickets(tickets);
    }
  }, [user, tickets]);

  async function handleOpenCancelModal(booking) {
    setSelectedBooking(booking);
    setPreviewData(null);
    setCancelError("");
    setCancelSuccess(null);
    setPreviewLoading(true);

    try {
      const res = await getCancellationDetails(booking.bookingId);
      if (res && res.data) {
        setPreviewData(res.data);
      } else {
        // Fallback preview
        const total = booking.total || 0;
        setPreviewData({
          eligible: true,
          refundPercentage: 100,
          refundAmount: total,
          cancellationFee: 0,
          tierDescription: "100% Full Refund (>48h before event)",
        });
      }
    } catch (_) {
      const total = booking.total || 0;
      setPreviewData({
        eligible: true,
        refundPercentage: 100,
        refundAmount: total,
        cancellationFee: 0,
        tierDescription: "100% Full Refund (>48h before event)",
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleConfirmCancel() {
    if (!selectedBooking) return;
    setCancelling(true);
    setCancelError("");

    try {
      const res = await cancelBooking({
        bookingReference: selectedBooking.bookingId,
        reason: cancelReason,
      });

      if (res && (res.success || res.status === "CANCELLED")) {
        setCancelSuccess(res.data || res);
        // Update local list
        setAllTickets((prev) =>
          prev.map((b) =>
            b.bookingId === selectedBooking.bookingId
              ? {
                  ...b,
                  status: "CANCELLED",
                  paymentStatus: "REFUNDED",
                  refundAmount: res.data?.refundAmount || previewData?.refundAmount,
                }
              : b
          )
        );
      } else {
        setCancelError(res?.error || "Failed to cancel booking. Please try again.");
      }
    } catch (err) {
      setCancelError(err.message || "Network error while cancelling booking.");
    } finally {
      setCancelling(false);
    }
  }

  if (!user) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f5f5f7", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--red)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2>Sign in to view your tickets</h2>
          <p style={{ color: "var(--mut)", marginBottom: 24, fontSize: 14 }}>Your booking history will appear here</p>
          <button className="btn-primary" onClick={() => setShowLogin(true)} id="signin-mytickets-btn">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-tickets wrap pad" style={{ maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20 }}>My Passes & Tickets</h1>

      {allTickets.length === 0 ? (
        <div className="empty" style={{ textAlign: "center", padding: "60px 0" }}>
          <h3 style={{ marginBottom: 6 }}>No bookings yet</h3>
          <p style={{ color: "var(--mut)", marginBottom: 20 }}>Your confirmed event tickets and passes will appear here</p>
          <button
            className="btn-primary"
            onClick={() => navigate("/")}
            id="explore-events-btn"
          >
            Explore Events →
          </button>
        </div>
      ) : (
        <div className="orders" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {allTickets.map((booking) => {
            const isCancelled = booking.status === "CANCELLED";
            return (
              <motion.div
                key={booking.bookingId}
                className="order"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: isCancelled ? "#fafafa" : "#fff",
                  borderRadius: 14,
                  padding: "18px 22px",
                  display: "flex",
                  gap: 18,
                  alignItems: "center",
                  boxShadow: isCancelled ? "none" : "0 2px 10px rgba(0,0,0,0.06)",
                  border: isCancelled ? "1px solid #e5e7eb" : "1px solid var(--line)",
                  opacity: isCancelled ? 0.8 : 1,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    background: isCancelled ? "rgba(107,114,128,0.1)" : "rgba(248,68,100,0.08)",
                    color: isCancelled ? "#6b7280" : "var(--red)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 13,
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {isCancelled ? "CAN" : booking.event?.category?.slice(0, 4) || "PASS"}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 600, color: isCancelled ? "#6b7280" : "var(--ink2)", margin: 0 }}>
                      {booking.event?.title}
                    </h3>
                    {isCancelled && (
                      <span
                        style={{
                          background: "#fee2e2",
                          color: "#dc2626",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        Cancelled · Refunded
                      </span>
                    )}
                  </div>

                  <p style={{ color: "var(--mut)", fontSize: "0.85rem", margin: "3px 0" }}>
                    {booking.event?.venue} ·{" "}
                    {booking.event?.date ? new Date(booking.event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Upcoming"} ·{" "}
                    {booking.event?.time || "Evening"}
                  </p>
                  <p style={{ fontSize: "0.82rem", fontWeight: 600, color: isCancelled ? "#9ca3af" : "var(--red)", margin: "2px 0" }}>
                    Seats: {booking.seats?.join(", ") || "General Admission"}
                  </p>
                  <p style={{ fontSize: "0.74rem", color: "var(--mut)", margin: 0 }}>Pass ID: {booking.bookingId}</p>
                </div>

                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <div style={{ fontFamily: "Roboto Mono, monospace", fontWeight: 700, fontSize: "1rem" }}>
                    ₹{Number(booking.total || 0).toLocaleString()}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {!isCancelled && (
                      <button
                        onClick={() => handleOpenCancelModal(booking)}
                        id={`cancel-btn-${booking.bookingId}`}
                        style={{
                          background: "none",
                          border: "1px solid #fecaca",
                          color: "#dc2626",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        Cancel Booking
                      </button>
                    )}

                    <Link
                      to={`/confirmation/${booking.bookingId}`}
                      className="link-btn"
                      id={`view-ticket-${booking.bookingId}`}
                      style={{
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        opacity: isCancelled ? 0.7 : 1,
                      }}
                    >
                      {isCancelled ? "View Details" : "View Pass & QR →"}
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* CANCELLATION & REFUND MODAL */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            className="modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !cancelling && setSelectedBooking(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "grid",
              placeItems: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#ffffff",
                borderRadius: 16,
                maxWidth: 480,
                width: "100%",
                padding: 24,
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              {cancelSuccess ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f8ed", color: "#16a34a", fontSize: 26, display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Booking Cancelled</h3>
                  <p style={{ color: "#4b5563", fontSize: 13, margin: "0 0 16px" }}>
                    Your refund of <strong>₹{Number(cancelSuccess.refundAmount || 0).toLocaleString()}</strong> has been initiated.
                  </p>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12, color: "#64748b", textAlign: "left" }}>
                    <div><strong>Refund Reference:</strong> {cancelSuccess.refundReference}</div>
                    <div style={{ marginTop: 4 }}><strong>Estimated Credit:</strong> 3-5 business days to original payment method</div>
                    <div style={{ marginTop: 4 }}><strong>Status:</strong> <span style={{ color: "#16a34a", fontWeight: 700 }}>PROCESSING</span></div>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => setSelectedBooking(null)}
                    style={{ width: "100%" }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#111827" }}>Cancel Booking</h3>
                    <button
                      onClick={() => setSelectedBooking(null)}
                      style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}
                    >
                      ✕
                    </button>
                  </div>

                  <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 14 }}>
                    Are you sure you want to cancel your booking for <strong>{selectedBooking.event?.title}</strong>?
                  </p>

                  {/* Policy Summary Card */}
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12 }}>
                    <strong style={{ display: "block", marginBottom: 6, color: "#1e293b" }}>Cancellation Policy:</strong>
                    <ul style={{ margin: 0, paddingLeft: 18, color: "#64748b", lineHeight: 1.5 }}>
                      <li>&gt; 48 hours before event: <strong>100% refund</strong></li>
                      <li>24 to 48 hours: <strong>75% refund</strong></li>
                      <li>4 to 24 hours: <strong>50% refund</strong></li>
                      <li>&lt; 4 hours: Non-refundable</li>
                    </ul>
                  </div>

                  {/* Estimated Refund Breakdown */}
                  {previewLoading ? (
                    <div style={{ padding: "12px 0", textAlign: "center", fontSize: 13, color: "#6b7280" }}>
                      Calculating refund eligibility…
                    </div>
                  ) : previewData ? (
                    <div style={{ background: previewData.eligible ? "#f0fdf4" : "#fef2f2", border: `1px solid ${previewData.eligible ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#4b5563" }}>Total Paid:</span>
                        <strong>₹{Number(selectedBooking.total || 0).toLocaleString()}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#4b5563" }}>Cancellation Fee:</span>
                        <span style={{ color: "#dc2626" }}>- ₹{Number(previewData.cancellationFee || 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px dashed rgba(0,0,0,0.1)", fontWeight: 700 }}>
                        <span style={{ color: previewData.eligible ? "#16a34a" : "#dc2626" }}>Refund Amount ({previewData.refundPercentage}%):</span>
                        <strong style={{ color: previewData.eligible ? "#16a34a" : "#dc2626", fontSize: 15 }}>₹{Number(previewData.refundAmount || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                  ) : null}

                  {/* Reason Selection */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                      Reason for cancellation:
                    </label>
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 6,
                        border: "1px solid #d1d5db",
                        fontSize: 13,
                        background: "#fff",
                      }}
                    >
                      <option value="Change of plans">Change of plans</option>
                      <option value="Emergency or illness">Emergency or illness</option>
                      <option value="Booked wrong date/seats">Booked wrong date/seats</option>
                      <option value="Found alternative event">Found alternative event</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {cancelError && (
                    <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                      ⚠️ {cancelError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setSelectedBooking(null)}
                      disabled={cancelling}
                      style={{
                        background: "#f3f4f6",
                        border: "none",
                        color: "#374151",
                        padding: "10px 18px",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Keep Booking
                    </button>
                    <button
                      onClick={handleConfirmCancel}
                      disabled={cancelling || (previewData && !previewData.eligible)}
                      id="confirm-cancellation-btn"
                      style={{
                        background: previewData && !previewData.eligible ? "#9ca3af" : "#dc2626",
                        border: "none",
                        color: "#fff",
                        padding: "10px 20px",
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: previewData && !previewData.eligible ? "not-allowed" : "pointer",
                      }}
                    >
                      {cancelling ? "Processing..." : "Confirm Cancellation"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
