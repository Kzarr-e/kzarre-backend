const mongoose = require("mongoose");

const ReturnRequestSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    reason: String,

    status: {
      type: String,
      enum: ["pending", "approved", "denied", "completed"],
      default: "pending",
    },

    restockItems: { type: Boolean, default: false },
    adminNote: String,

    // ✅ Reverse shipment info
    returnShipment: {
      courier: String,
      trackingId: String,
      labelUrl: String,
      status: {
        type: String,
        enum: ["created", "picked", "in_transit", "delivered"],
        default: "created",
      },
    },

    // ✅ SLA control
    sla: {
      pickupBy: Date,
      completeBy: Date,
      breached: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ReturnRequest ||
  mongoose.model("ReturnRequest", ReturnRequestSchema);
