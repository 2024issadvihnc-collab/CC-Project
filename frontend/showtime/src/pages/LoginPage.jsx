import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  registerUser,
  loginUser,
  googleLogin,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
  resetPassword,
} from "../services/api";

export default function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  // Mode: "login" | "register" | "forgot"
  const [mode, setMode] = useState("login");
  const [loginMethod, setLoginMethod] = useState("password"); // "password" | "otp"

  // Google Login state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");

  // Registration fields
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Forgot password fields
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP login fields
  const [otpPhone, setOtpPhone] = useState("");
  const [otpStep, setOtpStep] = useState("phone"); // "phone" | "otp"
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Handle Google / Gmail Sign-in
  const handleGoogleSignIn = async (emailToUse, nameToUse) => {
    const targetEmail = (emailToUse || googleEmail || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Please enter a valid Gmail address (e.g. name@gmail.com)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await googleLogin({
        email: targetEmail,
        name: nameToUse || targetEmail.split("@")[0],
      });
      const userData = { ...res.user, token: res.token || res.user?.token };
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      if (onLoginSuccess) onLoginSuccess(userData);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!regName.trim()) {
      setError("Please enter your full name");
      return;
    }
    if (regPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    if (!regEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (regPassword.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({
        name: regName.trim(),
        phone: regPhone,
        email: regEmail.trim(),
        password: regPassword,
      });

      const userData = { ...res.user, token: res.token || res.user?.token };
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      if (onLoginSuccess) onLoginSuccess(userData);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Login with Password
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!loginIdentifier.trim()) {
      setError("Please enter your phone number or email");
      return;
    }
    if (!loginPassword) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      const userData = { ...res.user, token: res.token || res.user?.token };
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      if (onLoginSuccess) onLoginSuccess(userData);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. If using Gmail, click 'Continue with Google'.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!forgotIdentifier.trim() || !newPassword) {
      setError("Please enter your registered phone or email and new password");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        identifier: forgotIdentifier.trim(),
        newPassword,
      });
      setSuccessMsg("Password reset successfully! Please sign in with your new password.");
      setMode("login");
      setLoginIdentifier(forgotIdentifier);
      setLoginPassword("");
    } catch (err) {
      setError(err.message || "Password reset failed. Ensure account exists.");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Send
  const handleSendOtp = async () => {
    const target = otpPhone.trim();
    if (target.includes("@") ? target.length < 5 : target.length < 10) {
      setError("Please enter a valid 10-digit mobile number or Gmail ID");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiSendOtp(target);
      setOtpStep("otp");
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verify
  const handleVerifyOtp = async (code) => {
    const codeStr = code || otpCode.join("");
    if (codeStr.length < 6) return;
    setLoading(true);
    setError("");
    const target = otpPhone.trim();
    try {
      const res = await apiVerifyOtp(target, codeStr);
      const userData = { ...(res.user || {}), token: res.token || res.user?.token };
      if (!userData.phone && !userData.email) {
        if (target.includes("@")) userData.email = target;
        else userData.phone = `+91 ${target.replace(/\D/g, "").slice(-10)}`;
        userData.name = userData.name || "ShowTime User";
      }
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      if (onLoginSuccess) onLoginSuccess(userData);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid OTP code");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpBoxChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpCode];
    next[i] = val;
    setOtpCode(next);
    if (val && i < 5) {
      document.getElementById(`page-otp-${i + 1}`)?.focus();
    }
    if (next.every((d) => d !== "")) {
      handleVerifyOtp(next.join(""));
    }
  };

  return (
    <div
      style={{
        minHeight: "82vh",
        display: "grid",
        placeItems: "center",
        padding: "40px 20px",
        background: "var(--bg)",
      }}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        style={{
          boxShadow: "0 14px 40px rgba(0,0,0,0.08)",
          border: "1px solid var(--line)",
          maxWidth: 450,
          padding: "32px",
        }}
      >
        <div className="login">
          <div style={{ display: "inline-block", background: "rgba(248,68,100,0.1)", color: "var(--red)", fontWeight: 800, fontSize: 13, padding: "4px 10px", borderRadius: 6, letterSpacing: 1, marginBottom: 8 }}>
            SHOWTIME
          </div>

          <h3 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink2)", margin: "4px 0" }}>
            {mode === "register" ? "Create an Account" : mode === "forgot" ? "Reset Password" : "Welcome Back"}
          </h3>
          <p className="muted" style={{ marginBottom: 18, fontSize: 13 }}>
            {mode === "register"
              ? "Register with your name, phone, and email to book tickets"
              : mode === "forgot"
              ? "Enter your phone or email to update your password"
              : "Sign in to access your booked passes and reservations"}
          </p>

          {/* ── GOOGLE / GMAIL 1-CLICK SIGN-IN BUTTON ── */}
          {mode !== "forgot" && !showGoogleModal && (
            <div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(true)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "11px 16px",
                  background: "#ffffff",
                  border: "1px solid #dadce0",
                  borderRadius: 8,
                  color: "#3c4043",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(60,64,67,0.08)",
                  transition: "all 0.2s ease",
                  marginBottom: 14,
                }}
                id="page-google-signin-btn"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continue with Google / Gmail
              </button>

              <div style={{ display: "flex", alignItems: "center", margin: "14px 0 18px", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--mut)", textTransform: "uppercase", letterSpacing: 0.5 }}>or sign in with password</span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>
            </div>
          )}

          {/* ── GOOGLE SIGN-IN INTERACTIVE PROMPT ── */}
          {showGoogleModal && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "#f8fafd",
                border: "1px solid #d2e3fc",
                borderRadius: 10,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <strong style={{ fontSize: 14, color: "#1a73e8" }}>Sign in with Google</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  style={{ background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer" }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Quick Select: Known User sadvihn@gmail.com */}
              <button
                type="button"
                onClick={() => handleGoogleSignIn("sadvihn@gmail.com", "Sadvi")}
                disabled={loading}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  background: "#ffffff",
                  border: "1px solid #c2e7ff",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink2)" }}>Sadvi</div>
                  <div style={{ fontSize: 12, color: "var(--mut)" }}>sadvihn@gmail.com</div>
                </div>
                <span style={{ fontSize: 12, color: "#1a73e8", fontWeight: 600 }}>1-Click Login →</span>
              </button>

              {/* Or enter any other Gmail account */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13 }}
                  type="email"
                  placeholder="Or enter yourname@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleGoogleSignIn(googleEmail)}
                  disabled={loading || !googleEmail.includes("@")}
                  style={{ padding: "8px 14px", fontSize: 13 }}
                >
                  {loading ? "Signing In…" : "Sign In"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Toggle Tabs (when not resetting password) */}
          {mode !== "forgot" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "#f0f0f3",
                borderRadius: 10,
                padding: 4,
                marginBottom: 20,
              }}
            >
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); setShowGoogleModal(false); }}
                style={{
                  padding: "8px 0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  background: mode === "login" ? "#fff" : "none",
                  color: mode === "login" ? "var(--ink2)" : "var(--mut)",
                  boxShadow: mode === "login" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  transition: "0.2s",
                }}
                id="tab-login-btn"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); setShowGoogleModal(false); }}
                style={{
                  padding: "8px 0",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  background: mode === "register" ? "#fff" : "none",
                  color: mode === "register" ? "var(--ink2)" : "var(--mut)",
                  boxShadow: mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                  transition: "0.2s",
                }}
                id="tab-register-btn"
              >
                Register
              </button>
            </div>
          )}

          {error && (
            <div style={{ background: "#fdecea", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ background: "#e8f8ed", color: "#1a8d3f", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 14 }}>
              {successMsg}
            </div>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === "register" && (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <input
                  style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                  placeholder="Full Name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  id="reg-name-input"
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <span style={{ padding: "12px 14px", background: "#f5f5f7", fontSize: 14, color: "var(--mut)" }}>+91</span>
                <input
                  style={{ flex: 1, padding: "12px 14px", border: "none", fontSize: 14 }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Mobile Number"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ""))}
                  required
                  id="reg-phone-input"
                />
              </div>

              <div>
                <input
                  style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                  type="email"
                  placeholder="Email ID / Gmail ID"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  id="reg-email-input"
                />
              </div>

              <div style={{ position: "relative" }}>
                <input
                  style={{ width: "100%", padding: "12px 54px 12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                  type={showRegPassword ? "text" : "password"}
                  placeholder="Create Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  id="reg-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer", fontWeight: 600 }}
                >
                  {showRegPassword ? "Hide" : "Show"}
                </button>
              </div>

              <button
                type="submit"
                className="btn-primary full"
                disabled={loading}
                style={{ padding: "12px", marginTop: 4 }}
                id="submit-register-btn"
              >
                {loading ? "Creating Account…" : "Register & Continue"}
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {mode === "forgot" && (
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                placeholder="Registered Phone or Email"
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                required
                autoFocus
              />

              <div style={{ position: "relative" }}>
                <input
                  style={{ width: "100%", padding: "12px 54px 12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer", fontWeight: 600 }}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>

              <button
                type="submit"
                className="btn-primary full"
                disabled={loading}
                style={{ padding: "12px", marginTop: 4 }}
              >
                {loading ? "Updating Password…" : "Update Password & Sign In"}
              </button>

              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
                style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 13, marginTop: 6, cursor: "pointer" }}
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <div>
              {loginMethod === "password" ? (
                <form onSubmit={handlePasswordLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <input
                      style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                      placeholder="Phone Number or Gmail / Email ID"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      required
                      id="login-id-input"
                      autoFocus
                    />
                  </div>

                  <div style={{ position: "relative" }}>
                    <input
                      style={{ width: "100%", padding: "12px 54px 12px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      id="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer", fontWeight: 600 }}
                    >
                      {showLoginPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div style={{ textAlign: "right", marginTop: -2 }}>
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); }}
                      style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                      id="login-forgot-password-link"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary full"
                    disabled={loading}
                    style={{ padding: "12px", marginTop: 4 }}
                    id="submit-login-btn"
                  >
                    {loading ? "Signing In…" : "Sign In"}
                  </button>

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setLoginMethod("otp"); setError(""); }}
                      style={{ background: "none", border: "none", color: "var(--ink2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Sign In with OTP instead
                    </button>
                  </div>
                </form>
              ) : (
                /* OTP Login */
                <div>
                  {otpStep === "phone" ? (
                    <div>
                      <div className="phone-in">
                        <input
                          type="text"
                          placeholder="Enter 10-digit mobile or Gmail ID"
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                          id="login-otp-phone-input"
                          autoFocus
                          style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-primary full"
                        onClick={handleSendOtp}
                        disabled={loading || otpPhone.trim().length < 5}
                        style={{ marginTop: 12 }}
                      >
                        {loading ? "Sending OTP…" : "Send OTP"}
                      </button>

                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setLoginMethod("password")}
                          style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 13, cursor: "pointer" }}
                        >
                          ← Sign in with password instead
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="muted">Enter 6-digit OTP sent to {otpPhone}</p>
                      <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 700, margin: "6px 0 12px" }}>
                        Demo OTP: 123456
                      </div>

                      <div className="otp">
                        {otpCode.map((d, i) => (
                          <input
                            key={i}
                            id={`page-otp-${i}`}
                            value={d}
                            onChange={(e) => handleOtpBoxChange(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !d && i > 0) {
                                document.getElementById(`page-otp-${i - 1}`)?.focus();
                              }
                            }}
                            inputMode="numeric"
                            maxLength={1}
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        className="btn-primary full"
                        onClick={() => handleVerifyOtp()}
                        disabled={loading || otpCode.some((d) => !d)}
                        style={{ marginTop: 12 }}
                      >
                        {loading ? "Verifying…" : "Verify OTP & Continue"}
                      </button>

                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          onClick={() => setOtpStep("phone")}
                          style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 13, cursor: "pointer" }}
                        >
                          ← Change number / email
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Skip Option */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => navigate(from, { replace: true })}
              style={{
                background: "none",
                border: "none",
                color: "var(--mut)",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
              }}
              id="skip-auth-btn"
            >
              Skip & Explore Events as Guest →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
