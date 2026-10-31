import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { updateProfile, deleteAccount, changePassword } from "../services/api";
import { cities } from "../data/events";

export default function ProfileSettingsModal({
  user,
  onClose,
  onUpdateUser,
  onSignOut,
  onDeleteAccount,
}) {
  // Active modal tab: "profile" | "password"
  const [activeTab, setActiveTab] = useState("profile");

  // Profile details state
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone?.replace("+91 ", "") || "");
  const [city, setCity] = useState(user?.preferences?.city || "Mumbai");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password update state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Handle saving profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    setProfileError("");

    try {
      const res = await updateProfile({
        id: user.id,
        name,
        email,
        phone,
        city,
        preferences: {
          ...user?.preferences,
          city,
        },
      });

      const updated = res.user;
      localStorage.setItem("showtime_user", JSON.stringify(updated));
      if (onUpdateUser) onUpdateUser(updated);
      setProfileMsg("Profile updated successfully!");
      setTimeout(() => setProfileMsg(""), 3500);
    } catch (err) {
      setProfileError(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle password update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPassMsg("");
    setPassError("");

    if (!newPassword || newPassword.length < 6) {
      setPassError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("New password and confirm password do not match.");
      return;
    }

    setUpdatingPass(true);
    try {
      await changePassword({
        userId: user?.id,
        currentPassword,
        newPassword,
      });

      setPassMsg("Password updated successfully! Your new password is now active.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPassMsg(""), 4000);
    } catch (err) {
      setPassError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setUpdatingPass(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount({
        userId: user?.id,
        phone: user?.phone,
        email: user?.email,
      });
      if (onDeleteAccount) {
        onDeleteAccount();
      } else {
        localStorage.removeItem("showtime_user");
        onClose();
        if (onSignOut) onSignOut();
      }
    } catch (err) {
      setProfileError(err.message || "Failed to delete account");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.phone ? user.phone.slice(-1) : "U";

  // Password validation indicators
  const isLengthValid = newPassword.length >= 6;
  const isMatchValid = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <motion.div
      className="modal-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal wide"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 620,
          padding: "28px 32px",
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            fontSize: 22,
            lineHeight: 1,
            color: "var(--mut)",
            cursor: "pointer",
            background: "none",
            border: "none",
          }}
          aria-label="Close modal"
        >
          &times;
        </button>

        {/* Profile Card Header */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--red), #ff7a5c)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 26,
              fontWeight: 800,
              boxShadow: "0 6px 18px rgba(248,68,100,0.35)",
              flexShrink: 0,
            }}
          >
            {userInitial}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 21, fontWeight: 700, color: "var(--ink2)", margin: 0 }}>
                {user?.name || "ShowTime Member"}
              </h2>
              <span
                style={{
                  background: "#e8f8ed",
                  color: "#1a8d3f",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                VERIFIED
              </span>
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 13, color: "var(--mut)", flexWrap: "wrap" }}>
              <span>Phone: {user?.phone || "No phone added"}</span>
              {user?.email && <span>Email: {user?.email}</span>}
            </div>
          </div>
        </div>

        {/* SETTINGS TABS: PROFILE VS PASSWORD */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 18,
            marginBottom: 20,
            background: "#f1f5f9",
            padding: 4,
            borderRadius: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            id="tab-profile-settings"
            style={{
              flex: 1,
              padding: "9px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s ease",
              background: activeTab === "profile" ? "#ffffff" : "transparent",
              color: activeTab === "profile" ? "#1e293b" : "#64748b",
              boxShadow: activeTab === "profile" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Edit Profile
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("password")}
            id="tab-password-settings"
            style={{
              flex: 1,
              padding: "9px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s ease",
              background: activeTab === "password" ? "#ffffff" : "transparent",
              color: activeTab === "password" ? "var(--red, #f84464)" : "#64748b",
              boxShadow: activeTab === "password" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Change Password
          </button>
        </div>

        {/* TAB 1: PROFILE DETAILS */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {profileMsg && (
              <div style={{ background: "#e8f8ed", color: "#1a8d3f", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>✓</span> {profileMsg}
              </div>
            )}
            {profileError && (
              <div style={{ background: "#fdecea", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                {profileError}
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
                Full Name
              </label>
              <input
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
                  Email ID
                </label>
                <input
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
                  Phone Number
                </label>
                <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                  <span style={{ padding: "10px 12px", background: "#f5f5f7", fontSize: 13, color: "var(--mut)" }}>+91</span>
                  <input
                    style={{ flex: 1, padding: "10px 12px", border: "none", fontSize: 14 }}
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="10 digit number"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
                Preferred City
              </label>
              <select
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14, background: "#fff" }}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Quick Switch to Password tab */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f8fafc",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12.5,
              }}
            >
              <span style={{ color: "#475569" }}>
                🔒 Want to update your account password?
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("password")}
                style={{
                  color: "var(--red, #f84464)",
                  fontWeight: 700,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Change Password →
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={savingProfile}
                style={{ padding: "10px 24px" }}
                id="save-profile-btn"
              >
                {savingProfile ? "Saving…" : "Save Changes"}
              </button>
            </div>

            {/* DANGER ZONE: DELETE ACCOUNT */}
            <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--red)", margin: 0 }}>Delete Account</h4>
                  <p style={{ fontSize: 12, color: "var(--mut)", margin: "2px 0 0" }}>Permanently delete your account and personal data</p>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      background: "none",
                      border: "1px solid var(--red)",
                      color: "var(--red)",
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    id="delete-account-btn"
                  >
                    Delete Account
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        background: "var(--red)",
                        border: "none",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      id="confirm-delete-account-btn"
                    >
                      {deleting ? "Deleting…" : "Confirm Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{
                        background: "#f0f0f3",
                        border: "none",
                        color: "var(--ink2)",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: CHANGE PASSWORD */}
        {activeTab === "password" && (
          <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink2)", margin: 0 }}>
                Update Account Password
              </h3>
              <p style={{ fontSize: 12, color: "var(--mut)", margin: "4px 0 0" }}>
                Enter your current password and choose a new password of at least 6 characters.
              </p>
            </div>

            {passMsg && (
              <div style={{ background: "#e8f8ed", color: "#1a8d3f", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>✓</span> {passMsg}
              </div>
            )}
            {passError && (
              <div style={{ background: "#fdecea", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠</span> {passError}
              </div>
            )}

            {/* Current Password Field */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", display: "block", marginBottom: 4 }}>
                Current Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showCurrentPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  id="current-password-input"
                  style={{
                    width: "100%",
                    padding: "10px 42px 10px 14px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={showCurrentPass ? "Hide password" : "Show password"}
                >
                  {showCurrentPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", margin: 0 }}>
                  New Password
                </label>
                {newPassword.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isLengthValid ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {isLengthValid ? "✓ Minimum 6 characters met" : "Must be at least 6 characters"}
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  required
                  id="new-password-input"
                  style={{
                    width: "100%",
                    padding: "10px 42px 10px 14px",
                    border: `1px solid ${newPassword.length > 0 && !isLengthValid ? "#f87171" : "var(--line)"}`,
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={showNewPass ? "Hide password" : "Show password"}
                >
                  {showNewPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", margin: 0 }}>
                  Confirm New Password
                </label>
                {confirmPassword.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isMatchValid ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {isMatchValid ? "✓ Passwords match" : "Passwords do not match"}
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  id="confirm-password-input"
                  style={{
                    width: "100%",
                    padding: "10px 42px 10px 14px",
                    border: `1px solid ${confirmPassword.length > 0 && !isMatchValid ? "#f87171" : "var(--line)"}`,
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={showConfirmPass ? "Hide password" : "Show password"}
                >
                  {showConfirmPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Security Notice Card */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              🔒 <strong>Security Notice:</strong> Your password is cryptographically salted and hashed. Updating your password will require entering your new password the next time you sign in.
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPassError("");
                  setActiveTab("profile");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ← Back to Profile
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={updatingPass || !isLengthValid || !isMatchValid}
                style={{
                  padding: "10px 24px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
                id="update-password-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {updatingPass ? "Updating Password…" : "Update Password"}
              </button>
            </div>
          </form>
        )}

        {/* Bottom Section: Explicit Sign Out */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--mut)" }}>
            Signed in as <strong>{user?.name || user?.phone}</strong>
          </span>

          <button
            onClick={() => {
              onClose();
              if (onSignOut) onSignOut();
            }}
            id="modal-signout-btn"
            style={{
              border: "1.5px solid var(--red)",
              color: "var(--red)",
              background: "#fff",
              padding: "7px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "var(--red)"; }}
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
