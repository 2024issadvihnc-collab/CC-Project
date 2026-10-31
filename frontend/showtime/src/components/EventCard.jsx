import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CAT_COLORS = {
  music:   { bg: ["#6d28d9","#a855f7"] },
  cricket: { bg: ["#065f46","#10b981"] },
  sports:  { bg: ["#1e3a8a","#3b82f6"] },
  dj:      { bg: ["#4c1d95","#7c3aed"] },
  festival:{ bg: ["#92400e","#f59e0b"] },
  comedy:  { bg: ["#78350f","#d97706"] },
};

export function EventPoster({ event, className = "" }) {
  const cat = CAT_COLORS[event.category] || CAT_COLORS.music;
  const dateStr = new Date(event.date).toLocaleDateString("en-IN", { day:"numeric", month:"short" });
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={`poster ${className}`}>
      {event.image && !imgFailed ? (
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
          <img
            src={event.image}
            alt={event.title}
            onError={() => setImgFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {/* Subtle gradient overlay to ensure text contrast */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(15,15,20,0.92) 0%, rgba(15,15,20,0.2) 48%, rgba(15,15,20,0.3) 100%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "16px 14px",
              color: "#fff",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", color: "var(--red)" }}>
              {event.category}
            </div>
            <div style={{ fontFamily: "Poppins,sans-serif", fontWeight: "700", fontSize: "15px", lineHeight: "1.25", marginTop: "3px", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
              {event.title.length > 22 ? event.title.slice(0, 22) + "…" : event.title}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "3px" }}>
              {dateStr} · {event.city}
            </div>
            <div style={{ fontWeight: "700", fontSize: "13px", marginTop: "5px", color: "#fff" }}>
              from ₹{event.price.toLocaleString()}
            </div>
          </div>
        </div>
      ) : (
        <svg className="poster-svg" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={`g-${event.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={cat.bg[0]}/>
              <stop offset="1" stopColor={cat.bg[1]}/>
            </linearGradient>
          </defs>
          <rect width="300" height="420" fill={`url(#g-${event.id})`}/>
          <rect width="300" height="420" fill="url(#vignette)" opacity=".4"/>
          {/* Title */}
          <text x="150" y="270" textAnchor="middle" fontFamily="Poppins,sans-serif" fontWeight="700" fontSize="18" fill="#fff" opacity=".95">{event.title.slice(0,22)}{event.title.length>22?"…":""}</text>
          {/* Date */}
          <text x="150" y="300" textAnchor="middle" fontFamily="Poppins,sans-serif" fontSize="13" fill="#fff" opacity=".75">{dateStr} · {event.city}</text>
          {/* Price */}
          <text x="150" y="380" textAnchor="middle" fontFamily="Poppins,sans-serif" fontWeight="600" fontSize="15" fill="#fff">from ₹{event.price.toLocaleString()}</text>
        </svg>
      )}

      {event.filledPct > 0.85 && (
        <div className="poster-tag">FILLING FAST</div>
      )}
    </div>
  );
}

// Small card used in rails
export default function EventCard({ event, onClick }) {
  const dateStr = new Date(event.date).toLocaleDateString("en-IN", { day:"numeric", month:"short" });

  return (
    <div className="mcard" onClick={() => onClick(event)} id={`event-card-${event.id}`} style={{cursor:"pointer"}}>
      <div className="mcard-img">
        <EventPoster event={event} />
        <div className="rate-bar">
          <span>{event.rating} / 5</span>
          <em>{event.votes.toLocaleString()} reviews</em>
        </div>
      </div>
      <h4>{event.title}</h4>
      <p>{event.category.toUpperCase()} · {dateStr} · {event.city}</p>
      <p style={{fontSize:12,color:"var(--mut)",marginTop:2}}>from ₹{event.price.toLocaleString()}</p>
    </div>
  );
}
