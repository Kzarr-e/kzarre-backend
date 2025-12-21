const express = require("express");
const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/SuperAdmin");
const { sendAdminEmail } = require("../utils/adminsmpt");
const { superAdminOTPTemplate } = require("../utils/emailTemplates");

const router = express.Router();

// ============================================================
// ✅ DEV COOKIE (localhost + LAN + kzarre.local SAFE)
// ============================================================
const DEV_COOKIE = {
  httpOnly: true,
  secure: true,      // ✅ REQUIRED with SameSite None
  sameSite: "none",  // ✅ REQUIRED for cross-origin fetch
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};



// ============================================================
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const pendingSuperAdmins = {};

// ============================================================
// ✅ 1️⃣ SUPER ADMIN REGISTER (SEND OTP)
// ============================================================
router.post("/register", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email)
      return res.status(400).json({ message: "Name & email required" });

    const exists = await SuperAdmin.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "SuperAdmin already exists" });

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    pendingSuperAdmins[email] = { name, otp, otpExpires };

    await sendAdminEmail(
      email,
      "SuperAdmin Registration OTP",
      superAdminOTPTemplate(name, otp, "register")
    );

    res.json({ success: true, message: "OTP sent", email });
  } catch (err) {
    console.error("SuperAdmin Register Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================================
// ✅ 2️⃣ VERIFY REGISTER OTP
// ============================================================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const pending = pendingSuperAdmins[email];
    if (!pending)
      return res.status(400).json({ message: "No OTP request found" });

    if (pending.otp !== otp || Date.now() > pending.otpExpires)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const superAdmin = new SuperAdmin({
      name: pending.name,
      email,
      isVerified: true,
    });

    await superAdmin.save();
    delete pendingSuperAdmins[email];

    res.json({ success: true, message: "Registration complete" });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================================
// ✅ 3️⃣ LOGIN (SEND OTP)
// ============================================================
router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    const superAdmin = await SuperAdmin.findOne({ email, isVerified: true });
    if (!superAdmin)
      return res.status(404).json({ message: "Account not found" });

    const otp = generateOTP();
    const otpExpires = Date.now() + 5 * 60 * 1000;

    pendingSuperAdmins[email] = { otp, otpExpires };

    await sendAdminEmail(
      email,
      "SuperAdmin Login OTP",
      superAdminOTPTemplate(superAdmin.name, otp, "login")
    );

    res.json({ success: true, message: "OTP sent", email });
  } catch (err) {
    console.error("Login OTP Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================================
// ✅ 4️⃣ VERIFY LOGIN OTP → SET COOKIE + RETURN ACCESS TOKEN
// ============================================================
router.post("/login/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const superAdmin = await SuperAdmin.findOne({ email });
    const pending = pendingSuperAdmins[email];

    if (!superAdmin || !pending || pending.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (Date.now() > pending.otpExpires)
      return res.status(400).json({ message: "OTP expired" });

    delete pendingSuperAdmins[email];

    const payload = { id: superAdmin._id, role: "superadmin" };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Save session
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    superAdmin.currentSession = {
      token: refreshToken,
      ip,
      userAgent,
      loginAt: new Date(),
    };

    await superAdmin.save();

    // ✅ Set cookie
    res.cookie("refresh_token", refreshToken, DEV_COOKIE);

  res.json({
  success: true,
  message: "Login successful",
  accessToken,
  refreshToken,
  role: "superadmin",

  // 🔥 THIS IS THE FIX
  permissions: superAdmin.permissions || [
  "view_dashboard",
  "manage_users",
  "create_user",
  "manage_cms",
  "view_analytics",
  "manage_orders",
  "manage_stories",
  "manage_shipping",
  "view_crm",
  "manage_marketing",
  "view_finance",
  "manage_security",
  "manage_settings",
  ],

  admin: {
    id: superAdmin._id,
    name: superAdmin.name,
    email: superAdmin.email,
  },
});
  } catch (err) {
    console.error("Verify Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const cookieToken = req.cookies?.refresh_token;
    const headerToken =
      req.headers.authorization &&
      req.headers.authorization.split(" ")[1];

    const token = cookieToken || headerToken;

    console.log("\n🔁 REFRESH DEBUG START");
    console.log("🍪 Cookie Token Exists:", !!cookieToken);
    console.log("🪪 Header Token Exists:", !!headerToken);

    if (!token) {
      console.log("❌ NO REFRESH TOKEN RECEIVED");
      return res.status(401).json({ message: "No refresh token found" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      console.log("✅ JWT VERIFIED → USER ID:", payload.id);
    } catch (err) {
      console.log("❌ JWT VERIFY FAILED:", err.message);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const superAdmin = await SuperAdmin.findById(payload.id);

    if (!superAdmin) {
      console.log("❌ USER NOT FOUND IN DB");
      return res.status(401).json({ message: "User not found" });
    }

    if (superAdmin.currentSession?.token !== token) {
      console.log("❌ SESSION TOKEN MISMATCH");
      console.log("DB TOKEN EXISTS:", !!superAdmin.currentSession?.token);
      return res.status(401).json({ message: "Invalid session" });
    }

    // ✅ IP CHECK ONLY IN PRODUCTION
    if (process.env.NODE_ENV === "production") {
      const currentIp =
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress;

      const savedIp = superAdmin.currentSession?.ip;

      console.log("🌍 SAVED IP:", savedIp);
      console.log("🌍 CURRENT IP:", currentIp);

      if (savedIp !== currentIp) {
        console.log("❌ IP MISMATCH");
        return res.status(401).json({ message: "Session mismatch" });
      }
    }

    // ✅ ROTATE TOKENS
    const newAccessToken = jwt.sign(
      { id: superAdmin._id, role: "superadmin" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { id: superAdmin._id, role: "superadmin" },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    superAdmin.currentSession.token = newRefreshToken;
    await superAdmin.save();

    res.cookie("refresh_token", newRefreshToken, DEV_COOKIE);

    console.log("✅ REFRESH SUCCESS — NEW TOKENS ISSUED");
    console.log("🔁 REFRESH DEBUG END\n");

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.log("🔥 REFRESH CRASH:", err.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});



// ============================================================
// ✅ 6️⃣ LOGOUT (COOKIE + DB SESSION CLEAR)
// ============================================================
router.post("/logout", async (req, res) => {
  try {
    const token =
      req.cookies?.refresh_token ||
      (req.headers.authorization &&
        req.headers.authorization.split(" ")[1]);


    if (token) {
      const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
      await SuperAdmin.findByIdAndUpdate(payload.id, {
        $unset: { currentSession: 1 },
      });
    }

    res.clearCookie("refresh_token", DEV_COOKIE);
    res.json({ message: "Logged out" });
  } catch (err) {
    res.clearCookie("refresh_token", DEV_COOKIE);
    res.json({ message: "Logged out" });
  }
});

module.exports = router;
