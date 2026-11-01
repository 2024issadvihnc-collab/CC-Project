import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  registerUser,
  loginUser,
  googleLogin,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
  resetPassword,
} from "../services/api";

export default function LoginModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [method, setMethod] = useState("password"); // "password" | "otp"

  // Google Login state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");

  // Registration
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password
  const [forgotId, setForgotId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP
  const [otpPhone, setOtpPhone] = useState("");
  const [otpStep, setOtpStep] = useState("phone");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

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
      onSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || regPhone.length < 10 || !regEmail.includes("@") || !regPassword) {
      setError("Please fill all fields accurately");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await registerUser({
        name: regName.trim(),
        phone: regPhone,
        email: regEmail.trim(),
        password: regPassword,
      });
      const userData = { ...res.user, token: res.token || res.user?.token };
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      onSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Please enter your phone/email and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await loginUser({ identifier: identifier.trim(), password });
      const userData = { ...res.user, token: res.token || res.user?.token };
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      onSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || "Invalid credentials. If using Gmail, click 'Continue with Google'.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotId.trim() || !newPassword) {
      setError("Please enter your phone/email and new password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPassword({ identifier: forgotId.trim(), newPassword });
      setMsg("Password reset successfully! Please sign in with your new password.");
      setMode("login");
      setIdentifier(forgotId);
      setPassword("");
    } catch (err) {
      setError(err.message || "Failed to reset password. Ensure the phone or email is registered.");
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    const target = otpPhone.trim();
    if (target.includes("@") ? target.length < 5 : target.length < 10) {
      setError("Please enter a valid 10-digit mobile number or Gmail ID");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiSendOtp(target);
      setOtpStep("otp");
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) document.getElementById(`modal-otp-${i + 1}`)?.focus();
    if (next.every((d) => d !== "")) verifyOtp(next.join(""));
  };

  const verifyOtp = async (code) => {
    const codeStr = code || otp.join("");
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
      onSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || "Invalid OTP code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, padding: 28, position: "relative" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 16, right: 18, background: "none", border: "none", fontSize: 20, color: "var(--mut)", cursor: "pointer", lineHeight: 1 }}
          aria-label="Close"
        >
          &times;
        </button>

        <div className="login">
          {/* Logo badge */}
          <div style={{ display: "inline-block", background: "rgba(248,68,100,0.1)", color: "var(--red)", fontWeight: 800, fontSize: 13, padding: "4px 10px", borderRadius: 6, letterSpacing: 1, marginBottom: 8 }}>
            SHOWTIME
          </div>

          <h3 style={{ fontSize: 22, fontWeight: 800 }}>
            {mode === "register" ? "Create an Account" : mode === "forgot" ? "Reset Password" : "Welcome Back"}
          </h3>
          <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
            {mode === "register"
              ? "Sign up to book tickets & save passes"
              : mode === "forgot"
              ? "Enter your phone or email to set a new password"
              : "Sign in to book and view your passes"}
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
                id="modal-google-signin-btn"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continue with Google / Gmail
              </button>

              <div style={{ display: "flex", alignItems: "center", margin: "12px 0 16px", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span style={{ fontSize: 12, color: "var(--mut)", textTransform: "uppercase", letterSpacing: 0.5 }}>or with credentials</span>
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
                marginBottom: 16,
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
                  padding: "10px 12px",
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

          {/* Toggle Tabs (when not in forgot password mode) */}
          {mode !== "forgot" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f0f0f3", borderRadius: 8, padding: 3, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setMsg(""); setShowGoogleModal(false); }}
                style={{ padding: "7px 0", borderRadius: 6, fontWeight: 700, fontSize: 13, border: "none", background: mode === "login" ? "#fff" : "none", color: mode === "login" ? "var(--ink2)" : "var(--mut)" }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setMsg(""); setShowGoogleModal(false); }}
                style={{ padding: "7px 0", borderRadius: 6, fontWeight: 700, fontSize: 13, border: "none", background: mode === "register" ? "#fff" : "none", color: mode === "register" ? "var(--ink2)" : "var(--mut)" }}
              >
                Register
              </button>
            </div>
          )}

          {error && <div style={{ background: "#fdecea", color: "var(--red)", fontSize: 12, padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>{error}</div>}
          {msg && <div style={{ background: "#e8f8ed", color: "#1a8d3f", fontSize: 12, padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>{msg}</div>}

          {/* ── REGISTER MODE ── */}
          {mode === "register" && (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }} placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} required autoFocus />
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <span style={{ padding: "10px 12px", background: "#f5f5f7", fontSize: 13, color: "var(--mut)" }}>+91</span>
                <input style={{ flex: 1, padding: "10px", border: "none" }} type="tel" maxLength={10} placeholder="Mobile Number" value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ""))} required />
              </div>
              <input style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }} type="email" placeholder="Email / Gmail ID" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />

              {/* Password with View Password Toggle */}
              <div style={{ position: "relative" }}>
                <input
                  style={{ width: "100%", padding: "10px 54px 10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                  type={showRegPassword ? "text" : "password"}
                  placeholder="Password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer", fontWeight: 600 }}
                >
                  {showRegPassword ? "Hide" : "Show"}
                </button>
              </div>

              <button type="submit" className="btn-primary full" disabled={loading} style={{ padding: 11, marginTop: 4 }}>
                {loading ? "Registering…" : "Register & Sign In"}
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD MODE ── */}
          {mode === "forgot" && (
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                placeholder="Registered Phone or Email"
                value={forgotId}
                onChange={(e) => setForgotId(e.target.value)}
                required
                autoFocus
              />

              <div style={{ position: "relative" }}>
                <input
                  style={{ width: "100%", padding: "10px 54px 10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer", fontWeight: 600 }}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>

              <button type="submit" className="btn-primary full" disabled={loading} style={{ padding: 11, marginTop: 4 }}>
                {loading ? "Updating Password…" : "Update Password & Sign In"}
              </button>

              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setMsg(""); }}
                style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 13, marginTop: 6, cursor: "pointer" }}
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* ── LOGIN MODE ── */}
          {mode === "login" && (
            <div>
              {method === "password" ? (
                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                    placeholder="Phone Number or Gmail / Email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoFocus
                  />

                  {/* Password with View Password Toggle */}
                  <div style={{ position: "relative" }}>
                    <input
                      style={{ width: "100%", padding: "10px 54px 10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: "var(--mut)", cursor: "pointer", fontWeight: 600 }}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div style={{ textAlign: "right", marginTop: -2 }}>
                    <button
                      type="button"
                      onClick={() => { setMode("forgot"); setError(""); setMsg(""); }}
                      style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                      id="modal-forgot-password-link"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button type="submit" className="btn-primary full" disabled={loading} style={{ padding: 11, marginTop: 4 }}>
                    {loading ? "Signing In…" : "Sign In"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("otp")}
                    style={{ background: "none", border: "none", color: "var(--ink2)", fontSize: 13, marginTop: 6, cursor: "pointer", fontWeight: 600 }}
                  >
                    Sign In with OTP instead
                  </button>
                </form>
              ) : (
                <div>
                  {otpStep === "phone" ? (
                    <div>
                      <div className="phone-in">
                        <input
                          type="text"
                          placeholder="Enter mobile number or Gmail ID"
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          autoFocus
                          style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }}
                        />
                      </div>
                      <button type="button" className="btn-primary full" onClick={sendOtp} disabled={loading || otpPhone.trim().length < 5} style={{ marginTop: 10 }}>
                        {loading ? "Sending OTP…" : "Send OTP"}
                      </button>
                      <button type="button" onClick={() => setMethod("password")} style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 13, marginTop: 10, cursor: "pointer" }}>
                        ← Use password
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="muted" style={{ fontSize: 13 }}>Demo OTP: <strong>123456</strong></p>
                      <div className="otp">
                        {otp.map((d, i) => (
                          <input key={i} id={`modal-otp-${i}`} value={d} onChange={(e) => handleOtpChange(i, e.target.value)} maxLength={1} autoFocus={i === 0} />
                        ))}
                      </div>
                      <button type="button" className="btn-primary full" onClick={() => verifyOtp()} disabled={loading || otp.some((d) => !d)} style={{ marginTop: 10 }}>
                        {loading ? "Verifying…" : "Verify & Continue"}
                      </button>
                      <button type="button" onClick={() => setOtpStep("phone")} style={{ background: "none", border: "none", color: "var(--mut)", fontSize: 12, marginTop: 10, cursor: "pointer" }}>
                        ← Change number / email
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
