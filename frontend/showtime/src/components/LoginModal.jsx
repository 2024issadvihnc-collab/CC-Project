import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  registerUser,
  loginUser,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
  resetPassword,
} from "../services/api";

export default function LoginModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot"
  const [method, setMethod] = useState("password"); // "password" | "otp"

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
      const payload = res.data || res || {};
      const userObj = payload.user || (payload.id ? payload : {});
      const token = payload.token || res.token || userObj?.token;
      const userData = { ...userObj, token };
      if (!userData.name && regName) userData.name = regName.trim();
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
      const payload = res.data || res || {};
      const userObj = payload.user || (payload.id ? payload : {});
      const token = payload.token || res.token || userObj?.token;
      const userData = { ...userObj, token };
      if (!userData.name && regName) userData.name = regName.trim();
      localStorage.setItem("showtime_user", JSON.stringify(userData));
      onSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || "Invalid credentials. Please verify your phone/email and password.");
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
      setError("Please enter a valid 10-digit mobile number or Email ID");
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
      const payload = res.data || res || {};
      const userObj = payload.user || (payload.id ? payload : {});
      const token = payload.token || res.token || userObj?.token;
      const userData = { ...userObj, token };
      if (!userData.phone && !userData.email) {
        if (target.includes("@")) userData.email = target;
        else userData.phone = `+91 ${target.replace(/\D/g, "").slice(-10)}`;
      }
      if (!userData.name) {
        userData.name = target.includes("@") ? target.split("@")[0] : `User ${target.replace(/\D/g, "").slice(-4)}`;
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

          {/* Toggle Tabs (when not in forgot password mode) */}
          {mode !== "forgot" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "#f0f0f3", borderRadius: 8, padding: 3, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setMsg(""); }}
                style={{ padding: "7px 0", borderRadius: 6, fontWeight: 700, fontSize: 13, border: "none", background: mode === "login" ? "#fff" : "none", color: mode === "login" ? "var(--ink2)" : "var(--mut)" }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setMsg(""); }}
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
              <input style={{ padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8 }} type="email" placeholder="Email ID" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />

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
                    placeholder="Phone Number or Email ID"
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
                          placeholder="Enter mobile number or Email ID"
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
