// models/ReturnRequest.js
const mongoose = require("mongoose");

const ReturnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String },
    condition: {
      type: String,
      enum: ["unopened", "opened", "damaged", "defective", "other"],
      default: "unopened",
    },
  },
  { _id: false }
);

const ReturnRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    items: [ReturnItemSchema],

    status: {
      type: String,
      enum: ["pending", "approved", "denied", "completed"],
      default: "pending",
      index: true,
    },

    reasonGeneral: { type: String }, // e.g. "size issue", "wrong item", etc.
    adminNotes: { type: String },

    restockOnApproval: { type: Boolean, default: true },
    restockedAt: { type: Date },

    refundAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReturnRequest", ReturnRequestSchema);
