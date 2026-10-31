import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";

export default function PaymentSimulatorModal({
  isOpen,
  onClose,
  total,
  event,
  seats,
  payMethod,
  setPayMethod,
  onConfirmPayment,
}) {
  const [stage, setStage] = useState("METHOD"); // 'METHOD' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
  const [processingStep, setProcessingStep] = useState(1);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [vpa, setVpa] = useState("user@okhdfcbank");

  // Generate simulated UPI QR code
  useEffect(() => {
    if (isOpen) {
      setStage("METHOD");
      setFailureReason("");
      const mockTxn = "TXN_SIM_" + Math.random().toString(36).slice(2, 9).toUpperCase();
      setTxnRef(mockTxn);

      const upiUri = `upi://pay?pa=showtime@icici&pn=ShowTime%20Events&am=${total}&tr=${mockTxn}&cu=INR`;
      QRCode.toDataURL(upiUri, { width: 140, margin: 1, color: { dark: "#1a1a24", light: "#ffffff" } })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  const handleSimulate = async (actionType) => {
    setStage("PROCESSING");
    setProcessingStep(1);

    // Step 1: Gateway Handshake
    await new Promise((r) => setTimeout(r, 600));
    setProcessingStep(2);

    // Step 2: 3D Secure / OTP Simulation
    await new Promise((r) => setTimeout(r, 700));
    setProcessingStep(3);

    // Step 3: Bank Response
    await new Promise((r) => setTimeout(r, 600));

    if (actionType === "DECLINE") {
      setFailureReason("Card declined by issuing bank: Insufficient funds or invalid CVV.");
      setStage("FAILED");
      return;
    }

    if (actionType === "TIMEOUT") {
      setFailureReason("Bank network timeout during authorization. Please retry.");
      setStage("FAILED");
      return;
    }

    // Success flow
    setStage("SUCCESS");
    await new Promise((r) => setTimeout(r, 800));
    onConfirmPayment({
      gatewayTransactionId: txnRef,
      paymentMethod: payMethod.toUpperCase(),
      simulateFailure: false,
    });
  };

  return (
    <motion.div
      className="modal-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ zIndex: 1000 }}
      onClick={() => {
        if (stage !== "PROCESSING") onClose();
      }}
    >
      <motion.div
        className="modal"
        initial={{ scale: 0.93, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 500,
          padding: 24,
          borderRadius: 18,
          border: "1px solid var(--line)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          position: "relative",
          background: "#fff",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>
                Simulator Mode
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red)" }}>ShowTime Pay Gateway</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink2)", margin: "4px 0 0" }}>
              Secure Payment Checkout
            </h3>
          </div>
          <div style={{ textAlign: "right" }}>
            <small style={{ fontSize: 11, color: "var(--mut)", display: "block" }}>TOTAL AMOUNT</small>
            <strong style={{ fontSize: 20, color: "var(--red)", fontWeight: 800 }}>
              ₹{total?.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* STAGE 1: PAYMENT METHOD SELECTION & SIMULATOR CONTROLS */}
        {stage === "METHOD" && (
          <div>
            {/* Method Tabs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { id: "upi", label: "UPI Apps" },
                { id: "card", label: "Cards" },
                { id: "nb", label: "NetBanking" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPayMethod(m.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    border: payMethod === m.id ? "1.5px solid var(--red)" : "1px solid var(--line)",
                    background: payMethod === m.id ? "#fff1f3" : "#fafafa",
                    color: payMethod === m.id ? "var(--red)" : "var(--ink)",
                    cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* UPI View */}
            {payMethod === "upi" && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                {qrCodeUrl && (
                  <div style={{ display: "inline-block", background: "#fff", padding: 8, borderRadius: 10, border: "1px solid var(--line)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                    <img src={qrCodeUrl} alt="UPI QR" style={{ width: 130, height: 130, display: "block" }} />
                  </div>
                )}
                <p style={{ fontSize: 12, color: "var(--mut)", marginTop: 8 }}>
                  Scan with any UPI app (GPay / PhonePe / Paytm / BHIM)
                </p>
                <div style={{ marginTop: 8 }}>
                  <input
                    value={vpa}
                    onChange={(e) => setVpa(e.target.value)}
                    placeholder="Enter UPI ID"
                    style={{ width: "80%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13, textAlign: "center" }}
                  />
                </div>
              </div>
            )}

            {/* Card View */}
            {payMethod === "card" && (
              <div style={{ background: "linear-gradient(135deg, #1f2937, #111827)", color: "#fff", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.8, textTransform: "uppercase" }}>
                  <span>Simulated Test Card</span>
                  <span style={{ fontWeight: 800 }}>VISA</span>
                </div>
                <div style={{ fontFamily: "Roboto Mono, monospace", fontSize: 16, letterSpacing: 2, margin: "14px 0" }}>
                  4111 •••• •••• 1111
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <div>
                    <small style={{ opacity: 0.6, fontSize: 10, display: "block" }}>CARD HOLDER</small>
                    <span>STUDENT DEMO</span>
                  </div>
                  <div>
                    <small style={{ opacity: 0.6, fontSize: 10, display: "block" }}>EXPIRES</small>
                    <span>12/28</span>
                  </div>
                </div>
              </div>
            )}

            {/* NetBanking View */}
            {payMethod === "nb" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"].map((b, i) => (
                  <div key={b} style={{ padding: "10px", border: i === 0 ? "1.5px solid var(--red)" : "1px solid var(--line)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: i === 0 ? "#fff1f3" : "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "var(--red)" : "#d1d5db" }} />
                    {b}
                  </div>
                ))}
              </div>
            )}

            {/* Simulated Action Triggers */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--line)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mut)", textTransform: "uppercase", marginBottom: 8 }}>
                Select Demonstration Outcome
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="btn-primary full"
                  onClick={() => handleSimulate("SUCCESS")}
                  id="btn-simulate-success"
                  style={{ padding: "12px", fontSize: 14, fontWeight: 700 }}
                >
                  ✓ Simulate Successful Payment (₹{total?.toLocaleString()})
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => handleSimulate("DECLINE")}
                    id="btn-simulate-decline"
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#dc2626",
                      padding: "8px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Simulate Bank Decline
                  </button>

                  <button
                    onClick={() => handleSimulate("TIMEOUT")}
                    id="btn-simulate-timeout"
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      color: "#b45309",
                      padding: "8px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Simulate Network Timeout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2: ANIMATED PROCESSING SCREEN */}
        {stage === "PROCESSING" && (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              style={{
                width: 52,
                height: 52,
                border: "4px solid #f3f4f6",
                borderTop: "4px solid var(--red)",
                borderRadius: "50%",
                margin: "0 auto 20px",
              }}
            />
            <h4 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>
              Contacting Banking Gateway...
            </h4>
            <div style={{ maxWidth: 300, margin: "0 auto", textAlign: "left", fontSize: 13, color: "var(--mut)" }}>
              <div style={{ color: processingStep >= 1 ? "var(--ink2)" : "var(--mut)", fontWeight: processingStep === 1 ? 700 : 400, margin: "4px 0" }}>
                {processingStep >= 1 ? "✓" : "○"} 1. Initializing secure session
              </div>
              <div style={{ color: processingStep >= 2 ? "var(--ink2)" : "var(--mut)", fontWeight: processingStep === 2 ? 700 : 400, margin: "4px 0" }}>
                {processingStep >= 2 ? "✓" : "○"} 2. Authorizing ₹{total?.toLocaleString()} with issuing bank
              </div>
              <div style={{ color: processingStep >= 3 ? "var(--ink2)" : "var(--mut)", fontWeight: processingStep === 3 ? 700 : 400, margin: "4px 0" }}>
                {processingStep >= 3 ? "✓" : "○"} 3. Awaiting cryptographic settlement
              </div>
            </div>
            <small style={{ display: "block", marginTop: 16, color: "var(--mut)", fontSize: 11 }}>
              Reference ID: {txnRef}
            </small>
          </div>
        )}

        {/* STAGE 3: SUCCESS CONFIRMATION */}
        {stage === "SUCCESS" && (
          <div style={{ textAlign: "center", padding: "26px 10px" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#e8f8ed",
                color: "#16a34a",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
                fontSize: 26,
              }}
            >
              ✓
            </div>
            <h4 style={{ fontSize: 19, fontWeight: 800, color: "var(--ink2)", marginBottom: 4 }}>
              Payment Authorized!
            </h4>
            <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 12 }}>
              INR {total?.toLocaleString()} received via {payMethod.toUpperCase()}
            </p>
            <div style={{ background: "#f8fafc", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontFamily: "Roboto Mono, monospace", color: "var(--ink2)" }}>
              Auth Ref: {txnRef}
            </div>
            <small style={{ display: "block", marginTop: 12, color: "var(--mut)", fontSize: 12 }}>
              Finalizing ticket issuance with Ticket Service...
            </small>
          </div>
        )}

        {/* STAGE 4: FAILURE SCREEN WITH SAFE RETRY */}
        {stage === "FAILED" && (
          <div style={{ textAlign: "center", padding: "20px 10px" }} id="payment-failed-view">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#fef2f2",
                color: "var(--red)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
                fontSize: 26,
              }}
            >
              ✕
            </div>
            <h4 style={{ fontSize: 18, fontWeight: 800, color: "var(--red)", marginBottom: 6 }}>
              Payment Authorization Failed
            </h4>
            <p style={{ fontSize: 13, color: "var(--ink2)", background: "#fff1f3", padding: "10px 14px", borderRadius: 8, marginBottom: 14 }}>
              {failureReason}
            </p>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 18 }}>
              Transaction Ref: <code style={{ fontFamily: "Roboto Mono, monospace" }}>{txnRef}</code>
              <br />
              <small>Your seats are still temporarily held. No amount was deducted.</small>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary full"
                onClick={() => setStage("METHOD")}
                id="btn-retry-payment"
                style={{ padding: "10px" }}
              >
                ← Retry with Another Method
              </button>
              <button
                className="btn-secondary"
                onClick={onClose}
                style={{ padding: "10px 16px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Security Note Footer */}
        <div style={{ textAlign: "center", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <small style={{ fontSize: 11, color: "var(--mut)" }}>
            🔒 256-bit SSL Encrypted Sandbox · ShowTime College Demonstration
          </small>
        </div>
      </motion.div>
    </motion.div>
  );
}

