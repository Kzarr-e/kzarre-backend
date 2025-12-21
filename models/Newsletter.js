const mongoose = require("mongoose");

const NewsletterSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String, // fallback HTML
    },

    blocks: {
      type: Array, // editor blocks
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "send", "sent"],
      default: "draft",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sentAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Newsletter", NewsletterSchema);
