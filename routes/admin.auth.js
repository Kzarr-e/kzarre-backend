const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Role");
const crypto = require("crypto");
const router = express.Router();
const { sendAdminEmail } = require("../utils/adminsmpt"); // adjust path if needed
const rateLimit = require("express-rate-limit");
const Activity = require("../models/Activity");

/* ================= HELPERS ================= */
const generateAccessToken = (admin) =>
  jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

const generateRefreshToken = (admin) =>
  jwt.sign({ id: admin._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 requests per IP
  message: {
    message:
      "Too many password reset requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    /* 🔐 RESOLVE PERMISSIONS */
    let rolePermissions = [];
    if (admin.roleId) {
      const role = await Role.findById(admin.roleId);
      rolePermissions = role?.permissions || [];
    }

    const permissions = [
      ...new Set([...rolePermissions, ...(admin.permissions || [])]),
    ];

    /* 🔑 TOKENS */
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    /* 🔒 SAVE SESSION */
    admin.currentSession = {
      token: refreshToken,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      loginAt: new Date(),
    };
    await admin.save();

    /* ✅ RESPONSE (NO COOKIES) */
    res.json({
      success: true,
      accessToken,
      refreshToken,
      admin: {
        _id: admin._id,
        name: admin.name || admin.email,
        email: admin.email,
        role: admin.role || "",
        permissions,
      },
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ================= REFRESH ================= */
router.post("/refresh", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const refreshToken = auth.split(" ")[1];

    const payload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const admin = await Admin.findById(payload.id);
    if (!admin || admin.currentSession?.token !== refreshToken) {
      return res.status(401).json({ message: "Session invalid" });
    }

    const newAccessToken = generateAccessToken(admin);

    res.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("REFRESH ERROR:", err.message);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

/* ================= FORGOT PASSWORD ================= */
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const admin = await Admin.findOne({ email });
    const ip =
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.socket.remoteAddress;
    // 🔐 Log attempt (even if admin not found)
   await Activity.create({
  userId: admin?._id || null,
  userName: admin?.email || email,
  role: admin?.role || "PUBLIC",
  action: "SECURITY_PASSWORD_RESET_REQUESTED",
  meta: {
    success: !!admin,
    emailAttempted: email,
  },
  ip,
  userAgent: req.headers["user-agent"],
});

    // 🔒 Prevent email enumeration
    if (!admin) {
      return res.json({
        success: true,
        message: "If that email exists, a reset link has been sent.",
      });
    }

    // 🚫 Check if email is temporarily blocked
    if (
      admin.resetBlockedUntil &&
      admin.resetBlockedUntil > Date.now()
    ) {
      return res.status(429).json({
        message:
          "Too many reset attempts. Please try again later.",
      });
    }

    // 📈 Increase reset attempts
    admin.resetAttempts += 1;

    // 🔒 Block after 5 attempts
    if (admin.resetAttempts >= 5) {
      admin.resetBlockedUntil =
        Date.now() + 30 * 60 * 1000; // 30 min block
      admin.resetAttempts = 0;
      await admin.save();

      return res.status(429).json({
        message:
          "Too many reset attempts. Account temporarily locked.",
      });
    }

    // 1️⃣ Generate raw token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 2️⃣ Hash token before saving
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    admin.resetPasswordToken = hashedToken;
    admin.resetPasswordExpire =
      Date.now() + 15 * 60 * 1000; // 15 minutes

    await admin.save();

    // 3️⃣ Create reset URL
    const resetURL = `${process.env.ADMIN_URL}/forgot-password/${resetToken}`;

    // 📧 Send email
    await sendAdminEmail(
      admin.email,
      "Security Alert: Password Reset Requested",
      `
  <div style="background:#f3f4f6;padding:50px 0;font-family:Segoe UI,Roboto,Arial,sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">

          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

            <!-- Top Bar -->
            <tr>
              <td style="padding:28px 40px;border-bottom:1px solid #e5e7eb;">
                <h1 style="margin:0;font-size:18px;font-weight:600;color:#111827;">
                  KZARRĒ Admin Security
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                
                <h2 style="margin:0 0 20px;font-size:22px;color:#111827;">
                  Reset your password
                </h2>

                <p style="color:#374151;font-size:15px;line-height:1.7;">
                  Hi ${admin.name || "Admin"},
                </p>

                <p style="color:#374151;font-size:15px;line-height:1.7;">
                  We received a request to reset the password for your 
                  <strong>KZARRĒ Admin account</strong>.
                </p>

                <!-- Security Metadata -->
                <div style="margin:28px 0;padding:18px;border:1px solid #e5e7eb;border-radius:10px;background:#fafafa;">
                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    <strong>Request details</strong><br/>
                    Time: ${new Date().toUTCString()}<br/>
                    IP Address: ${req.ip}<br/>
                    Device: ${req.headers["user-agent"] || "Unknown"}
                  </p>
                </div>

                <!-- CTA -->
                <div style="margin:36px 0;text-align:center;">
                  <a href="${resetURL}"
                     style="
                        background:#000000;
                        color:#ffffff;
                        padding:14px 34px;
                        border-radius:8px;
                        text-decoration:none;
                        font-weight:600;
                        font-size:14px;
                        display:inline-block;
                     ">
                     Reset password
                  </a>
                </div>

                <!-- Expiry -->
                <p style="font-size:14px;color:#111827;">
                  This link will expire in <strong>15 minutes</strong>.
                </p>

                <!-- Security Warning -->
                <p style="font-size:14px;color:#6b7280;line-height:1.7;">
                  If you did not request a password reset, you can safely ignore this email.
                  Your account password will remain unchanged.
                </p>

                <!-- Fallback Link -->
                <p style="font-size:12px;color:#9ca3af;word-break:break-all;margin-top:30px;">
                  If the button above does not work, copy and paste this URL into your browser:<br/>
                  ${resetURL}
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:30px 40px;border-top:1px solid #e5e7eb;background:#fafafa;">
                
                <p style="margin:0;font-size:12px;color:#6b7280;">
                  Security reference ID:
                  <strong>${crypto.randomBytes(6).toString("hex")}</strong>
                </p>

                <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
                  © ${new Date().getFullYear()} KZARRĒ. All rights reserved.
                </p>

                <p style="margin:6px 0 0;font-size:11px;color:#d1d5db;">
                  This is an automated message from the KZARRĒ Admin Security System.
                </p>

              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </div>
  `
    );

    console.log("🔐 RESET LINK:", resetURL);

    res.json({
      success: true,
      message: "If that email exists, a reset link has been sent.",
    });

  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ================= RESET PASSWORD ================= */
/* ================= RESET PASSWORD ================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    // 🔒 Basic validation
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🔐 Password match validation
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // 🔐 Minimum strength validation
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    // 1️⃣ Hash incoming token
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    // 2️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    admin.password = hashedPassword;

    // 3️⃣ Clear reset fields
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;

    // 4️⃣ Invalidate old session
    admin.currentSession = undefined;

    await admin.save();

    res.json({
      success: true,
      message: "Password reset successful. Please login again.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ================= VERIFY RESET TOKEN ================= */
router.get("/verify-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({
        valid: false,
        message: "Reset link expired or invalid",
      });
    }

    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ valid: false });
  }
});
module.exports = router;
