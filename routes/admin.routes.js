const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { auth } = require("../middlewares/admin-profile");

/* =====================================================
   👤 CREATE ADMIN / SUPERADMIN
===================================================== */
router.post("/create", auth(["admin", "superadmin"]), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields required" });
    }

    // 🔒 ONLY SUPERADMIN CAN CREATE SUPERADMIN
    if (role === "superadmin" && req.user.type !== "superadmin") {
      return res.status(403).json({
        message: "Only SuperAdmin can create another SuperAdmin",
      });
    }

    const exists = await Admin.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: `${role} created successfully`,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("CREATE ADMIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
