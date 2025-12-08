const mongoose = require("mongoose");

const NewsletterSchema = new mongoose.Schema(
  {
    subject: String,
    content: String,
    sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Newsletter", NewsletterSchema);
