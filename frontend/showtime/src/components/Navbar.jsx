import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { events as allEvents, cities } from "../data/events";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/api";

export default function Navbar({ city, setCity, user, setShowLogin, onSignOut, onOpenProfile }) {
  const [q, setQ] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const searchRef = useRef();
  const cityMenuRef = useRef();
  const userMenuRef = useRef();
  const notifMenuRef = useRef();

  async function fetchNotificationsList() {
    if (!user) return;
    const res = await getNotifications(20);
    if (res && res.data) {
      setNotifications(res.data);
      setUnreadCount(res.unreadCount || 0);
    }
  }

  // Poll unread notification count
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotificationsList();
    const timer = setInterval(() => {
      getUnreadNotificationsCount().then((count) => setUnreadCount(count));
    }, 25000);
    return () => clearInterval(timer);
  }, [user]);

  // Close dropdowns if clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUser(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setShowNotif(false);
      }
      if (cityMenuRef.current && !cityMenuRef.current.contains(event.target)) {
        setShowCityDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = q.trim().length > 1
    ? allEvents.filter(e =>
        e.title.toLowerCase().includes(q.toLowerCase()) ||
        e.venue.toLowerCase().includes(q.toLowerCase()) ||
        e.city.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 6)
    : [];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : (user?.phone ? user.phone.slice(-1) : "U");

  return (
    <>
      <header className="hdr">
        <div className="hdr-top">
          {/* Logo without emoji */}
          <Link to="/" className="logo" id="nav-logo">
            <div className="logo-ic">ST</div>
            show<b>time</b>
          </Link>

          {/* Search */}
          <div className="search" ref={searchRef}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              onKeyDown={e => {
                if (e.key === "Enter" && q.trim()) {
                  navigate(`/events?q=${encodeURIComponent(q.trim())}`);
                  setQ(""); setShowSuggest(false);
                }
              }}
              placeholder="Search for events, artists, venues..."
              id="nav-search-input"
            />
            <AnimatePresence>
              {showSuggest && (
                <motion.ul
                  className="suggest"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {suggestions.length > 0 ? suggestions.map(ev => (
                    <li key={ev.id} onMouseDown={() => { navigate(`/event/${ev.id}`); setQ(""); setShowSuggest(false); }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{color:"var(--red)",flexShrink:0}}>
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <div>
                        <span>{ev.title}</span>
                        <small>{ev.venue} · {ev.city}</small>
                      </div>
                    </li>
                  )) : (
                    <li className="none">
                      <span>No results for "{q}"</span>
                    </li>
                  )}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {/* Right */}
          <div className="hdr-right">
            {/* City Selector Dropdown List */}
            <div className="city-dropdown-wrapper" ref={cityMenuRef} style={{ position: "relative" }}>
              <button
                className="city-btn flex"
                onClick={() => setShowCityDropdown((prev) => !prev)}
                id="city-btn"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={showCityDropdown}
                title="Select City"
              >
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4, color: "var(--red)" }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span id="current-selected-city">{city || "All Cities"}</span>
                <svg
                  width="12"
                  height="12"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  style={{
                    marginLeft: 4,
                    transition: "transform 0.2s ease",
                    transform: showCityDropdown ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>

              <AnimatePresence>
                {showCityDropdown && (
                  <motion.div
                    className="city-dropdown-menu"
                    id="city-dropdown-menu"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      width: 210,
                      maxHeight: 340,
                      overflowY: "auto",
                      background: "#ffffff",
                      borderRadius: 12,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
                      border: "1.5px solid #e2e8f0",
                      zIndex: 9999,
                      padding: "6px 0",
                    }}
                  >
                    {/* All Cities option */}
                    <button
                      type="button"
                      className={`city-dropdown-item ${city === "All Cities" || city === "All" ? "active" : ""}`}
                      onClick={() => {
                        setCity("All Cities");
                        setShowCityDropdown(false);
                      }}
                      id="city-item-all"
                    >
                      <span>All Cities (India)</span>
                      {(city === "All Cities" || city === "All") && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red, #f84464)" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

                    {/* All individual cities */}
                    {cities.map((c) => {
                      const isSelected = city === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`city-dropdown-item ${isSelected ? "active" : ""}`}
                          onClick={() => {
                            setCity(c);
                            setShowCityDropdown(false);
                          }}
                          id={`city-item-${c.toLowerCase()}`}
                        >
                          <span>{c}</span>
                          {isSelected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red, #f84464)" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Notification Bell */}
            {user && (
              <div className="notif-box" ref={notifMenuRef} style={{ position: "relative" }}>
                <button
                  className="notif-bell-btn"
                  onClick={() => {
                    const next = !showNotif;
                    setShowNotif(next);
                    if (next) fetchNotificationsList();
                  }}
                  id="nav-notif-btn"
                  title="Notifications"
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span
                      id="notif-badge-count"
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        background: "var(--red, #f84464)",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "1px 5px",
                        borderRadius: "10px",
                        border: "2px solid #1f2533",
                        lineHeight: "1.2",
                      }}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotif && (
                    <motion.div
                      className="notif-dropdown"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{
                        position: "absolute",
                        top: "120%",
                        right: 0,
                        width: 320,
                        background: "#ffffff",
                        borderRadius: 12,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                        border: "1px solid #e5e7eb",
                        color: "#1f2937",
                        zIndex: 9999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #e5e7eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#f9fafb",
                        }}
                      >
                        <strong style={{ fontSize: 13, color: "#111827" }}>
                          Notifications {unreadCount > 0 && `(${unreadCount})`}
                        </strong>
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              await markAllNotificationsRead();
                              fetchNotificationsList();
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--red, #f84464)",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div style={{ maxHeight: 320, overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={async () => {
                                if (!n.is_read) {
                                  await markNotificationRead(n.id);
                                  fetchNotificationsList();
                                }
                              }}
                              style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid #f3f4f6",
                                background: n.is_read ? "#ffffff" : "#fff7ed",
                                cursor: "pointer",
                                transition: "background 0.15s ease",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <span style={{ fontSize: 16 }}>
                                  {n.type === "BOOKING_CONFIRMED" ? "🎟️" : n.type === "BOOKING_FAILED" ? "⚠️" : n.type === "CANCELLATION" ? "↩️" : "🔔"}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                    <strong style={{ fontSize: 12, color: "#111827" }}>{n.title}</strong>
                                    {!n.is_read && (
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red, #f84464)", display: "inline-block" }} />
                                    )}
                                  </div>
                                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#4b5563", lineHeight: 1.4 }}>
                                    {n.message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user ? (
              <div className="user" ref={userMenuRef} style={{ display: "flex", alignItems: "center" }}>
                <button
                  className="user-nav-chip"
                  onClick={() => setShowUser(!showUser)}
                  id="nav-user-btn"
                  title="Profile & Settings"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255, 255, 255, 0.12)",
                    border: "1px solid rgba(255, 255, 255, 0.22)",
                    borderRadius: 24,
                    padding: "4px 14px 4px 5px",
                    cursor: "pointer",
                    color: "#ffffff",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span className="avatar" style={{ margin: 0, width: 28, height: 28, fontSize: 13, background: "var(--red, #f84464)", color: "#fff", display: "grid", placeItems: "center", borderRadius: "50%", fontWeight: 700 }}>
                    {userInitial}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#ffffff", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.name || "ShowTime User"}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.8, marginLeft: 2 }}>
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showUser && (
                    <motion.div
                      className="user-menu"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ width: 230 }}
                    >
                      <p>
                        {user.name || "ShowTime User"}
                        <small>{user.email || user.phone}</small>
                      </p>
                      <button
                        onClick={() => {
                          setShowUser(false);
                          if (onOpenProfile) onOpenProfile();
                        }}
                        id="menu-profile-btn"
                      >
                        Profile & Settings
                      </button>
                      {(user.role === "admin" || user.role === "staff") && (
                        <Link
                          to="/scanner"
                          onClick={() => setShowUser(false)}
                          id="menu-scanner-btn"
                          style={{ color: "var(--red)", fontWeight: 600 }}
                        >
                          Gate QR Scanner
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setShowUser(false);
                          if (onSignOut) onSignOut();
                        }}
                        id="nav-signout-btn"
                        style={{ color: "var(--red)", fontWeight: 700 }}
                      >
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                className="btn-signin"
                onClick={() => setShowLogin(true)}
                id="nav-signin-btn"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="hdr-nav">
          <div>
            <Link to="/" id="nav-explore-link">Explore</Link>
            <Link to="/events?cat=music">Live Events</Link>
            <Link to="/events?cat=cricket">Cricket</Link>
            <Link to="/events?cat=sports">Sports</Link>
            <Link to="/events?cat=dj">Nightlife</Link>
            <Link to="/events?cat=festival">Festivals</Link>
            <Link to="/events?cat=comedy">Comedy</Link>
          </div>
          <div>
            <Link to="/my-tickets" id="nav-my-tickets-link">My Passes & Tickets</Link>
          </div>
        </nav>
      </header>
    </>
  );
}
