const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

module.exports = async function accessAuth(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(payload.id)
      .populate("roleId", "permissions");

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Account disabled" });
    }

    req.user = {
      id: admin._id,
      email: admin.email,
      permissions: [
        ...new Set([
          ...(admin.roleId?.permissions || []),
          ...(admin.permissions || []),
        ]),
      ],
    };

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
