const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["PAYMENT", "REFUND", "ORDER_EDIT", "LOGIN", "RETURN"],
      required: true,
    },
    action: String,
    amount: Number,

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    immutable: { type: Boolean, default: true }, // ✅ WORM Compliance
  },
  { timestamps: true }
);

// ❌ Prevent Delete (WORM)
AuditLogSchema.pre("deleteOne", () => {
  throw new Error("WORM Protection: Logs cannot be deleted");
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
