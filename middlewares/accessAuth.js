const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

module.exports = async function accessAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized - no token provided" });
    }

    const token = auth.split(" ")[1];

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(payload.id)
      .populate("roleId", "name permissions");

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Account disabled or not found" });
    }

    const roleName = admin.roleId?.name || "";
    const isSuperAdmin = roleName.toLowerCase() === "superadmin";

    req.user = {
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: roleName,
      isSuperAdmin,
      permissions: isSuperAdmin
        ? ["*"]
        : [
            ...new Set([
              ...(admin.roleId?.permissions || []),
              ...(admin.permissions || []),
            ]),
          ],
    };

    next();
  } catch (err) {
    console.error("❌ AccessAuth error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
