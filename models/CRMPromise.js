const mongoose = require("mongoose");

const CRMPromiseSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    type: {
      type: String,
      enum: ["replacement", "discount", "delivery"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "fulfilled", "breached"],
      default: "pending",
    },

    dueDate: { type: Date, required: true },
    notes: String,
    attachmentUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CRMPromise", CRMPromiseSchema);
