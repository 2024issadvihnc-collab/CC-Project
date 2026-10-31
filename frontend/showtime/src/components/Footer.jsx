import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <div className="footer-logo-ic">ST</div>
              show<b>time</b>
            </Link>
            <p>
              India's premier live entertainment and event booking platform. Concerts, cricket, DJ nights, festivals and comedy — all in one place.
            </p>
            <div className="footer-badges">
              <span className="footer-badge">Instant E-Tickets</span>
              <span className="footer-badge">100% Verified</span>
              <span className="footer-badge">Secure Payments</span>
            </div>
          </div>

          {/* Events Column */}
          <div className="footer-col">
            <h4>Live Events</h4>
            <ul>
              <li><Link to="/events?cat=music">Music Concerts</Link></li>
              <li><Link to="/events?cat=cricket">Cricket Matches</Link></li>
              <li><Link to="/events?cat=sports">Sports Tournaments</Link></li>
              <li><Link to="/events?cat=dj">DJ & Nightlife</Link></li>
              <li><Link to="/events?cat=festival">Cultural Festivals</Link></li>
              <li><Link to="/events?cat=comedy">Standup Comedy</Link></li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">About Us</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#list-event">List Your Event</a></li>
              <li><a href="#corporate">Corporate Bookings</a></li>
              <li><a href="#offers">Exclusive Offers</a></li>
              <li><a href="#gift-cards">Gift Cards</a></li>
            </ul>
          </div>

          {/* Support Column */}
          <div className="footer-col">
            <h4>Support & Legal</h4>
            <ul>
              <li><Link to="/scanner" id="footer-scanner-link">Gate Entry Scanner</Link></li>
              <li><a href="#help">Help Center</a></li>
              <li><a href="#cancellation">Cancellation Policy</a></li>
              <li><a href="#privacy">Privacy Policy</a></li>
              <li><a href="#terms">Terms of Service</a></li>
              <li><a href="#contact">Contact Support</a></li>
              <li><a href="#faq">Booking FAQs</a></li>
            </ul>
          </div>
        </div>

        <hr className="footer-divider" />

        <div className="footer-bottom">
          <p>© 2026 ShowTime Events Pvt. Ltd. All rights reserved.</p>
          <p>Crafted for live entertainment in India</p>
        </div>
      </div>
    </footer>
  );
}
