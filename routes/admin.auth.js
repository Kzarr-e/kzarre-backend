const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");
const Role = require("../models/Role");

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";

/* ===============================
   COOKIE OPTIONS (LOCAL + PROD)
=============================== */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,                 // ❗ false on localhost
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/* =====================================================
   ADMIN LOGIN (ROLE-AGNOSTIC, PERMISSION-BASED)
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    /* ===============================
       1️⃣ FIND ADMIN
    =============================== */
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Account not found" });
    }

    /* ===============================
       2️⃣ CHECK ACTIVE
    =============================== */
    if (!admin.isActive) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    /* ===============================
       3️⃣ VERIFY PASSWORD
    =============================== */
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    /* ===============================
       4️⃣ RESOLVE PERMISSIONS (RBAC)
    =============================== */
    let rolePermissions = [];

    if (admin.roleId) {
      const roleDoc = await Role.findById(admin.roleId);
      if (roleDoc?.permissions?.length) {
        rolePermissions = roleDoc.permissions;
      }
    }

    const resolvedPermissions = [
      ...new Set([
        ...rolePermissions,
        ...(admin.permissions || []),
      ]),
    ];

    /* ===============================
       5️⃣ CREATE TOKENS (IDENTITY ONLY)
    =============================== */
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

    /* ===============================
       6️⃣ SET REFRESH COOKIE
    =============================== */
    res.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);

    /* ===============================
       7️⃣ RESPONSE
    =============================== */
    res.json({
      success: true,
      accessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        permissions: resolvedPermissions,
      },
    });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
