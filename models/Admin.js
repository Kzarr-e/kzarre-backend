const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    token: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    loginAt: { type: Date, default: Date.now },
    logoutAt: { type: Date },
  },
  { _id: false }
);

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    permissions: [{ type: String }], // optional overrides
    isActive: { type: Boolean, default: true },

    currentSession: sessionSchema,

    activityLogs: [
      {
        action: String,
        ip: String,
        userAgent: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", AdminSchema);

