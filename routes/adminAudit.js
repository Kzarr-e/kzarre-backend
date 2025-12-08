const express = require("express");
const router = express.Router();
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { auth } = require("../middlewares/auth");

router.get("/stale-accounts", auth(), async (req, res) => {
  const THREE_MONTHS = 1000 * 60 * 60 * 24 * 90;
  const staleUsers = await User.find({
    lastLogin: { $lt: new Date(Date.now() - THREE_MONTHS) },
  });

  res.json(staleUsers);
});

router.get("/logs", auth(), async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 });
  res.json(logs);
});

module.exports = router;
