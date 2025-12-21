const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Role = require("../models/Role");
const Permission = require("../models/Permission");

const router = express.Router();

/* =====================================================
   ADMIN / SUPERADMIN LOGIN
===================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Account is not Found" });
    }

    // 2️⃣ Check active
    if (!admin.isActive) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    // 3️⃣ Verify password
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid Password" });
    }

    /* ================================
       🔑 RESOLVE ROLE + PERMISSIONS
    ================================= */
    let roleName = "";
    let resolvedPermissions = [];

    if (admin.roleId) {
      const roleDoc = await Role.findById(admin.roleId);

      if (roleDoc) {
        roleName = roleDoc.name;

        if (roleDoc.permissions?.length) {
          resolvedPermissions.push(...roleDoc.permissions);
        }
      }
    }

    // 🔥 SUPERADMIN → ALL PERMISSIONS
    if (roleName === "superadmin") {
      const allPermissions = await Permission.find().select("key");
      resolvedPermissions = allPermissions.map(p => p.key);
    }

    // 🔁 User-specific overrides
    if (admin.permissions?.length) {
      resolvedPermissions.push(...admin.permissions);
    }

    // 🧹 Deduplicate
    resolvedPermissions = [...new Set(resolvedPermissions)];

    /* ================================
       🔑 TOKENS
    ================================= */
    const accessToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    /* ================================
       ✅ RESPONSE
    ================================= */
    res.json({
      success: true,
      accessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: roleName,                 // ✅ STRING
        permissions: resolvedPermissions // ✅ ARRAY
      },
    });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
