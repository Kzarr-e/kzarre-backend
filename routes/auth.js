const express = require("express");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");
const { register, login, verifyOtp } = require("../controllers/authController");
const isProd = process.env.NODE_ENV === "production";

const router = express.Router();

// ================= AUTH =================
router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);

// ================= REFRESH =================
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,               
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const payload = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET
    );

    const admin = await Admin.findById(payload.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "User not found" });
    }

    // 🔒 Session validation
    if (admin.currentSession?.token !== token) {
      return res.status(401).json({ message: "Session invalid" });
    }

    const newAccessToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("REFRESH ERROR:", err.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});




// ✅ EXPORT ONLY ONCE
module.exports = router;
