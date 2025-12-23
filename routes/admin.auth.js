const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Role");

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin || !admin.isActive)
    return res.status(401).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match)
    return res.status(401).json({ message: "Invalid credentials" });

  let rolePermissions = [];
  if (admin.roleId) {
    const role = await Role.findById(admin.roleId);
    rolePermissions = role?.permissions || [];
  }

  const permissions = [
    ...new Set([...rolePermissions, ...(admin.permissions || [])]),
  ];

  const accessToken = jwt.sign(
    { id: admin._id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: admin._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  admin.currentSession = { token: refreshToken };
  await admin.save();

  res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);

  res.json({
    accessToken,
    admin: { id: admin._id, email: admin.email, permissions },
  });
});

/* ================= REFRESH ================= */
router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ message: "No refresh token" });

  const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

  const admin = await Admin.findById(payload.id);
  if (!admin || admin.currentSession?.token !== token)
    return res.status(401).json({ message: "Session invalid" });

  const newAccessToken = jwt.sign(
    { id: admin._id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  res.json({ accessToken: newAccessToken });
});

module.exports = router;
