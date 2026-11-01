import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { getEventById as localGetEventById } from "../data/events";
import { getEventById as apiGetEventById, getEventSeats } from "../services/api";

// ── CINEMA / MOVIE TIERS ──
const CINEMA_TIERS = [
  { id: "recliner", name: "VIP Recliner", mult: 3.5, rows: ["A", "B"], cols: 12, aisles: [3, 8], cls: "recliner" },
  { id: "prime", name: "Prime", mult: 2.0, rows: ["C", "D", "E"], cols: 16, aisles: [3, 12], cls: "prime" },
  { id: "classic", name: "Classic", mult: 1.0, rows: ["F", "G", "H", "J"], cols: 18, aisles: [4, 13], cls: "" },
];

// ── CRICKET STADIUM STANDS ──
const CRICKET_STANDS = [
  { id: "north", name: "North Stand", mult: 2.0, rows: ["A", "B", "C"], cols: 16, aisles: [4, 11] },
  { id: "pavilion", name: "Pavilion VIP", mult: 3.5, rows: ["A", "B"], cols: 14, aisles: [4, 9] },
  { id: "east", name: "East Stand", mult: 1.5, rows: ["A", "B", "C"], cols: 16, aisles: [4, 11] },
  { id: "west", name: "West Stand", mult: 1.2, rows: ["A", "B", "C"], cols: 16, aisles: [4, 11] },
  { id: "south", name: "South Stand", mult: 1.0, rows: ["A", "B", "C", "D"], cols: 18, aisles: [4, 13] },
];

// ── CONCERT / MUSIC PASSES ──
const CONCERT_PASSES = [
  { id: "fan_pit", name: "Fan Pit", sub: "Standing area near stage", mult: 3.5, prefix: "PIT" },
  { id: "vip_deck", name: "VIP Deck", sub: "Elevated viewing deck", mult: 2.5, prefix: "VIP" },
  { id: "gold_standing", name: "Gold Zone", sub: "Center arena standing", mult: 1.6, prefix: "GLD" },
  { id: "silver_ga", name: "General Admission", sub: "Open ground entry", mult: 1.0, prefix: "GA" },
];

export default function SeatsPage({ user, setShowLogin }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(() => localGetEventById(id));
  const [apiSoldSeats, setApiSoldSeats] = useState(null);

  const [maxQty, setMaxQty] = useState(2);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selected, setSelected] = useState([]);
  const [hoverTip, setHoverTip] = useState(null);

  // Cricket stand tab
  const [activeStandId, setActiveStandId] = useState("north");

  // Concert pass counts: { [passId]: number }
  const [passCounts, setPassCounts] = useState({});

  // Real-time socket state
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const category = (event?.category || "").toLowerCase();
  const isConcert = category === "music" || category === "festival" || category === "dj";
  const isCricket = category === "cricket" || category === "sports";

  const fetchSeats = () => {
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

    fetchSeats();
    const timer = setInterval(fetchSeats, 15000);

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
      socket.emit("join:event", { eventId: id });
      fetchSeats();
    });

    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("seat:booked", ({ seats }) => {
      if (Array.isArray(seats)) {
        setApiSoldSeats((prev) => {
          const next = new Set(prev || []);
          seats.forEach((s) => next.add(s));
          return next;
        });
        setSelected((prev) => prev.filter((k) => !seats.includes(k.split(":")[1])));
      }
    });

    socket.on("event:seats_updated", ({ bookedSeats }) => {
      if (Array.isArray(bookedSeats)) setApiSoldSeats(new Set(bookedSeats));
    });

    return () => {
      clearInterval(timer);
      if (socket.connected) {
        socket.emit("leave:event", { eventId: id });
        socket.disconnect();
      }
    };
  }, [id, user]);

  const soldSeats = useMemo(() => {
    const set = new Set();
    if (apiSoldSeats) {
      apiSoldSeats.forEach((s) => set.add(s));
    }
    if (!event) return set;
    const filled = event.filledPct || 0.6;

    if (isCricket) {
      CRICKET_STANDS.forEach((stand) => {
        stand.rows.forEach((r) => {
          for (let c = 1; c <= stand.cols; c++) {
            const hash = ((r.charCodeAt(0) * 31 + c * 17 + event.price) % 100) / 100;
            if (hash < filled) {
              set.add(`${stand.id}:${r}${c}`);
              set.add(`${r}${c}`);
            }
          }
        });
      });
    } else if (!isConcert) {
      CINEMA_TIERS.forEach((tier) => {
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
    }
    return set;
  }, [event?.id, event?.filledPct, apiSoldSeats, isCricket, isConcert]);

  if (!event) {
    return (
      <div className="wrap pad center" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <h2>Event not found</h2>
          <button className="btn-primary" onClick={() => navigate("/")} style={{ marginTop: 16 }}>
            Back to Home
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

  const toggleSeat = (tierOrStand, seatId) => {
    const key = `${tierOrStand.id}:${seatId}`;
    const isSold = soldSeats.has(key) || soldSeats.has(seatId);
    if (isSold) return;

    if (selected.includes(key)) {
      setSelected((prev) => prev.filter((k) => k !== key));
    } else {
      let next = [];
      if (selected.length >= maxQty) {
        next = [...selected.slice(1), key];
      } else {
        next = [...selected, key];
      }
      setSelected(next);
    }
  };

  const updatePassCount = (tierId, delta) => {
    const current = passCounts[tierId] || 0;
    const nextVal = Math.max(0, current + delta);
    const totalOthers = Object.values(passCounts).reduce((a, b) => a + b, 0) - current;
    if (totalOthers + nextVal > 8) return;

    setPassCounts((prev) => ({
      ...prev,
      [tierId]: nextVal,
    }));
  };

  let totalPrice = 0;
  let totalCount = 0;
  let seatLabels = [];

  if (isConcert) {
    CONCERT_PASSES.forEach((p) => {
      const cnt = passCounts[p.id] || 0;
      if (cnt > 0) {
        const pPrice = Math.round(event.price * p.mult);
        totalPrice += pPrice * cnt;
        totalCount += cnt;
        seatLabels.push(`${cnt}x ${p.name}`);
      }
    });
  } else if (isCricket) {
    totalCount = selected.length;
    totalPrice = selected.reduce((sum, key) => {
      const [standId] = key.split(":");
      const stand = CRICKET_STANDS.find((s) => s.id === standId);
      return sum + Math.round(event.price * (stand?.mult || 1));
    }, 0);
    seatLabels = selected.map((k) => k.split(":")[1]);
  } else {
    totalCount = selected.length;
    totalPrice = selected.reduce((sum, key) => {
      const [tierId] = key.split(":");
      const tier = CINEMA_TIERS.find((t) => t.id === tierId);
      return sum + Math.round(event.price * (tier?.mult || 1));
    }, 0);
    seatLabels = selected.map((k) => k.split(":")[1]);
  }

  const proceed = () => {
    if (!user) {
      if (setShowLogin) setShowLogin(true);
      return;
    }

    let tickets = [];

    if (isConcert) {
      CONCERT_PASSES.forEach((p) => {
        const cnt = passCounts[p.id] || 0;
        for (let i = 1; i <= cnt; i++) {
          const passId = `${p.prefix}-${Math.floor(100 + Math.random() * 900)}`;
          tickets.push({
            seatId: passId,
            tierLabel: p.name,
            tierName: p.name,
            price: Math.round(event.price * p.mult),
          });
        }
      });
    } else if (isCricket) {
      tickets = selected.map((key) => {
        const [standId, seatId] = key.split(":");
        const stand = CRICKET_STANDS.find((s) => s.id === standId);
        return {
          seatId: `${stand?.name || "Stand"}-${seatId}`,
          tierLabel: stand?.name || "Stadium Seat",
          tierName: stand?.name || "Stadium Seat",
          price: Math.round(event.price * (stand?.mult || 1)),
        };
      });
    } else {
      tickets = selected.map((key) => {
        const [tierId, seatId] = key.split(":");
        const tier = CINEMA_TIERS.find((t) => t.id === tierId);
        return {
          seatId,
          tierLabel: tier?.name || "Standard",
          tierName: tier?.name || "Standard",
          price: Math.round(event.price * (tier?.mult || 1)),
        };
      });
    }

    if (tickets.length === 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    navigate(`/checkout/${event.id}`, { state: { tickets, event } });
  };

  const activeStand = CRICKET_STANDS.find((s) => s.id === activeStandId) || CRICKET_STANDS[0];

  return (
    <main className="seat-pg">
      {/* ── TOP BAR ── */}
      <section className="seat-top">
        <button className="back" onClick={() => navigate(-1)} aria-label="Go back">
          ‹
        </button>
        <div>
          <h2>{event.title}</h2>
          <p>
            {event.venue}, {event.city} | {dateStr}, {event.time}
          </p>
        </div>

        {!isConcert && (
          <button
            className="qty-chip"
            onClick={() => setShowQtyModal(true)}
            id="seat-qty-btn"
          >
            {maxQty} {maxQty === 1 ? "Ticket" : "Tickets"} ▾
          </button>
        )}
      </section>

      {/* ── CONCERT TICKETING (Clean list of passes) ── */}
      {isConcert && (
        <div style={{ maxWidth: 640, margin: "24px auto 100px", padding: "0 16px" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--ink)" }}>
            Select Tickets
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CONCERT_PASSES.map((p) => {
              const price = Math.round(event.price * p.mult);
              const count = passCounts[p.id] || 0;

              return (
                <div
                  key={p.id}
                  style={{
                    background: "#ffffff",
                    border: count > 0 ? "1.5px solid var(--red, #f84464)" : "1px solid var(--line, #e2e8f0)",
                    borderRadius: 8,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 2 }}>{p.sub}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginTop: 6 }}>
                      ₹{price.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={() => updatePassCount(p.id, -1)}
                      disabled={count <= 0}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: "1px solid var(--line, #cbd5e1)",
                        background: "#fff",
                        color: count > 0 ? "var(--ink)" : "var(--mut)",
                        fontSize: 16,
                        cursor: count > 0 ? "pointer" : "default",
                      }}
                    >
                      −
                    </button>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 15 }}>
                      {count}
                    </span>
                    <button
                      onClick={() => updatePassCount(p.id, 1)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: "1px solid var(--red, #f84464)",
                        background: "var(--red, #f84464)",
                        color: "#fff",
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CRICKET STADIUM (Simple stand tabs + clean seat grid) ── */}
      {isCricket && (
        <div style={{ maxWidth: 900, margin: "20px auto 100px", padding: "0 16px" }}>
          {/* Stand selection tabs */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 20 }}>
            {CRICKET_STANDS.map((s) => {
              const active = activeStandId === s.id;
              const price = Math.round(event.price * s.mult);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStandId(s.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: active ? "1.5px solid var(--red, #f84464)" : "1px solid var(--line, #e2e8f0)",
                    background: active ? "var(--red, #f84464)" : "#fff",
                    color: active ? "#fff" : "var(--ink)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name} · ₹{price.toLocaleString()}
                </button>
              );
            })}
          </div>

          {/* Seat Grid */}
          <div className="seat-scroll">
            <div className="seat-map">
              <div className="tier">
                <div className="tier-name">
                  {activeStand.name} — ₹{Math.round(event.price * activeStand.mult).toLocaleString()}
                </div>

                {activeStand.rows.map((rowLetter) => (
                  <div className="seat-row" key={rowLetter}>
                    <span className="row-l">{rowLetter}</span>
                    {Array.from({ length: activeStand.cols }, (_, ci) => {
                      const seatNum = ci + 1;
                      const seatId = `${rowLetter}${seatNum}`;
                      const key = `${activeStand.id}:${seatId}`;
                      const isSold = soldSeats.has(key) || soldSeats.has(seatId);
                      const isSel = selected.includes(key);

                      let seatClass = "seat";
                      if (isSold) seatClass += " sold";
                      else if (isSel) seatClass += " sel";

                      return (
                        <span
                          key={seatId}
                          className="seat-cell"
                          style={{ marginRight: activeStand.aisles?.includes(ci) ? 20 : 0 }}
                        >
                          <button
                            className={seatClass}
                            disabled={isSold}
                            onClick={() => toggleSeat(activeStand, seatId)}
                            onMouseEnter={() =>
                              setHoverTip({
                                id: seatId,
                                price: event.price * activeStand.mult,
                                isSold,
                              })
                            }
                            onMouseLeave={() => setHoverTip(null)}
                            id={`seat-${seatId}`}
                          >
                            {seatNum}
                          </button>

                          {hoverTip?.id === seatId && (
                            <em className="seat-tip">
                              {isSold
                                ? `${seatId} · Sold Out`
                                : `${seatId} · ₹${Math.round(hoverTip.price).toLocaleString()}`}
                            </em>
                          )}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="seat-legend" style={{ marginTop: 24 }}>
                <span>
                  <i className="seat" /> Available
                </span>
                <span>
                  <i className="seat sel" /> Selected
                </span>
                <span>
                  <i className="seat sold" /> Sold Out
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CINEMA / THEATRE (Clean standard movie layout) ── */}
      {!isConcert && !isCricket && (
        <div className="seat-scroll">
          <div className="seat-map">
            {CINEMA_TIERS.map((tier) => (
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

                      let seatClass = `seat ${tier.cls}`;
                      if (isSold) seatClass += " sold";
                      else if (isSel) seatClass += " sel";

                      return (
                        <span
                          key={seatId}
                          className="seat-cell"
                          style={{ marginRight: tier.aisles?.includes(ci) ? 20 : 0 }}
                        >
                          <button
                            className={seatClass}
                            disabled={isSold}
                            onClick={() => toggleSeat(tier, seatId)}
                            onMouseEnter={() =>
                              setHoverTip({
                                id: seatId,
                                price: event.price * tier.mult,
                                isSold,
                              })
                            }
                            onMouseLeave={() => setHoverTip(null)}
                            id={`seat-${seatId}`}
                          >
                            {seatNum}
                          </button>

                          {hoverTip?.id === seatId && (
                            <em className="seat-tip">
                              {isSold
                                ? `${seatId} · Sold Out`
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

            <div className="screen-wrap">
              <svg viewBox="0 0 400 50" preserveAspectRatio="none">
                <path d="M10 40 Q200 5 390 40" stroke="#cbd5e1" strokeWidth="2.5" fill="none" />
              </svg>
              <p>All eyes this way please</p>
            </div>

            <div className="seat-legend">
              <span>
                <i className="seat" /> Available
              </span>
              <span>
                <i className="seat sel" /> Selected
              </span>
              <span>
                <i className="seat sold" /> Sold Out
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── SIMPLE FLOATING CHECKOUT BAR ── */}
      {totalCount > 0 && (
        <div className="pay-bar">
          <div>
            <small style={{ color: "var(--ink2)", fontWeight: 700 }}>
              {totalCount} {totalCount > 1 ? "Tickets" : "Ticket"}: {seatLabels.slice(0, 3).join(", ")}
              {seatLabels.length > 3 ? ` +${seatLabels.length - 3} more` : ""}
            </small>
            <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 2 }}>
              Total: <strong style={{ color: "var(--red)", fontSize: 17 }}>₹{Math.round(totalPrice).toLocaleString()}</strong>
            </div>
          </div>

          <div className="pb-actions">
            <button
              className="btn-primary big"
              onClick={proceed}
              id="proceed-pay-btn"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}

      {/* ── QUANTITY MODAL ── */}
      {showQtyModal && (
        <div
          className="modal-bg"
          onClick={() => setShowQtyModal(false)}
        >
          <div
            className="modal qty"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, padding: 24 }}
          >
            <h3>How Many Seats?</h3>
            <div className="qty-row" style={{ marginTop: 16 }}>
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
            <button
              className="btn-primary"
              onClick={() => setShowQtyModal(false)}
              style={{ width: "100%", padding: "10px", marginTop: 20 }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
