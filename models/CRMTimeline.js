const mongoose = require("mongoose");

const CRMTimelineSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    type: {
      type: String,
      enum: ["order", "ticket", "chat", "email", "note"],
      required: true,
    },

    title: String,
    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CRMTimeline", CRMTimelineSchema);
