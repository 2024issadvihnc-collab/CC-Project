import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import jsQR from "jsqr";
import { validateTicket, scanTicket, getRecentTicketScans } from "../services/api";

const GATE_LOCATIONS = ["MAIN_ENTRANCE", "VIP_GATE", "NORTH_GATE", "EAST_GATE"];

export default function TicketScanner({ user }) {
  const [staffPin, setStaffPin] = useState("1234");
  const [gateLocation, setGateLocation] = useState("MAIN_ENTRANCE");
  const [scannedBy, setScannedBy] = useState(user?.name || "Gate_Officer_01");

  // Camera & Scanning State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  // Manual Input State
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Result State
  // { status: 'ADMITTED' | 'ALREADY_USED' | 'CANCELLED' | 'INVALID', data: {...}, message: string }
  const [lastResult, setLastResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const audioContextRef = useRef(null);

  // Play audio confirmation tone
  const playBeep = (type = "success") => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch (A5)
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz (A3)
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (_) {}
  };

  // Load initial audit log
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    getRecentTicketScans(10, staffPin).then((data) => {
      if (data && data.length) setRecentScans(data);
    });
  }, [staffPin]);

  // Handle Ticket Scan Execution
  const processTicketCode = useCallback(async (code) => {
    if (!code || submitting) return;
    setSubmitting(true);

    try {
      const res = await scanTicket({
        identifier: code,
        gateLocation,
        scannedBy,
        staffPin,
      });

      if (res.success && res.data?.admitted) {
        playBeep("success");
        setLastResult({
          status: "ADMITTED",
          message: res.message || `Admitted Seat ${res.data.ticket?.seat_number}`,
          ticket: res.data.ticket,
          scannedAt: res.data.scannedAt || new Date().toISOString(),
          gate: gateLocation,
        });

        // Prepend to recent scans
        setRecentScans((prev) => [
          {
            ticket_reference: res.data.ticket?.ticket_reference || code,
            seat_number: res.data.ticket?.seat_number || "GA",
            tier: res.data.ticket?.tier || "Standard",
            scan_result: "ADMITTED",
            gate_location: gateLocation,
            scanned_at: new Date().toISOString(),
          },
          ...prev.slice(0, 14),
        ]);
      } else {
        playBeep("error");
        setLastResult({
          status: res.code || "INVALID",
          message: res.error || res.reason || "Ticket validation failed.",
          ticket: res.ticket,
          gate: gateLocation,
        });
      }
    } catch (err) {
      playBeep("error");
      setLastResult({
        status: "INVALID",
        message: err.message || "Network error connecting to Ticket Service.",
      });
    } finally {
      setSubmitting(false);
      setManualCode("");
    }
  }, [submitting, gateLocation, scannedBy, staffPin]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError("");
    setLastResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
        startScanningLoop();
      }
    } catch (err) {
      console.warn("Camera access failed:", err);
      setCameraError(
        "Camera access denied or unavailable. Please enable camera permissions or use the manual ticket code entry below."
      );
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Frame Capture & QR Decoding Loop
  const startScanningLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data && !submitting) {
        // Stop camera briefly to show result
        stopCamera();
        processTicketCode(code.data);
      }
    }, 140);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processTicketCode(manualCode.trim());
  };

  return (
    <div className="wrap pad" style={{ maxWidth: 840, margin: "0 auto" }}>
      {/* ── HEADER & STAFF CONTROLS ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", letterSpacing: 1, textTransform: "uppercase" }}>
            Event Staff Portal · ShowTime
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink2)", margin: "4px 0" }}>
            QR Ticket Scanner & Validator
          </h1>
          <p style={{ fontSize: 13, color: "var(--mut)" }}>
            High-speed gate entry verification with atomic duplicate-scan protection
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/" className="btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }}>
            ← Home
          </Link>
          <div style={{ background: "#e8f8ed", color: "#1a8d3f", padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            STAFF AUTHORIZED
          </div>
        </div>
      </div>

      {/* ── GATE & STAFF SETTINGS BAR ── */}
      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          padding: 16,
          marginBottom: 20,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
        }}
      >
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
            GATE LOCATION
          </label>
          <select
            value={gateLocation}
            onChange={(e) => setGateLocation(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
            id="scanner-gate-location"
          >
            {GATE_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
            STAFF IDENTITY
          </label>
          <input
            value={scannedBy}
            onChange={(e) => setScannedBy(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
            placeholder="Staff Name or ID"
            id="scanner-staff-name"
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
            STAFF AUTH PIN
          </label>
          <input
            type="password"
            maxLength={6}
            value={staffPin}
            onChange={(e) => setStaffPin(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 13 }}
            placeholder="PIN (Default: 1234)"
            id="scanner-staff-pin"
          />
        </div>
      </div>

      {/* ── CAMERA SCANNER VIEWFINDER ── */}
      <div
        style={{
          background: "#111827",
          borderRadius: 16,
          overflow: "hidden",
          position: "relative",
          minHeight: 320,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          marginBottom: 20,
          color: "#fff",
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: "100%",
            maxHeight: 380,
            objectFit: "cover",
            display: cameraActive ? "block" : "none",
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Camera Overlay HUD (When Active) */}
        {cameraActive && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Viewfinder Target Box */}
            <div
              style={{
                width: 220,
                height: 220,
                border: "2px solid #22c55e",
                borderRadius: 16,
                position: "relative",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
              }}
            >
              {/* Laser Scanning Line */}
              <motion.div
                animate={{ y: [0, 210, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                style={{
                  height: 2,
                  background: "#22c55e",
                  boxShadow: "0 0 10px #22c55e",
                  width: "100%",
                }}
              />
            </div>
            <p style={{ marginTop: 14, fontSize: 12, color: "#e5e7eb", background: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: 12 }}>
              Point camera at attendee's digital E-Ticket QR code
            </p>
          </div>
        )}

        {/* Viewfinder Placeholder (When Camera Off) */}
        {!cameraActive && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                color: "var(--red)",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Device Camera Ready</h3>
            <p style={{ color: "#9ca3af", fontSize: 13, maxWidth: 360, margin: "0 auto 20px" }}>
              Enable live scanning to admit guests in real time or enter ticket references manually.
            </p>
            <button
              className="btn-primary big"
              onClick={startCamera}
              id="start-camera-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Start Camera Scanner
            </button>
          </div>
        )}

        {cameraError && (
          <div style={{ margin: "0 20px 20px", background: "#fdecea", color: "var(--red)", padding: "10px 16px", borderRadius: 8, fontSize: 13 }}>
            {cameraError}
          </div>
        )}

        {/* Camera Control Footer */}
        {cameraActive && (
          <div style={{ position: "absolute", bottom: 14, zIndex: 10 }}>
            <button
              onClick={stopCamera}
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.4)",
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 12,
                cursor: "pointer",
              }}
              id="stop-camera-btn"
            >
              Stop Camera
            </button>
          </div>
        )}
      </div>

      {/* ── LIVE SCAN RESULT CARD ── */}
      <AnimatePresence>
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              padding: 20,
              borderRadius: 14,
              border: `2px solid ${
                lastResult.status === "ADMITTED"
                  ? "#22c55e"
                  : lastResult.status === "ALREADY_USED"
                  ? "#f59e0b"
                  : "var(--red)"
              }`,
              background:
                lastResult.status === "ADMITTED"
                  ? "#f0fdf4"
                  : lastResult.status === "ALREADY_USED"
                  ? "#fffbeb"
                  : "#fef2f2",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
            id="scan-result-card"
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontWeight: 800,
                    fontSize: 12,
                    textTransform: "uppercase",
                    color: "#fff",
                    background:
                      lastResult.status === "ADMITTED"
                        ? "#16a34a"
                        : lastResult.status === "ALREADY_USED"
                        ? "#d97706"
                        : "var(--red)",
                  }}
                >
                  {lastResult.status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>
                  {lastResult.message}
                </span>
              </div>

              {lastResult.ticket && (
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink)" }}>
                  <strong>Ticket:</strong> {lastResult.ticket.ticket_reference} |{" "}
                  <strong>Seat:</strong> <span style={{ color: "var(--red)", fontWeight: 700 }}>{lastResult.ticket.seat_number}</span> ({lastResult.ticket.tier || "Standard"}) |{" "}
                  <strong>Attendee:</strong> {lastResult.ticket.attendee_name || "Guest"}
                </div>
              )}
            </div>

            <button
              className="btn-primary"
              onClick={() => {
                setLastResult(null);
                if (!cameraActive) startCamera();
              }}
              style={{ fontSize: 13, padding: "8px 18px" }}
              id="scan-next-btn"
            >
              Scan Next Ticket →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MANUAL TICKET ID FALLBACK ENTRY ── */}
      <div
        className="card"
        style={{
          padding: 20,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid var(--line)",
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          Manual Ticket Reference Entry
        </h3>
        <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 14 }}>
          If the customer's phone screen is cracked or camera cannot focus, enter the Ticket Reference ID or Booking ID printed on the pass.
        </p>

        <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: 10 }}>
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. TKT_ST123456_A1 or ST123456"
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 8,
              border: "1.5px solid var(--line)",
              fontSize: 14,
              fontFamily: "Roboto Mono, monospace",
              fontWeight: 600,
            }}
            id="manual-ticket-input"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting || !manualCode.trim()}
            style={{ padding: "11px 24px" }}
            id="manual-verify-btn"
          >
            {submitting ? "Verifying…" : "Verify & Admit"}
          </button>
        </form>
      </div>

      {/* ── RECENT SCAN AUDIT TRAIL ── */}
      <div
        className="card"
        style={{
          padding: 20,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            Gate Scan Log ({recentScans.length})
          </h3>
          <span style={{ fontSize: 12, color: "var(--mut)" }}>
            Current Shift at {gateLocation}
          </span>
        </div>

        {recentScans.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--mut)", textAlign: "center", padding: "20px 0" }}>
            No scans recorded yet on this gate. Scanned admissions will appear here in real time.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
            {recentScans.map((scan, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: scan.scan_result === "ADMITTED" ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${scan.scan_result === "ADMITTED" ? "#bbf7d0" : "#fecaca"}`,
                  fontSize: 13,
                }}
              >
                <div>
                  <strong style={{ fontFamily: "Roboto Mono, monospace" }}>{scan.ticket_reference}</strong>
                  <span style={{ marginLeft: 10, color: "var(--mut)", fontSize: 12 }}>
                    Seat: <strong style={{ color: "var(--red)" }}>{scan.seat_number || "GA"}</strong> ({scan.gate_location || "GATE"})
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: scan.scan_result === "ADMITTED" ? "#16a34a" : "var(--red)",
                    }}
                  >
                    {scan.scan_result}
                  </span>
                  <small style={{ color: "var(--mut)", fontSize: 11 }}>
                    {new Date(scan.scanned_at || Date.now()).toLocaleTimeString("en-IN")}
                  </small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

