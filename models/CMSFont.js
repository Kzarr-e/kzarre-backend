const mongoose = require("mongoose");

const CMSFontSchema = new mongoose.Schema(
  {
    fontName: { type: String, required: true },
    fontUrl: { type: String, required: true },
    fontWeight: { type: String, default: "normal" },
    fontStyle: { type: String, default: "normal" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CMSFont", CMSFontSchema);
