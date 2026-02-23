const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    // 🔐 Can be null for public security events
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    userName: {
      type: String,
      default: "Unknown",
    },

    // ✅ Add PUBLIC role for non-auth routes
    role: {
      type: String,
      enum: ["superadmin", "admin", "PUBLIC"],
      default: "PUBLIC",
    },

    action: {
      type: String,
      required: true,
    },

    ip: String,
    userAgent: String,

    // 🔥 Add metadata (very important for enterprise logging)
    meta: {
      type: Object,
      default: {},
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);