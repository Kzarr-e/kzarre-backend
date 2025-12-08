const express = require("express");
const Activity = require("../models/Activity");

const router = express.Router();

// ✅ GET ALL ACTIVITY (No Authorization)
router.get("/", async (req, res) => {
  try {
    const logs = await Activity.find().sort({ timestamp: -1 });
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Activity route error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
