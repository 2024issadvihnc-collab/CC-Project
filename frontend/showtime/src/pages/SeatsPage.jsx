import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { getEventById as localGetEventById } from "../data/events";
import { getEventById as apiGetEventById, getEventSeats } from "../services/api";

const TIERS = [
  { id: "recliner", name: "VIP Lounge", mult: 3.5, rows: ["A", "B"], cols: 12, aisles: [3, 8], cls: "recliner" },
  { id: "prime", name: "Premium Tier", mult: 2.0, rows: ["C", "D", "E"], cols: 16, aisles: [3, 12], cls: "prime" },
  { id: "classic", name: "Standard Tier", mult: 1.0, rows: ["F", "G", "H", "J"], cols: 18, aisles: [4, 13], cls: "" },
];

const HOLD_DURATION_SECONDS = 120; // 2-minute temporary hold

export default function SeatsPage({ user, setShowLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(() => localGetEventById(id));
  const [apiSoldSeats, setApiSoldSeats] = useState(null);

  const [maxQty, setMaxQty] = useState(2);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selected, setSelected] = useState([]);
  const [hoverTip, setHoverTip] = useState(null);

  // Real-time Socket.IO state
  const [socketConnected, setSocketConnected] = useState(false);
  const [heldByOthers, setHeldByOthers] = useState(new Map()); // seatId -> { expiresAt, lockedBy }
  const [holdTimerSeconds, setHoldTimerSeconds] = useState(HOLD_DURATION_SECONDS);
  const [conflictMessage, setConflictMessage] = useState("");
  const socketRef = useRef(null);

  const fetchAuthoritativeSeats = () => {
    getEventSeats(id).then((seatData) => {
      if (seatData) {
        const booked = seatData.bookedSeats || seatData.soldSeats || [];
        setApiSoldSeats(new Set(booked));
      }
    });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    apiGetEventById(id).then((data) => {
      if (data) setEvent(data);
    });

    fetchAuthoritativeSeats();

    // ── Socket.IO Connection ──
    const socketBase = import.meta.env.VITE_WS_URL || window.location.origin.replace(":5173", ":5000");
    const socket = io(socketBase, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: {
        token: user?.token,
        userId: user?.id || (user?.phone ? `usr_${user.phone.replace(/\D/g, "").slice(-4)}` : undefined),
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      console.log("[Socket.IO] Connected to Real-time Gateway, joining event:", id);
      socket.emit("join:event", { eventId: id });
      // Re-fetch authoritative seat availability on reconnect
      fetchAuthoritativeSeats();
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      console.log("[Socket.IO] Disconnected from Real-time Gateway");
    });

    // Initial snapshot of active holds
    socket.on("event:seat_snapshot", ({ heldSeats }) => {
      if (Array.isArray(heldSeats)) {
        const others = new Map();
        heldSeats.forEach((h) => {
          if (!h.isMine) {
            others.set(h.seatId, { expiresAt: h.expiresAt, lockedBy: h.lockedBy });
          }
        });
        setHeldByOthers(others);
      }
    });

    // Seat held by another user
    socket.on("seat:held", ({ seatId, lockedBy, expiresAt }) => {
      const myId = user?.id || (user?.phone ? `usr_${user.phone.replace(/\D/g, "").slice(-4)}` : `client_${socket.id?.slice(0, 8)}`);
      if (lockedBy !== myId) {
        setHeldByOthers((prev) => {
          const next = new Map(prev);
          next.set(seatId, { expiresAt, lockedBy });
          return next;
        });
        // Deselect if currently selected by me
        setSelected((prev) => prev.filter((k) => k.split(":")[1] !== seatId));
      }
    });

    // Seat released (either manually or lock expired)
    socket.on("seat:released", ({ seatId, seats }) => {
      const targetSeats = Array.isArray(seats) ? seats : [seatId].filter(Boolean);
      setHeldByOthers((prev) => {
        const next = new Map(prev);
        targetSeats.forEach((s) => next.delete(s));
        return next;
      });
    });

    // Permanent booking confirmed via Saga
    socket.on("seat:booked", ({ seats }) => {
      if (Array.isArray(seats)) {
        setApiSoldSeats((prev) => {
          const next = new Set(prev || []);
          seats.forEach((s) => {
            next.add(s);
            TIERS.forEach((t) => next.add(`${t.id}:${s}`));
          });
          return next;
        });
        setHeldByOthers((prev) => {
          const next = new Map(prev);
          seats.forEach((s) => next.delete(s));
          return next;
        });
        setSelected((prev) => prev.filter((k) => !seats.includes(k.split(":")[1])));
      }
    });

    socket.on("seat:lock_failed", ({ seatId, reason }) => {
      setConflictMessage(`Seat ${seatId} was just reserved by another customer.`);
      setTimeout(() => setConflictMessage(""), 4500);
    });

    return () => {
      if (socket.connected) {
        socket.emit("leave:event", { eventId: id });
        socket.disconnect();
      }
    };
  }, [id, user]);

  // Countdown timer for held seats
  useEffect(() => {
    if (selected.length === 0) {
      setHoldTimerSeconds(HOLD_DURATION_SECONDS);
      return;
    }

    const interval = setInterval(() => {
      setHoldTimerSeconds((prev) => {
        if (prev <= 1) {
          // Hold expired
          selected.forEach((key) => {
            const seatId = key.split(":")[1];
            socketRef.current?.emit("seat:release", { eventId: id, seatId });
          });
          setSelected([]);
          setConflictMessage("Your temporary seat hold has expired. Please select seats again.");
          setTimeout(() => setConflictMessage(""), 5000);
          return HOLD_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selected, id]);

  // Deterministic sold seats based on event filled percentage + API dynamically booked seats
  const soldSeats = useMemo(() => {
    const set = new Set();
    if (apiSoldSeats) {
      apiSoldSeats.forEach((s) => {
        set.add(s);
        TIERS.forEach((t) => set.add(`${t.id}:${s}`));
      });
    }

    if (!event) return set;
    const filled = event.filledPct || 0.6;
    TIERS.forEach((tier) => {
      tier.rows.forEach((r) => {
        for (let c = 1; c <= tier.cols; c++) {
          const hash = ((r.charCodeAt(0) * 31 + c * 17 + event.price) % 100) / 100;
          if (hash < filled) {
            set.add(`${tier.id}:${r}${c}`);
            set.add(`${r}${c}`);
          }
        }
      });
    });
    return set;
  }, [event?.id, event?.filledPct, apiSoldSeats]);

  if (!event) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <h2>Event not found</h2>
          <button className="btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const dateStr = new Date(event.date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const toggleSeat = (tier, seatId) => {
    const key = `${tier.id}:${seatId}`;
    const isSold = soldSeats.has(key) || soldSeats.has(seatId);
    const isHeldByOther = heldByOthers.has(seatId);

    if (isSold || isHeldByOther) return;

    if (selected.includes(key)) {
      // Deselect and release lock
      setSelected((prev) => prev.filter((k) => k !== key));
      if (socketRef.current?.connected) {
        socketRef.current.emit("seat:release", { eventId: id, seatId });
      }
    } else {
      // Hold and select
      let nextSelected = [];
      if (selected.length >= maxQty) {
        // Release oldest seat
        const oldestKey = selected[0];
        const oldestSeatId = oldestKey.split(":")[1];
        if (socketRef.current?.connected) {
          socketRef.current.emit("seat:release", { eventId: id, seatId: oldestSeatId });
        }
        nextSelected = [...selected.slice(1), key];
      } else {
        nextSelected = [...selected, key];
      }

      setSelected(nextSelected);
      setHoldTimerSeconds(HOLD_DURATION_SECONDS);

      // Acquire distributed lock via Socket.IO
      if (socketRef.current?.connected) {
        socketRef.current.emit("seat:hold", { eventId: id, seatId, durationSeconds: HOLD_DURATION_SECONDS }, (ack) => {
          if (ack && !ack.success) {
            setConflictMessage(ack.reason || `Seat ${seatId} could not be reserved.`);
            setSelected((prev) => prev.filter((k) => k !== key));
            setTimeout(() => setConflictMessage(""), 4000);
          }
        });
      }
    }
  };

  const totalPrice = selected.reduce((sum, key) => {
    const [tierId] = key.split(":");
    const tier = TIERS.find((t) => t.id === tierId);
    return sum + event.price * (tier?.mult || 1);
  }, 0);

  const selectedLabels = selected.map((key) => key.split(":")[1]);

  const proceed = () => {
    if (!user) {
      if (setShowLogin) setShowLogin(true);
      return;
    }
    const tickets = selected.map((key) => {
      const [tierId, seatId] = key.split(":");
      const tier = TIERS.find((t) => t.id === tierId);
      return {
        seatId,
        tierLabel: tier.name,
        price: Math.round(event.price * tier.mult),
      };
    });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    navigate(`/checkout/${event.id}`, { state: { tickets, event } });
  };

  const minutes = Math.floor(holdTimerSeconds / 60);
  const seconds = holdTimerSeconds % 60;
  const timerFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <main className="seat-pg">
      {/* ── TOP BAR ── */}
      <section className="seat-top">
        <button className="back" onClick={() => navigate(-1)} aria-label="Go back">
          ‹
        </button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2>{event.title}</h2>
            {/* Live Socket.IO Status Badge */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: socketConnected ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
                color: socketConnected ? "#16a34a" : "#dc2626",
                padding: "2px 8px",
                borderRadius: 12,
              }}
              title={socketConnected ? "Real-time seat availability connected via Socket.IO" : "Reconnecting to live seat updates..."}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: socketConnected ? "#16a34a" : "#dc2626" }} />
              {socketConnected ? "Live Updates" : "Connecting..."}
            </span>
          </div>
          <p>
            {event.venue}, {event.city} | {dateStr}, {event.time} · {event.category.toUpperCase()}
          </p>
        </div>
        <button
          className="qty-chip"
          onClick={() => setShowQtyModal(true)}
          id="seat-qty-btn"
          title="Change number of tickets"
        >
          {maxQty} {maxQty === 1 ? "Ticket" : "Tickets"} ▾
        </button>
      </section>

      {/* Conflict Toast Notification */}
      <AnimatePresence>
        {conflictMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              padding: "10px 18px",
              borderRadius: 8,
              maxWidth: 500,
              margin: "12px auto 0",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            ⚠️ {conflictMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEAT MAP ── */}
      <div className="seat-scroll">
        <div className="seat-map">
          {TIERS.map((tier) => (
            <div className="tier" key={tier.id}>
              <div className="tier-name">
                ₹{Math.round(event.price * tier.mult).toLocaleString()} {tier.name}
              </div>

              {tier.rows.map((rowLetter) => (
                <div className="seat-row" key={rowLetter}>
                  <span className="row-l">{rowLetter}</span>
                  {Array.from({ length: tier.cols }, (_, ci) => {
                    const seatNum = ci + 1;
                    const seatId = `${rowLetter}${seatNum}`;
                    const key = `${tier.id}:${seatId}`;
                    const isSold = soldSeats.has(key) || soldSeats.has(seatId);
                    const isSel = selected.includes(key);
                    const isHeldOther = heldByOthers.has(seatId);

                    let seatClass = `seat ${tier.cls}`;
                    if (isSold) seatClass += " sold";
                    else if (isSel) seatClass += " sel";
                    else if (isHeldOther) seatClass += " held";

                    return (
                      <span
                        key={seatId}
                        className="seat-cell"
                        style={{ marginRight: tier.aisles?.includes(ci) ? 24 : 0 }}
                      >
                        <motion.button
                          className={seatClass}
                          disabled={isSold || isHeldOther}
                          whileHover={!isSold && !isHeldOther ? { scale: 1.2 } : {}}
                          whileTap={!isSold && !isHeldOther ? { scale: 0.9 } : {}}
                          animate={isSel ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                          onClick={() => toggleSeat(tier, seatId)}
                          onMouseEnter={() =>
                            setHoverTip({
                              id: seatId,
                              price: event.price * tier.mult,
                              tier: tier.name,
                              isHeld: isHeldOther,
                              isSold,
                            })
                          }
                          onMouseLeave={() => setHoverTip(null)}
                          aria-label={`Seat ${seatId}`}
                          id={`seat-${seatId}`}
                          style={
                            isHeldOther
                              ? {
                                  background: "#fef3c7",
                                  borderColor: "#f59e0b",
                                  color: "#b45309",
                                  cursor: "not-allowed",
                                }
                              : {}
                          }
                        >
                          {seatNum}
                        </motion.button>

                        {hoverTip?.id === seatId && (
                          <em className="seat-tip">
                            {isSold
                              ? `${seatId} · Sold Out`
                              : isHeldOther
                              ? `${seatId} · Held by another user`
                              : `${seatId} · ₹${Math.round(hoverTip.price).toLocaleString()}`}
                          </em>
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          {/* ── STAGE / SCREEN CURVE VISUAL ── */}
          <div className="screen-wrap">
            <svg viewBox="0 0 400 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f84464" stopOpacity=".7" />
                  <stop offset="1" stopColor="#f84464" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M10 50 Q200 -5 390 50 L390 60 Q200 12 10 60Z" fill="url(#scr)" />
              <path d="M10 52 Q200 -3 390 52" stroke="var(--red)" strokeWidth="3" fill="none" />
            </svg>
            <p>STAGE / PERFORMANCE AREA THIS WAY</p>
          </div>

          {/* ── 4-STATE SEAT LEGEND ── */}
          <div className="seat-legend" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
            <span>
              <i className="seat" style={{ verticalAlign: "middle" }} /> Available
            </span>
            <span>
              <i className="seat sel" style={{ verticalAlign: "middle" }} /> Selected (You)
            </span>
            <span>
              <i
                className="seat held"
                style={{
                  verticalAlign: "middle",
                  background: "#fef3c7",
                  borderColor: "#f59e0b",
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                }}
              />{" "}
              Temporarily Held
            </span>
            <span>
              <i className="seat sold" style={{ verticalAlign: "middle" }} /> Sold Out
            </span>
          </div>
        </div>
      </div>

      {/* ── FLOATING PAYMENT & HOLD TIMER BAR ── */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            className="pay-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <small style={{ color: "var(--ink2)", fontWeight: 700 }}>
                  {selected.length} {selected.length > 1 ? "Seats" : "Seat"}: {selectedLabels.join(", ")}
                </small>
                {/* Hold Countdown Timer */}
                <span
                  style={{
                    background: holdTimerSeconds < 30 ? "#fee2e2" : "#fef3c7",
                    color: holdTimerSeconds < 30 ? "#dc2626" : "#b45309",
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}
                  title="Your seats are temporarily locked for checkout"
                >
                  ⏱️ Hold: {timerFormatted}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 2 }}>
                Total Payable: <strong style={{ color: "var(--red)", fontSize: 18 }}>₹{Math.round(totalPrice).toLocaleString()}</strong>
              </div>
            </div>

            <div className="pb-actions">
              <button
                className="btn-primary big"
                onClick={proceed}
                id="proceed-pay-btn"
              >
                Proceed to Checkout →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HOW MANY SEATS MODAL ── */}
      <AnimatePresence>
        {showQtyModal && (
          <motion.div
            className="modal-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQtyModal(false)}
          >
            <motion.div
              className="modal qty"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>How Many Seats?</h3>
              <div className="veh" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "var(--red)" }}>
                SELECT QUANTITY
              </div>
              <div className="qty-row">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((q) => (
                  <button
                    key={q}
                    className={maxQty === q ? "on" : ""}
                    onClick={() => {
                      setMaxQty(q);
                      if (selected.length > q) setSelected(selected.slice(0, q));
                      setShowQtyModal(false);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div className="qty-prices">
                {TIERS.map((t) => (
                  <div key={t.id}>
                    <small>{t.name}</small>
                    <b>₹{Math.round(event.price * t.mult)}</b>
                  </div>
                ))}
              </div>
              <button
                className="btn-primary"
                onClick={() => setShowQtyModal(false)}
                style={{ width: "100%", padding: "12px" }}
              >
                Select Seats
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
