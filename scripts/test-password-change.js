const API_BASE = "http://localhost:5000/api";

async function runTest() {
  console.log("================================================================================");
  console.log("Testing ShowTime Settings: Change Password Endpoint & Security Validation");
  console.log("================================================================================");

  const phone = "+91 9999" + Math.floor(100000 + Math.random() * 900000);
  const email = `pwd_test_${Date.now()}@showtime.test`;
  const initialPassword = "initialPassword123";
  const updatedPassword = "newSecurePassword456";

  // Step 1: Register test user
  console.log("\n[Step 1] Registering test user with initial password...");
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Password Test User",
      phone,
      email,
      password: initialPassword,
    }),
  });
  const regJson = await regRes.json();
  if (!regRes.ok) {
    throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
  }
  const payload = regJson.data || regJson;
  const token = payload.token;
  const userId = payload.user.id;
  console.log(`  ✓ Registered user ${userId} with token.`);

  // Step 2: Attempt changing password with wrong current password
  console.log("\n[Step 2] Testing incorrect current password rejection...");
  const wrongRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      currentPassword: "wrongPassword!",
      newPassword: updatedPassword,
    }),
  });
  const wrongJson = await wrongRes.json();
  if (wrongRes.status === 400) {
    console.log(`  ✓ Incorrect current password rejected properly: "${wrongJson.error}"`);
  } else {
    throw new Error(`Expected 400 but got ${wrongRes.status}: ${JSON.stringify(wrongJson)}`);
  }

  // Step 3: Attempt changing password with too short new password
  console.log("\n[Step 3] Testing short password (<6 chars) rejection...");
  const shortRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      currentPassword: initialPassword,
      newPassword: "123",
    }),
  });
  const shortJson = await shortRes.json();
  if (shortRes.status === 400) {
    console.log(`  ✓ Short password rejected properly: "${shortJson.error}"`);
  } else {
    throw new Error(`Expected 400 but got ${shortRes.status}: ${JSON.stringify(shortJson)}`);
  }

  // Step 4: Valid password change
  console.log("\n[Step 4] Updating password with correct credentials...");
  const validRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      currentPassword: initialPassword,
      newPassword: updatedPassword,
    }),
  });
  const validJson = await validRes.json();
  if (validRes.ok) {
    console.log(`  ✓ Password successfully changed! Message: "${validJson.message}"`);
  } else {
    throw new Error(`Password change failed: ${JSON.stringify(validJson)}`);
  }

  // Step 5: Verify login with OLD password fails
  console.log("\n[Step 5] Verifying login with OLD password fails...");
  const oldLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: email,
      password: initialPassword,
    }),
  });
  if (oldLoginRes.status === 401) {
    console.log("  ✓ Login with old password rejected with HTTP 401 as expected.");
  } else {
    throw new Error(`Expected 401 on old password, got ${oldLoginRes.status}`);
  }

  // Step 6: Verify login with NEW password succeeds
  console.log("\n[Step 6] Verifying login with NEW password succeeds...");
  const newLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: email,
      password: updatedPassword,
    }),
  });
  const newLoginJson = await newLoginRes.json();
  const loginData = newLoginJson.data || newLoginJson;
  if (newLoginRes.ok && loginData.token) {
    console.log("  ✓ Login with new password succeeded and issued fresh JWT!");
  } else {
    throw new Error(`Login with new password failed: ${JSON.stringify(newLoginJson)}`);
  }

  console.log("\n================================================================================");
  console.log("ALL PASSWORD UPDATE TESTS PASSED SUCCESSFULLY! (6/6)");
  console.log("================================================================================");
}

runTest().catch((err) => {
  console.error("\nTEST FAILED:", err);
  process.exit(1);
});
