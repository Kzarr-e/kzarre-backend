const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Role");

const router = express.Router();

/* ================= HELPERS ================= */
const generateAccessToken = (admin) =>
  jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

const generateRefreshToken = (admin) =>
  jwt.sign({ id: admin._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    /* 🔐 RESOLVE PERMISSIONS */
    let rolePermissions = [];
    if (admin.roleId) {
      const role = await Role.findById(admin.roleId);
      rolePermissions = role?.permissions || [];
    }

    const permissions = [
      ...new Set([...rolePermissions, ...(admin.permissions || [])]),
    ];

    /* 🔑 TOKENS */
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    /* 🔒 SAVE SESSION */
    admin.currentSession = {
      token: refreshToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      loginAt: new Date(),
    };
    await admin.save();

    /* ✅ RESPONSE (NO COOKIES) */
    res.json({
      success: true,
      accessToken,
      refreshToken,
      admin: {
        _id: admin._id,
        name: admin.name || admin.email,
        email: admin.email,
        role: admin.role || "",
        permissions,
      },
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ================= REFRESH ================= */
router.post("/refresh", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const refreshToken = auth.split(" ")[1];

    const payload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const admin = await Admin.findById(payload.id);
    if (!admin || admin.currentSession?.token !== refreshToken) {
      return res.status(401).json({ message: "Session invalid" });
    }

    const newAccessToken = generateAccessToken(admin);

    res.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("REFRESH ERROR:", err.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

module.exports = router;
