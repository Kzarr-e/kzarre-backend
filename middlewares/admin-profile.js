const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const SuperAdmin = require("../models/SuperAdmin");

const auth = (roles = []) => {
  if (typeof roles === "string") roles = [roles];

  return async (req, res, next) => {
    try {
      let token = null;

      // 🔥 USE REFRESH TOKEN
      if (req.cookies?.refresh_token) {
        token = req.cookies.refresh_token;
      }

      if (!token && req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      }

      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }

      // ✅ VERIFY WITH REFRESH SECRET
      const decoded = jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET
      );

      const { id, role } = decoded;

      if (!id || !role) {
        return res.status(401).json({ message: "Invalid token payload" });
      }

      let user;

      if (role === "superadmin") {
        user = await SuperAdmin.findById(id);
        if (user?.currentSession?.token !== token) {
          return res.status(401).json({ message: "Session revoked" });
        }
      } else {
        user = await Admin.findById(id);
      }

      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Account disabled" });
      }

      req.user = {
        id: user._id,
        type: role,
        role,
      };

      next();
    } catch (err) {
      console.error("AUTH ERROR:", err.message);
      res.status(401).json({ message: "Invalid refresh token" });
    }
  };
};

module.exports = { auth };
