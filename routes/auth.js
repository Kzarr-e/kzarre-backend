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
    const token =
      req.cookies?.refresh_token ||
      (req.headers.authorization &&
        req.headers.authorization.split(" ")[1]);

    if (!token) {
      return res.status(401).json({ message: "No refresh token found" });
    }

    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const { id, role } = payload;

    let user;

    if (role === "superadmin") {
      user = await SuperAdmin.findById(id);
      if (!user || user.currentSession?.token !== token) {
        return res.status(401).json({ message: "Invalid session" });
      }
    } else {
      user = await Admin.findById(id);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "User not found" });
      }
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // rotate refresh only for superadmin
    if (role === "superadmin") {
      const newRefreshToken = jwt.sign(
        { id: user._id, role },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" }
      );

      user.currentSession.token = newRefreshToken;
      await user.save();
      res.cookie("refresh_token", newRefreshToken, COOKIE_OPTIONS);
    }

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("REFRESH ERROR:", err.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// ✅ EXPORT ONLY ONCE
module.exports = router;
