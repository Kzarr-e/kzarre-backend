const express = require("express");
const router = express.Router();
const accessAuth = require("../middlewares/accessAuth");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

router.get("/me", accessAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id)
      .populate("roleId", "name")
      .select("name email roleId");

    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      name: admin.name,
      email: admin.email,
      role: admin.roleId?.name || "Undefined", 
    });
  } catch (err) {
    console.error("PROFILE ME ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});




router.post("/change-password", accessAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    await admin.save();

    res.json({ success: true, message: "Password updated successfully" });

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
