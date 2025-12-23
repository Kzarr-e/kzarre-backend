const express = require("express");
const router = express.Router();

// 🔥 THIS IS WHERE YOU IMPORT IT
const auth = require("../middlewares/admin-profile");

const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");

router.get("/me", auth, async (req, res) => {
  res.json({
    name: req.user.name,
    email: req.user.email,
    permissions: req.user.permissions,
    Role: req.user.role,
  });
});

module.exports = router;
