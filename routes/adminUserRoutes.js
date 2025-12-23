const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Role");
const Permission = require("../models/Permission");
const { auth, authorizeRoles } = require("../middlewares/roleAuth");
const { sendEmail } = require("../utils/sendEmail");

const router = express.Router();

router.post("/create-user",
  async (req, res) => {
    try {
      const { firstName, lastName, email, roleId } = req.body;

      // 1️⃣ Validate role
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      // 2️⃣ Check existing user
      const exists = await Admin.findOne({ email });
      if (exists) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // 3️⃣ Generate password
      const plainPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // 4️⃣ Create admin
      const admin = await Admin.create({
        name: `${firstName} ${lastName}`,
        email,
        password: hashedPassword,
        roleId: role._id,
        isActive: true,
      });

      // 5️⃣ Send email (NON-BLOCKING but awaited for safety)
  await sendEmail(
  email,
  "Your Admin Account Credentials",
  `
    <div style="font-family: Arial, sans-serif">
      <h2>Welcome to KZARRÈ Admin Panel</h2>
      <p>Your account has been created.</p>

      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${plainPassword}</p>
      <p><strong>Role:</strong> ${role.name}</p>

      <p style="margin-top:12px">
        ⚠️ Please login and change your password immediately.
      </p>

      <p>
        Login URL:
        <a href="${process.env.ADMIN_LOGIN_URL}">
          ${process.env.ADMIN_LOGIN_URL}
        </a>
      </p>
    </div>
  `
);
      // 6️⃣ Response
      res.status(201).json({
        message: "✅ User created and email sent",
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: role.name,
        },
      });
    } catch (err) {
      console.error("CREATE USER ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ======================================================
   🔐 LOGIN
====================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    /* ================================
       1️⃣ FIND USER
    ================================= */
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Admin account inactive." });
    }

    /* ================================
       2️⃣ VERIFY PASSWORD
    ================================= */
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid password." });
    }

    /* ================================
       3️⃣ RESOLVE ROLE + PERMISSIONS
    ================================= */
    let resolvedPermissions = [];
    let roleName = "—";

    if (admin.roleId) {
      const roleDoc = await Role.findById(admin.roleId);

      if (roleDoc) {
        roleName = roleDoc.name;

        // 🔥 Superadmin → ALL permissions
        if (roleDoc.name === "superadmin") {
          const allPermissions = await Permission.find().select("key");
          resolvedPermissions = allPermissions.map(p => p.key);
        } else {
          // Role permissions
          if (roleDoc.permissions?.length) {
            resolvedPermissions.push(...roleDoc.permissions);
          }
        }
      }
    }

    // 🔁 User-level permission overrides
    if (admin.permissions?.length) {
      resolvedPermissions.push(...admin.permissions);
    }

    // 🧹 Remove duplicates
    resolvedPermissions = [...new Set(resolvedPermissions)];

    /* ================================
       4️⃣ TOKENS
    ================================= */
    const payload = { id: admin._id };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    /* ================================
       5️⃣ SESSION + ACTIVITY LOG
    ================================= */
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    admin.currentSession = {
      token: refreshToken,
      ip,
      userAgent,
      loginAt: new Date(),
    };

    admin.activityLogs.push({
      action: "LOGIN",
      ip,
      userAgent,
      timestamp: new Date(),
    });

    await admin.save();

    /* ================================
       6️⃣ COOKIE
    ================================= */
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    /* ================================
       7️⃣ RESPONSE
    ================================= */
    res.json({
      success: true,
      message: "✅ Login successful",
      accessToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: roleName,                 // ✅ matches UserList
        permissions: resolvedPermissions, // ✅ role + overrides
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete(
  "/roles/:id",
  async (req, res) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      // ✅ CHECK BY roleId (NOT name)
      const usersUsingRole = await Admin.countDocuments({
        roleId: role._id,
      });

      if (usersUsingRole > 0) {
        return res.status(400).json({
          message: "Role is assigned to users. Remove it first.",
        });
      }

      await Role.findByIdAndDelete(role._id);

      res.json({ message: "✅ Role deleted successfully" });
    } catch (err) {
      console.error("DELETE ROLE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/refresh", async (req, res) => {
  try {
    const oldToken = req.cookies?.refresh_token;
    if (!oldToken) return res.status(401).json({ message: "No refresh token" });

    const payload = jwt.verify(oldToken, process.env.REFRESH_TOKEN_SECRET);
    const admin = await Admin.findById(payload.id);
    if (!admin) return res.status(401).json({ message: "User not found" });

    if (admin.currentSession?.token !== oldToken) {
      return res.status(401).json({ message: "Session invalid" });
    }

    const newAccessToken = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ success: true, accessToken: newAccessToken });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.get("/permissions",
  async (req, res) => {
    const permissions = await Permission.find().sort("key");
    res.json({ permissions });
  }
);

router.get("/roles",
 
  async (req, res) => {
    const roles = await Role.find();
    res.json({ roles });
  }
);

router.post("/roles",
 
  async (req, res) => {
    const { name, permissions } = req.body;

    const exists = await Role.findOne({ name });
    if (exists)
      return res.status(400).json({ message: "Role already exists" });

    const role = await Role.create({ name, permissions });
    res.status(201).json({ message: "✅ Role created", role });
  }
);

router.get(
  "/users",
 
  async (req, res) => {
    const admins = await Admin.find()
      .select("-password")
      .populate("roleId", "name permissions");

    res.json(admins);
  }
);


router.put("/update-permissions/:id",

  async (req, res) => {
    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { permissions: req.body.permissions },
      { new: true }
    ).select("-password");

    res.json({ message: "✅ Permissions updated", admin });
  }
);

router.put("/toggle-active/:id",

  async (req, res) => {
    const admin = await Admin.findById(req.params.id);
    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({
      message: `Admin ${admin.isActive ? "activated" : "deactivated"}`,
    });
  }
);

module.exports = router;
