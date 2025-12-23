const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Role");

module.exports = async function accessAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.split(" ")[1];

    // ✅ VERIFY ACCESS TOKEN
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(payload.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Account disabled" });
    }

    // 🔑 Resolve permissions dynamically
    let rolePermissions = [];
    if (admin.roleId) {
      const role = await Role.findById(admin.roleId);
      if (role?.permissions) rolePermissions = role.permissions;
    }

    const permissions = [
      ...new Set([
        ...rolePermissions,
        ...(admin.permissions || []),
      ]),
    ];

    req.user = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      permissions,
    };

    next();
  } catch (err) {
    console.error("ACCESS AUTH ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
