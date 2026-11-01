import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getEventById as localGetEventById } from "../data/events";
import { createBooking } from "../services/api";

const PAY_OPTS = [
  { id: "upi", tag: "UPI", label: "UPI", sub: "GPay, PhonePe, Paytm" },
  { id: "card", tag: "CARD", label: "Credit / Debit Card", sub: "Visa, Mastercard, Rupay" },
  { id: "nb", tag: "NET", label: "Net Banking", sub: "All major banks" },
  { id: "wallet", tag: "WALLET", label: "Mobile Wallets", sub: "Paytm, Amazon Pay" },
];

const VALID_COUPONS = {
  SHOW20: 0.20, MUSIC50: 50, SPORT10: 0.10, DILJIT: 0.15,
};

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;

function isValidEmail(val) {
  return typeof val === "string" && EMAIL_REGEX.test(val.trim());
}

function isValidUpi(val) {
  return typeof val === "string" && UPI_REGEX.test(val.trim());
}

export default function Checkout({ user, setShowLogin, addTicket }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const event = location.state?.event || localGetEventById(id);
  const tickets = location.state?.tickets || [];

  const [payMethod, setPayMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState("");
  const [name, setName] = useState(user?.name || user?.fullName || (user?.email ? user.email.split("@")[0] : null) || user?.phone || "Guest Customer");
  const [email, setEmail] = useState(user?.email || "");
  const [touched, setTouched] = useState({ email: false, upi: false, name: false });
  const [formError, setFormError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10 * 60);

  const isEmailValid = isValidEmail(email);
  const isUpiValid = isValidUpi(upiId);
  const canSubmit = name.trim().length > 0 && isEmailValid && (payMethod !== "upi" || isUpiValid);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const t = setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!event || tickets.length === 0) {
    return (
      <div className="wrap pad center">
        <h2>Nothing to checkout</h2>
        <button className="btn-primary" onClick={() => navigate("/")} style={{ marginTop: 20 }}>← Go Home</button>
      </div>
    );
  }

  const subtotal = tickets.reduce((s, t) => s + t.price, 0);
  const convFee = Math.round(subtotal * 0.03);
  const discountAmt = discount > 1 ? discount : Math.round(subtotal * discount);
  const total = subtotal + convFee - discountAmt;

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  const applyCoupon = () => {
    const val = VALID_COUPONS[coupon.toUpperCase()];
    if (!val) { setCouponMsg("Invalid coupon code"); setDiscount(0); return; }
    setDiscount(val);
    setCouponMsg("Coupon applied successfully!");
  };

  const handleInitiatePayment = async () => {
    if (!user) {
      if (setShowLogin) setShowLogin(true);
      return;
    }

    setTouched({ email: true, upi: true, name: true });

    if (!name.trim()) {
      setFormError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setFormError("Email address is compulsory for sending your digital tickets.");
      return;
    }

    if (!isValidEmail(email)) {
      setFormError("Please enter a valid email address format (e.g. name@example.com).");
      return;
    }

    if (payMethod === "upi") {
      if (!upiId.trim()) {
        setFormError("UPI ID is compulsory for UPI payments.");
        return;
      }
      if (!isValidUpi(upiId)) {
        setFormError("Please enter a correct UPI ID (e.g. username@okhdfcbank or 9876543210@paytm).");
        return;
      }
    }

    setFormError("");
    setProcessing(true);

    const payload = {
      eventId: event.id,
      event,
      tickets,
      seats: tickets.map((t) => t.seatId),
      total: Math.round(total),
      paymentMethod: payMethod === "upi" ? `UPI (${upiId.trim()})` : payMethod.toUpperCase(),
      gatewayTransactionId: "TXN_" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      coupon: discount > 0 ? coupon : null,
      user: { id: user?.id, name, email: email.trim(), phone: user?.phone || "Guest" },
    };

    try {
      const res = await createBooking(payload);
      const confirmedBooking = res.booking || {
        bookingId: res.bookingId || "ST" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        ...payload,
        paidAt: new Date().toISOString(),
      };
      addTicket(confirmedBooking);
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        navigate(`/confirmation/${confirmedBooking.bookingId}`);
      }, 1000);
    } catch (err) {
      setProcessing(false);
      setFormError(err.message || "Booking failed. The selected seats may already be reserved. Please try again.");
    }
  };

  if (processing) {
    return (
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ width: 48, height: 48, border: "3px solid var(--line)", borderTop: "3px solid var(--red)", borderRadius: "50%" }}
        />
        <h3 style={{ color: "var(--ink2)" }}>Processing payment…</h3>
        <p style={{ color: "var(--mut)", fontSize: "0.85rem" }}>Securing your seats and generating tickets</p>
      </div>
    );
  }

  return (
    <div className="checkout wrap pad">
      <button className="link-btn" onClick={() => navigate(-1)} style={{ marginBottom: 16, display: "inline-block" }}>
        ← Back to Seats
      </button>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: 12 }}>Review Your Booking</h1>
      <div className="timer-chip" id="checkout-timer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#e8f8ed", color: "#1a8d3f", padding: "6px 14px", borderRadius: "20px", fontWeight: 600, fontSize: "13px", marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Completes in {mins}:{secs}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "28px" }} className="co-grid">
        {/* LEFT */}
        <div>
          {/* Contact */}
          <div className="card">
            <h3>Contact Details</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--mut)", display: "block", marginBottom: 6 }}>
                Full Name <span style={{ color: "var(--red)", fontWeight: 700 }}>*</span>
              </label>
              <input
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                placeholder="Your name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError("");
                }}
                id="contact-name"
                required
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <label style={{ fontSize: 13, color: "var(--mut)", display: "block" }}>
                  Email Address <span style={{ color: "var(--red)", fontWeight: 700 }}>* (Compulsory)</span>
                </label>
                {touched.email && isEmailValid && (
                  <span style={{ fontSize: 11, color: "var(--green, #16a34a)", fontWeight: 700 }}>✓ Valid Email</span>
                )}
              </div>
              <input
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: `1.5px solid ${touched.email && !isEmailValid ? "var(--red)" : "var(--line)"}`,
                  borderRadius: 8,
                  background: touched.email && !isEmailValid ? "#fff5f5" : "#fff",
                }}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formError) setFormError("");
                }}
                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                id="contact-email"
                required
              />
              {touched.email && !isEmailValid && (
                <small style={{ color: "var(--red)", fontSize: 11, marginTop: 4, display: "block", fontWeight: 600 }}>
                  {!email.trim()
                    ? "⚠️ Email address is compulsory to receive tickets & QR pass."
                    : "⚠️ Please enter a correct email address format (e.g. name@example.com)."}
                </small>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="card">
            <h3>Payment Options</h3>
            <div className="pay-methods">
              {PAY_OPTS.map((opt) => (
                <div
                  key={opt.id}
                  className={`pm${payMethod === opt.id ? " on" : ""}`}
                  onClick={() => setPayMethod(opt.id)}
                  id={`pay-opt-${opt.id}`}
                  style={{ cursor: "pointer" }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, background: "#f0f0f3", color: "var(--ink2)", padding: "4px 8px", borderRadius: 4 }}>
                    {opt.tag}
                  </span>
                  <div>
                    <b>{opt.label}</b>
                    <small>{opt.sub}</small>
                  </div>
                  <i />
                </div>
              ))}
            </div>

            {payMethod === "card" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }} placeholder="Card number" id="card-number" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }} placeholder="MM / YY" id="card-expiry" />
                  <input style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }} type="password" placeholder="CVV" maxLength={4} id="card-cvv" />
                </div>
              </motion.div>
            )}

            {payMethod === "upi" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ marginTop: 16 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, color: "var(--mut)", display: "block" }}>
                    UPI ID / VPA <span style={{ color: "var(--red)", fontWeight: 700 }}>* (Compulsory)</span>
                  </label>
                  {isUpiValid && (
                    <span style={{ fontSize: 11, color: "var(--green, #16a34a)", fontWeight: 700 }}>✓ Correct UPI ID</span>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: `1.5px solid ${touched.upi && !isUpiValid ? "var(--red)" : "var(--line)"}`,
                      borderRadius: 8,
                      background: touched.upi && !isUpiValid ? "#fff5f5" : "#fff",
                      fontSize: 14,
                    }}
                    placeholder="e.g. username@okhdfcbank or 9876543210@paytm"
                    value={upiId}
                    onChange={(e) => {
                      setUpiId(e.target.value);
                      if (formError) setFormError("");
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, upi: true }))}
                    id="upi-id"
                    required
                  />
                </div>
                {touched.upi && !isUpiValid && (
                  <small style={{ color: "var(--red)", fontSize: 11, marginTop: 4, display: "block", fontWeight: 600 }}>
                    {!upiId.trim()
                      ? "⚠️ Entering a correct UPI ID is compulsory for UPI payments."
                      : "⚠️ Incorrect UPI ID format. Must include username and bank handle (e.g. name@okaxis or 9876543210@paytm)."}
                  </small>
                )}
                {/* Popular Bank Handles quick-fill */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--mut)" }}>Fast select:</span>
                  {["@okaxis", "@okhdfcbank", "@paytm", "@ybl", "@ibl"].map((handle) => (
                    <button
                      key={handle}
                      type="button"
                      onClick={() => {
                        const prefix = upiId.includes("@") ? upiId.split("@")[0] : upiId;
                        const newId = (prefix || "user") + handle;
                        setUpiId(newId);
                        setTouched((p) => ({ ...p, upi: true }));
                        if (formError) setFormError("");
                      }}
                      style={{
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: "#374151",
                        cursor: "pointer",
                      }}
                    >
                      {handle}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* RIGHT – SUMMARY */}
        <div>
          <div className="summary">
            <h3 style={{ fontSize: 17, marginBottom: 14 }}>Order Summary</h3>

            <div className="sum-top">
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(248,68,100,0.1)", color: "var(--red)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, textTransform: "uppercase" }}>
                {event.category.slice(0, 3)}
              </div>
              <div>
                <b>{event.title}</b>
                <p>
                  {new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {event.time}
                </p>
                <small>{event.venue}, {event.city}</small>
              </div>
            </div>

            <div className="sum-seats">
              <b>Selected Seats:</b> {tickets.map((t) => t.seatId).join(", ")}
            </div>

            <div className="sum-lines">
              <p>
                <span>{tickets.length} ticket{tickets.length > 1 ? "s" : ""}</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </p>
              <p>
                <span>Convenience fee (3%)</span>
                <span>₹{convFee.toLocaleString()}</span>
              </p>
              {discountAmt > 0 && (
                <p className="disc">
                  <span>Coupon discount</span>
                  <b>− ₹{discountAmt.toLocaleString()}</b>
                </p>
              )}
            </div>

            <div className="sum-total">
              <span>Amount Payable</span>
              <b>₹{Math.round(total).toLocaleString()}</b>
            </div>

            {/* Coupon */}
            <div className="coupon" style={{ marginTop: 16 }}>
              <input
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6 }}
                placeholder="Coupon code (e.g. SHOW20)"
                value={coupon}
                onChange={(e) => { setCoupon(e.target.value); setCouponMsg(""); }}
                id="coupon-input"
              />
              <button className="btn-primary sm" onClick={applyCoupon} id="apply-coupon-btn">Apply</button>
            </div>
            {couponMsg && (
              <p style={{ fontSize: "12px", color: couponMsg.includes("successfully") ? "var(--green)" : "var(--red)", marginBottom: 12 }}>
                {couponMsg}
              </p>
            )}

            {formError && (
              <div
                style={{
                  background: "#fee2e2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "9px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  marginTop: 12,
                  marginBottom: 6,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                ⚠️ {formError}
              </div>
            )}

            <button
              className="btn-primary full big"
              onClick={handleInitiatePayment}
              disabled={!canSubmit}
              id="pay-now-btn"
              style={{
                marginTop: 10,
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
              title={!canSubmit ? "Please enter a valid email and correct UPI ID to proceed" : "Click to complete payment"}
            >
              Pay ₹{Math.round(total).toLocaleString()}
            </button>
            <p className="cancel-note">
              100% Safe & Secure Payment · Instant E-Ticket Confirmation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
