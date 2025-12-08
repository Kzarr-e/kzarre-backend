const mongoose = require("mongoose");

const AdConfigSchema = new mongoose.Schema(
  {
    facebookPixel: String,
    googleTagManager: String,
    tiktokPixel: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdConfig", AdConfigSchema);
