import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import "./styles/main.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import LoginModal from "./components/LoginModal";
import SplashScreen from "./components/SplashScreen";
import ProfileSettingsModal from "./components/ProfileSettingsModal";
import ScrollToTop from "./components/ScrollToTop";

import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import EventsPage from "./pages/EventsPage";
import EventDetail from "./pages/EventDetail";
import SeatsPage from "./pages/SeatsPage";
import Checkout from "./pages/Checkout";
import Confirmation from "./pages/Confirmation";
import MyTickets from "./pages/MyTickets";
import TicketScanner from "./pages/TicketScanner";

import { getUserBookings } from "./services/api";

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [city, setCity] = useState(() => {
    try {
      return localStorage.getItem("showtime_city") || "All Cities";
    } catch {
      return "All Cities";
    }
  });

  const handleCityChange = (newCity) => {
    setCity(newCity);
    try {
      localStorage.setItem("showtime_city", newCity);
    } catch {}
  };
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("showtime_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showSplash, setShowSplash] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [bookedTickets, setBookedTickets] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Load user tickets from backend
  useEffect(() => {
    if (user?.phone || user?.email) {
      getUserBookings({ phone: user.phone, email: user.email }).then((data) => {
        if (data && data.length) {
          setBookedTickets(data);
        }
      });
    }
  }, [user]);

  const addToast = (msg, type = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("showtime_user", JSON.stringify(userData));
    setShowLogin(false);
    addToast(`Welcome, ${userData.name || userData.phone || "User"}!`, "success");
  };

  const handleUpdateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("showtime_user", JSON.stringify(updatedUser));
    addToast("Profile settings saved!", "success");
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem("showtime_user");
    setShowProfileModal(false);
    setShowLogin(false);
    navigate("/");
  };

  const handleDeleteAccount = () => {
    setUser(null);
    localStorage.removeItem("showtime_user");
    setShowProfileModal(false);
    setShowLogin(false);
    navigate("/");
  };

  const addTicket = (booking) => {
    setBookedTickets((prev) => [booking, ...prev]);
    addToast("Booking confirmed!", "success");
  };

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  return (
    <>
      {/* Global Scroll Restoration for all route changes & button navigations */}
      <ScrollToTop />

      {/* 1. Splash Screen */}
      <AnimatePresence>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      </AnimatePresence>

      <Navbar
        city={city}
        setCity={handleCityChange}
        user={user}
        setShowLogin={setShowLogin}
        onSignOut={handleSignOut}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      <Routes>
        <Route path="/" element={<Home city={city} />} />
        <Route
          path="/login"
          element={<LoginPage onLoginSuccess={handleLogin} />}
        />
        <Route path="/events" element={<EventsPage city={city} setCity={handleCityChange} />} />
        <Route
          path="/event/:id"
          element={<EventDetail user={user} setShowLogin={setShowLogin} />}
        />
        <Route
          path="/seats/:id"
          element={<SeatsPage user={user} setShowLogin={setShowLogin} addTicket={addTicket} />}
        />
        <Route
          path="/checkout/:id"
          element={<Checkout user={user} setShowLogin={setShowLogin} addTicket={addTicket} />}
        />
        <Route
          path="/confirmation/:bookingId"
          element={<Confirmation tickets={bookedTickets} />}
        />
        <Route
          path="/my-tickets"
          element={
            <MyTickets
              tickets={bookedTickets}
              user={user}
              setShowLogin={setShowLogin}
            />
          }
        />
        <Route path="/scanner" element={<TicketScanner user={user} />} />
      </Routes>

      <Footer />

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onSuccess={handleLogin}
          />
        )}
      </AnimatePresence>

      {/* User Profile & Settings Drawer / Modal */}
      <AnimatePresence>
        {showProfileModal && user && (
          <ProfileSettingsModal
            user={user}
            onClose={() => setShowProfileModal(false)}
            onUpdateUser={handleUpdateUser}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
      </AnimatePresence>

      {/* Toast Container */}
      <div className="toast-container" id="toast-container">
        <AnimatePresence>
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.msg}
            </div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
