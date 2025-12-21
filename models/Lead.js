const mongoose = require("mongoose");

const BlockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["text", "image", "button"],
    required: true,
  },
  html: String,      // for text
  src: String,       // for image
  alt: String,
  text: String,      // for button
  url: String,
});

const EmailTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    blocks: [BlockSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmailTemplate", EmailTemplateSchema);
