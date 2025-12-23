const express = require("express");
const router = express.Router();

// 🔥 THIS IS WHERE YOU IMPORT IT
const auth  = require("../middlewares/admin-profile");

const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");

/* =====================================================
   👤 GET CURRENT PROFILE
===================================================== */
// router.get("/me", auth(), async (req, res) => {
//   try {
//     const { id, type } = req.user;

//     let user;

//     if (type === "superadmin") {
//       user = await SuperAdmin.findById(id).select("name email isActive");
//     } else if (type === "admin") {
//       user = await Admin.findById(id).select(
//         "name email role group permissions isActive"
//       );
//     } else {
//       return res.status(403).json({ message: "Invalid user type" });
//     }

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json({
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       role: type === "superadmin" ? "SuperAdmin" : user.role,
//       type,
//     });
//   } catch (err) {
//     console.error("PROFILE /me ERROR:", err);
//     res.status(500).json({ message: "Failed to load profile" });
//   }
// });

router.get("/me", auth, async (req, res) => {
  res.json({
    name: req.user.name,
    email: req.user.email,
    permissions: req.user.permissions,
  });
});

module.exports = router;
