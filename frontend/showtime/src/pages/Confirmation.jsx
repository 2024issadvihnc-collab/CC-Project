import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { getBookingById } from "../services/api";

export default function Confirmation({ tickets = [] }) {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(() => tickets.find((t) => t.bookingId === bookingId));
  const [loading, setLoading] = useState(!booking);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (!booking && bookingId) {
      getBookingById(bookingId).then((data) => {
        if (data) setBooking(data);
        setLoading(false);
      });
    }
  }, [bookingId, booking]);

  useEffect(() => {
    if (booking) {
      // If ticket service generated official QR code data URL, prefer it directly
      if (booking.ticket?.tickets?.[0]?.qrCode) {
        setQrCodeUrl(booking.ticket.tickets[0].qrCode);
        return;
      }
      if (booking.ticket?.qrCodeData) {
        setQrCodeUrl(booking.ticket.qrCodeData);
        return;
      }

      // Secure payload: NO PII (no phone, no email, no name)
      const qrData = JSON.stringify({
        v: 1,
        app: "ShowTime",
        ref: `TKT_${booking.bookingId}_${booking.seats?.[0] || "GA"}`,
        bkg: booking.bookingId,
        seats: booking.seats,
        eventId: booking.eventId || booking.event?.id,
      });

      QRCode.toDataURL(qrData, {
        width: 140,
        margin: 1,
        color: {
          dark: "#1a1a24",
          light: "#ffffff",
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("Error generating QR code:", err));
    }
  }, [booking]);

  if (loading) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--mut)" }}>Loading your booking confirmation…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <h2>Booking not found</h2>
          <p className="muted" style={{ margin: "10px 0 20px" }}>We couldn't find a booking with ID #{bookingId}</p>
          <Link to="/" className="btn-primary" style={{ display: "inline-block" }}>← Go Home</Link>
        </div>
      </div>
    );
  }

  const { event, seats, total, paidAt, status } = booking;
  const isCancelled = status === "CANCELLED";
  const paidDate = new Date(paidAt || Date.now());
  const eventDate = new Date(event?.date || Date.now());

  return (
    <div className="confirm-page wrap pad" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
      {/* Status Badge Icon */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{
          display: "inline-flex",
          justifyContent: "center",
          alignItems: "center",
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: isCancelled ? "#fee2e2" : "#e8f8ed",
          color: isCancelled ? "#dc2626" : "#1a8d3f",
          marginBottom: 14,
        }}
      >
        {isCancelled ? (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ fontSize: "28px", fontWeight: 800, color: isCancelled ? "#dc2626" : "var(--ink2)", marginBottom: 8 }}
      >
        {isCancelled ? "Booking Cancelled" : "Booking Confirmed!"}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ color: "var(--mut)", fontSize: "14px", marginBottom: 28 }}
      >
        {isCancelled
          ? "This booking was cancelled and its tickets have been invalidated for venue security."
          : "Your tickets are confirmed. Present this mobile ticket and QR code at the venue entry."}
      </motion.p>

      {/* E-TICKET CARD */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: "spring" }}
        style={{
          textAlign: "left",
          border: "1px solid var(--line)",
          borderRadius: 16,
          boxShadow: "0 12px 36px rgba(0,0,0,0.08)",
          padding: 28,
          background: "#fff",
        }}
      >
        <div style={{ borderBottom: "1px dashed var(--line)", paddingBottom: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <small style={{ color: "var(--red)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontSize: 11 }}>
              Official E-Ticket · ShowTime
            </small>
            <span style={{ fontSize: 11, fontWeight: 700, background: "#f0f0f3", color: "var(--ink2)", padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>
              {event?.category || "EVENT"}
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 2px", color: "var(--ink2)" }}>{event?.title}</h2>
          <p style={{ color: "var(--mut)", fontSize: 13 }}>{event?.venue}, {event?.city}</p>
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px", marginBottom: 18 }}>
            <div>
              <small style={{ fontSize: 11, color: "var(--mut)", display: "block" }}>DATE</small>
              <b style={{ fontSize: 14 }}>{eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b>
            </div>
            <div>
              <small style={{ fontSize: 11, color: "var(--mut)", display: "block" }}>TIME</small>
              <b style={{ fontSize: 14 }}>{event?.time}</b>
            </div>
            <div>
              <small style={{ fontSize: 11, color: "var(--mut)", display: "block" }}>CONFIRMED SEATS</small>
              <b style={{ fontSize: 14, color: "var(--red)" }}>{seats?.join(", ")}</b>
            </div>
            <div>
              <small style={{ fontSize: 11, color: "var(--mut)", display: "block" }}>TOTAL TICKETS</small>
              <b style={{ fontSize: 14 }}>{seats?.length || booking?.tickets?.length || 1} ticket(s)</b>
            </div>
          </div>

          {/* QR CODE & TICKET ID SECTION */}
          <div style={{
            borderTop: "1px dashed var(--line)",
            borderBottom: "1px dashed var(--line)",
            padding: "16px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}>
            <div>
              <small style={{ color: "var(--mut)", fontSize: "11px", display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Ticket ID / Booking Reference
              </small>
              <div style={{ fontFamily: "Roboto Mono, monospace", fontWeight: 800, fontSize: "1.3rem", color: "var(--ink2)", letterSpacing: "1px", margin: "4px 0" }}>
                {bookingId}
              </div>
              <div style={{ fontSize: "12px", color: "var(--mut)" }}>
                Scannable digital entry pass
              </div>
            </div>

            {/* Scannable QR Code */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {isCancelled ? (
                <div style={{ width: 104, height: 104, background: "#fef2f2", border: "1px dashed #fca5a5", borderRadius: 8, display: "grid", placeItems: "center", textAlign: "center", padding: 8, color: "#dc2626" }}>
                  <b style={{ fontSize: 11, letterSpacing: 0.5 }}>INVALIDATED</b>
                  <small style={{ fontSize: 10, color: "#991b1b" }}>Refunded</small>
                </div>
              ) : qrCodeUrl ? (
                <div style={{ background: "#fff", padding: 6, borderRadius: 8, border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  <img
                    src={qrCodeUrl}
                    alt={`Scannable QR Code for Ticket ${bookingId}`}
                    style={{ width: 104, height: 104, display: "block" }}
                    id="ticket-qr-code-img"
                  />
                </div>
              ) : (
                <div style={{ width: 104, height: 104, background: "#f5f5f7", borderRadius: 8, display: "grid", placeItems: "center", fontSize: 11, color: "var(--mut)" }}>
                  Generating QR…
                </div>
              )}
              <small style={{ fontSize: 10, color: isCancelled ? "#dc2626" : "var(--mut)", marginTop: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>
                {isCancelled ? "Entry Barred" : "Scan at Entry Gate"}
              </small>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginTop: 14 }}>
            <span style={{ color: "var(--mut)" }}>Total Amount Paid</span>
            <span style={{ fontWeight: 700, color: "var(--ink2)", fontSize: "16px" }}>₹{total?.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--mut)", marginTop: 4 }}>
            Booked on {paidDate.toLocaleDateString("en-IN")} at {paidDate.toLocaleTimeString("en-IN")}
          </div>
        </div>
      </motion.div>

      {/* ACTION BUTTONS */}
      <motion.div
        style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 24 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <button
          className="btn-secondary"
          onClick={() => window.print()}
          id="download-ticket-btn"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Ticket
        </button>
        <button
          className="btn-primary"
          onClick={() => navigate("/")}
          id="back-home-btn"
        >
          Book More Events →
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        style={{ marginTop: 24, fontSize: "12px", color: "var(--mut)" }}
      >
        Instant confirmation recorded dynamically in backend server.
      </motion.p>
    </div>
  );
}
