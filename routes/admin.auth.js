const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");
const Role = require("../models/Role");
const Permission = require("../models/Permission");

const router = express.Router();

/* =====================================================
   ADMIN LOGIN
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
       4️⃣ RESOLVE ROLE + PERMISSIONS
    =============================== */
    let roleName = "admin";
    let resolvedPermissions = [];

    if (admin.roleId) {
      const roleDoc = await Role.findById(admin.roleId);

      if (roleDoc) {
        roleName = roleDoc.name;

        if (Array.isArray(roleDoc.permissions)) {
          resolvedPermissions.push(...roleDoc.permissions);
        }
      }
    }

    // 🔥 SUPERADMIN → ALL PERMISSIONS
    if (roleName === "superadmin") {
      const allPermissions = await Permission.find().select("key");
      resolvedPermissions = allPermissions.map((p) => p.key);
    }

    // 🔁 User-specific overrides
    if (Array.isArray(admin.permissions)) {
      resolvedPermissions.push(...admin.permissions);
    }

    // 🧹 Remove duplicates
    resolvedPermissions = [...new Set(resolvedPermissions)];

    /* ===============================
       5️⃣ CREATE TOKENS
    =============================== */

    // 🔑 ACCESS TOKEN (short-lived)
    const accessToken = jwt.sign(
      {
        id: admin._id,
        role: roleName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // 🔁 REFRESH TOKEN (long-lived)
    const refreshToken = jwt.sign(
      {
        id: admin._id,
        role: roleName,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    /* ===============================
       6️⃣ SET REFRESH COOKIE (CRITICAL)
    =============================== */
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,      // ✅ REQUIRED for Vercel / HTTPS
      sameSite: "none",  // ✅ REQUIRED for cross-domain
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
        role: roleName,
        permissions: resolvedPermissions,
      },
    });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
